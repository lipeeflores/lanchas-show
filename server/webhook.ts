import { Request, Response } from 'express';
import { supabaseAdmin } from './supabase';
import { sendWhatsAppMessage, sendPresence, simulateTypingAndSend, calculateTypingDelay } from './evolution';
import { getAiResponse } from './claude';
import { messageQueue } from './queue';

const evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const evolutionApiKey = process.env.EVOLUTION_API_KEY || '';
const evolutionInstanceName = process.env.EVOLUTION_INSTANCE_NAME || 'lanchas_show';

// Map to store debouncing timeouts per phone number
const conversationTimeouts = new Map<string, NodeJS.Timeout>();

/**
 * Extracts text content from various Evolution API message types.
 */
function extractMessageText(messageObj: any): string {
  if (!messageObj) return '';
  if (typeof messageObj === 'string') return messageObj;
  
  if (messageObj.conversation) return messageObj.conversation;
  if (messageObj.extendedTextMessage?.text) return messageObj.extendedTextMessage.text;
  
  // Non-text message indicators with potential captions
  if (messageObj.imageMessage) {
    return messageObj.imageMessage.caption ? `[Foto] ${messageObj.imageMessage.caption}` : '[Foto]';
  }
  if (messageObj.documentMessage) {
    return messageObj.documentMessage.caption ? `[Documento] ${messageObj.documentMessage.caption}` : '[Documento]';
  }
  if (messageObj.audioMessage) return '[Áudio]';
  if (messageObj.videoMessage) {
    return messageObj.videoMessage.caption ? `[Vídeo] ${messageObj.videoMessage.caption}` : '[Vídeo]';
  }
  if (messageObj.stickerMessage) return '[Figurinha]';
  
  return '';
}

/**
 * Downloads base64 media data from Evolution API.
 */
async function getBase64Media(messageId: string): Promise<{ base64: string; mimetype: string } | null> {
  try {
    const res = await fetch(`${evolutionApiUrl}/chat/getBase64FromMediaMessage/${evolutionInstanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({
        message: {
          key: {
            id: messageId
          }
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Whisper] Evolution API getBase64FromMediaMessage failed: ${res.status} - ${errText}`);
      return null;
    }

    const data = await res.json();
    return {
      base64: data.base64 || '',
      mimetype: data.mimetype || 'audio/ogg'
    };
  } catch (error) {
    console.error(`[Whisper] Error downloading media message:`, error);
    return null;
  }
}

/**
 * Transcribes audio via OpenAI Whisper API.
 */
async function transcribeAudio(base64DataStr: string, mimetype: string): Promise<string> {
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey) {
    console.warn('[Whisper] OpenAI API Key is missing. Cannot transcribe audio.');
    return '[Áudio não transcrito - API Key ausente]';
  }

  const base64Data = base64DataStr.split(';base64,').pop() || base64DataStr;
  const audioBuffer = Buffer.from(base64Data, 'base64');

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: mimetype || 'audio/ogg' });
  
  let ext = 'ogg';
  if (mimetype.includes('mp3')) ext = 'mp3';
  else if (mimetype.includes('wav')) ext = 'wav';
  else if (mimetype.includes('m4a')) ext = 'm4a';

  formData.append('file', blob, `audio.${ext}`);
  formData.append('model', 'whisper-1');
  formData.append('language', 'pt');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAiApiKey}`
    },
    body: formData
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI Whisper responded with ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.text || '';
}

/**
 * Webhook handler for Evolution API.
 *
 * Evolution does not sign webhooks natively. We rely on an optional shared secret
 * (EVOLUTION_WEBHOOK_TOKEN). Configure the Evolution webhook URL with the token as
 * a query parameter (e.g. https://backend/api/whatsapp/webhook?token=XYZ) and set
 * EVOLUTION_WEBHOOK_TOKEN=XYZ here. If not configured, the check is skipped with a
 * warning (useful for local testing while the public URL is private).
 */
export async function handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  const expectedToken = process.env.EVOLUTION_WEBHOOK_TOKEN;
  if (expectedToken) {
    const received = (req.query.token as string | undefined) || (req.headers['x-webhook-token'] as string | undefined) || '';
    if (received !== expectedToken) {
      console.warn('[Webhook] Rejected request with invalid token.');
      res.status(401).json({ status: 'unauthorized' });
      return;
    }
  } else {
    console.warn('[Webhook] EVOLUTION_WEBHOOK_TOKEN not configured — accepting request without verification. Configure it in .env before going live.');
  }

  const body = req.body;
  const event = body.event || '';
  
  if (!event.toLowerCase().includes('upsert')) {
    res.status(200).json({ status: 'ignored', reason: 'Not an upsert event' });
    return;
  }

  const data = body.data;
  if (!data || !data.key) {
    res.status(400).json({ error: 'Invalid payload structure' });
    return;
  }

  const remoteJid = data.key.remoteJid;
  const fromMe = data.key.fromMe === true;
  const phone = remoteJid.split('@')[0];
  const pushName = data.pushName || phone;

  // Handle incoming media: Audio → Whisper transcription; Image → Claude Vision
  let textContent = '';
  let clientImageBase64: string | undefined;
  let clientImageMimetype: string | undefined;

  const isAudio = data.message?.audioMessage || data.message?.pttMessage;
  const isImage = !isAudio && data.message?.imageMessage;

  if (isAudio) {
    console.log(`[Webhook] Audio message detected from ${phone}. Downloading for Whisper transcription...`);
    try {
      const mediaInfo = await getBase64Media(data.key.id);
      if (mediaInfo?.base64) {
        textContent = await transcribeAudio(mediaInfo.base64, mediaInfo.mimetype);
        console.log(`[Webhook] Whisper transcription successful: "${textContent}"`);
      } else {
        textContent = '[Áudio não transcrito - falha no download]';
      }
    } catch (error) {
      console.error(`[Webhook] Error in Whisper transcription:`, error);
      textContent = '[Áudio não transcrito - erro na transcrição]';
    }
  } else if (isImage) {
    console.log(`[Webhook] Image message detected from ${phone}. Downloading for Claude Vision...`);
    try {
      const mediaInfo = await getBase64Media(data.key.id);
      if (mediaInfo?.base64) {
        clientImageBase64 = mediaInfo.base64;
        clientImageMimetype = mediaInfo.mimetype;
        const caption = data.message.imageMessage?.caption || '';
        textContent = caption ? `[Foto] ${caption}` : '[Foto]';
        console.log(`[Webhook] Image downloaded for Vision. Caption: "${caption}"`);
      } else {
        textContent = '[Foto]';
      }
    } catch (error) {
      console.error(`[Webhook] Error downloading image:`, error);
      textContent = '[Foto]';
    }
  } else {
    textContent = extractMessageText(data.message);
  }

  if (!textContent) {
    res.status(200).json({ status: 'ignored', reason: 'Empty text or unsupported message type' });
    return;
  }

  // GROUP CHAT HANDLING (OWNERS GROUP)
  const isGroup = remoteJid.endsWith('@g.us');
  if (isGroup) {
    if (fromMe) {
      res.status(200).json({ status: 'ignored', reason: 'Group message sent by self' });
      return;
    }

    const ownersGroupJid = process.env.OWNERS_GROUP_JID || '';
    if (!ownersGroupJid) {
      console.log(`[Owners Group] Group message received from JID: ${remoteJid}. Group Name: ${pushName}. Text: "${textContent}". Set OWNERS_GROUP_JID=${remoteJid} in your env to enable owners group integration!`);
      res.status(200).json({ status: 'ignored', reason: 'Owners group not configured in env' });
      return;
    }

    if (remoteJid === ownersGroupJid) {
      console.log(`[Owners Group] Message received from owners group: "${textContent}"`);

      messageQueue.enqueue(remoteJid, async () => {
        try {
          // 1. Check if it's a reply to an escalated question
          const quotedMessageId = data.message?.extendedTextMessage?.contextInfo?.stanzaId;
          if (quotedMessageId) {
            const { data: pendingConv } = await supabaseAdmin
              .from('ia_conversations')
              .select('*')
              .eq('pending_owners_message_id', quotedMessageId)
              .maybeSingle();

            if (pendingConv) {
              console.log(`[Owners Group] Owner answered question for client ${pendingConv.contact_phone}. Answer: "${textContent}"`);

              // 1a. Fetch history for the client conversation
              const { data: history } = await supabaseAdmin
                .from('ia_messages')
                .select('sender, content')
                .eq('conversation_id', pendingConv.id)
                .order('created_at', { ascending: false })
                .limit(20);
              
              const chronologicalHistory = (history || []).reverse();

              // 1b. Call Claude to formulate response to the client using the owner's answer
              const aiResponseText = await getAiResponse(
                pendingConv.id, 
                chronologicalHistory, 
                pendingConv.contact_name, 
                pendingConv.contact_phone, 
                textContent
              );

              if (aiResponseText && aiResponseText.trim()) {
                // Send to client with typing simulation
                await simulateTypingAndSend(pendingConv.contact_phone, aiResponseText);

                // Save AI response in DB
                await supabaseAdmin
                  .from('ia_messages')
                  .insert({
                    conversation_id: pendingConv.id,
                    sender: 'IA',
                    content: aiResponseText
                  });

                // Clear pending status in database
                await supabaseAdmin
                  .from('ia_conversations')
                  .update({
                    pending_owners_message_id: null,
                    pending_owners_question: null
                  })
                  .eq('id', pendingConv.id);

                // Confirm back in the owners' group
                await sendWhatsAppMessage(remoteJid, `✅ *Resposta enviada para o cliente ${pendingConv.contact_name} (${pendingConv.contact_phone})!*`);
              }
              return;
            }
          }

          // 2. Process as a general manager query / command
          let { data: groupConv } = await supabaseAdmin
            .from('ia_conversations')
            .select('*')
            .eq('contact_phone', remoteJid)
            .maybeSingle();

          if (!groupConv) {
            const { data: newGroupConv } = await supabaseAdmin
              .from('ia_conversations')
              .insert({
                contact_name: pushName || 'Grupo de Proprietários',
                contact_phone: remoteJid,
                contact_type: 'CLIENT',
                status: 'AI_CONTROL',
                stage: 'novo',
                subject: 'Grupo de Proprietários'
              })
              .select()
              .single();
            groupConv = newGroupConv;
          }

          if (groupConv) {
            // Extrai a mídia (foto/vídeo) se estiver presente na mensagem atual ou na mensagem citada
            let mediaBase64: string | undefined;
            let mediaMimetype: string | undefined;

            const isMedia = data.message?.imageMessage || data.message?.videoMessage || data.message?.documentMessage || data.message?.audioMessage;
            const quotedMessage = data.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedMessageId = data.message?.extendedTextMessage?.contextInfo?.stanzaId;
            const isQuotedMedia = quotedMessage?.imageMessage || quotedMessage?.videoMessage || quotedMessage?.documentMessage || quotedMessage?.audioMessage;

            if (isMedia) {
              const mediaInfo = await getBase64Media(data.key.id);
              if (mediaInfo) {
                mediaBase64 = mediaInfo.base64;
                mediaMimetype = mediaInfo.mimetype;
              }
            } else if (isQuotedMedia && quotedMessageId) {
              const mediaInfo = await getBase64Media(quotedMessageId);
              if (mediaInfo) {
                mediaBase64 = mediaInfo.base64;
                mediaMimetype = mediaInfo.mimetype;
              }
            }

            // Save the owner's message in the DB
            await supabaseAdmin
              .from('ia_messages')
              .insert({
                conversation_id: groupConv.id,
                sender: 'CLIENT',
                content: `${pushName}: ${textContent}` // Prepend owner's name so Claude knows who is talking
              });

            // Fetch history for the group (last 15 messages)
            const { data: groupHistory } = await supabaseAdmin
              .from('ia_messages')
              .select('sender, content')
              .eq('conversation_id', groupConv.id)
              .order('created_at', { ascending: false })
              .limit(15);
            const chronologicalGroupHistory = (groupHistory || []).reverse();

            // Call Claude using the new getOwnersGroupResponse function
            const { getOwnersGroupResponse } = await import('./claude');

            // Fetch pending client questions that were escalated to this group
            const { data: pendingConvs } = await supabaseAdmin
              .from('ia_conversations')
              .select('id, contact_name, contact_phone, pending_owners_question')
              .not('pending_owners_message_id', 'is', null)
              .not('pending_owners_question', 'is', null);

            const pendingQuestions = (pendingConvs || []).map(c => ({
              conversation_id: c.id,
              client_name: c.contact_name || 'Desconhecido',
              client_phone: c.contact_phone || 'Desconhecido',
              question: c.pending_owners_question || ''
            }));

            const aiResponseText = await getOwnersGroupResponse(chronologicalGroupHistory, mediaBase64, mediaMimetype, pendingQuestions);

            if (aiResponseText && aiResponseText.trim()) {
              // Send response to the owners' group with typing simulation
              await simulateTypingAndSend(remoteJid, aiResponseText);

              // Save response in DB
              await supabaseAdmin
                .from('ia_messages')
                .insert({
                  conversation_id: groupConv.id,
                  sender: 'IA',
                  content: aiResponseText
                });
            }
          }
        } catch (error) {
          console.error(`[Owners Group] Error processing group message:`, error);
        }
      });

      res.status(200).json({ status: 'received', type: 'owners_group' });
      return;
    }

    res.status(200).json({ status: 'ignored', reason: 'Not the configured owners group' });
    return;
  }

  console.log(`[Webhook] Event: ${event} | Phone: ${phone} | fromMe: ${fromMe} | Msg: "${textContent.substring(0, 30)}..."`);

  if (fromMe) {
    // Process outgoing messages (messages sent from our side).
    // We need to save genuine manual admin messages while skipping echoes of AI-generated messages.
    messageQueue.enqueue(phone, async () => {
      try {
        // Build phone variants to handle Brazil DDI "55" inconsistencies.
        // Evolution API may echo back the number with or without the country code,
        // causing a mismatch with how the conversation was originally stored.
        const phoneVariants: string[] = [phone];
        if (phone.startsWith('55') && phone.length >= 12) {
          phoneVariants.push(phone.substring(2)); // also try without DDI
        } else if (!phone.startsWith('55') && phone.length >= 10) {
          phoneVariants.push('55' + phone); // also try with DDI
        }

        // Fetch ALL conversations for any variant of this phone number
        const { data: allConvs } = await supabaseAdmin
          .from('ia_conversations')
          .select('id')
          .in('contact_phone', phoneVariants)
          .order('created_at', { ascending: false }); // most recent first

        if (!allConvs || allConvs.length === 0) {
          // No conversation exists at all — create one and save as ADMIN
          const { data: newConv } = await supabaseAdmin
            .from('ia_conversations')
            .insert({
              contact_name: pushName,
              contact_phone: phone,
              contact_type: 'CLIENT',
              status: 'AI_CONTROL',
              stage: 'novo',
              subject: 'Atendimento WhatsApp'
            })
            .select('id')
            .single();
          if (newConv) {
            await supabaseAdmin.from('ia_messages').insert({
              conversation_id: newConv.id,
              sender: 'ADMIN',
              content: textContent
            });
            console.log('[Webhook] Outgoing message saved as ADMIN (new conversation).');
          }
          return;
        }

        const convIds = allConvs.map(c => c.id);

        // Check if this exact message content already exists in ANY of the conversations
        // for this phone. This is the dedup check — AI responses are saved by the AI handler
        // before this fromMe webhook fires, so they should always be found here.
        const { data: existing } = await supabaseAdmin
          .from('ia_messages')
          .select('id')
          .in('conversation_id', convIds)
          .eq('content', textContent)
          .limit(1);

        if (existing && existing.length > 0) {
          // Message was already saved (by the AI handler or a previous fromMe). Skip.
          return;
        }

        // Not found in any conversation — it's a genuine manual admin message.
        // Save it to the most recently created conversation.
        await supabaseAdmin.from('ia_messages').insert({
          conversation_id: convIds[0],
          sender: 'ADMIN',
          content: textContent
        });
        console.log('[Webhook] Outgoing message saved as ADMIN.');
      } catch (error) {
        console.error('[Webhook] Error saving outgoing message:', error);
      }
    });
  } else {
    // Process incoming client messages (debounced and queued)
    try {
      // 1. Fetch or create conversation
      let { data: conversation, error: convError } = await supabaseAdmin
        .from('ia_conversations')
        .select('*')
        .eq('contact_phone', phone)
        .maybeSingle();

      if (convError) throw convError;

      if (!conversation) {
        const { data: newConv, error: createError } = await supabaseAdmin
          .from('ia_conversations')
          .insert({
            contact_name: pushName,
            contact_phone: phone,
            contact_type: 'CLIENT',
            status: 'AI_CONTROL',
            stage: 'novo',
            subject: 'Atendimento WhatsApp'
          })
          .select()
          .single();

        if (createError) throw createError;
        conversation = newConv;
      }

      // 2. Save client's message in the DB immediately so it updates the Admin UI
      const { error: insertError } = await supabaseAdmin
        .from('ia_messages')
        .insert({
          conversation_id: conversation.id,
          sender: 'CLIENT',
          content: textContent
        });

      if (insertError) throw insertError;
      console.log(`[Webhook] Incoming message saved as CLIENT immediately.`);

      // 3. If under AI control, debounce the response trigger
      if (conversation.status === 'AI_CONTROL') {
        const existingTimeout = conversationTimeouts.get(phone);
        if (existingTimeout) {
          console.log(`[Webhook] Message from ${phone} received within 8s. Resetting debounce timer.`);
          clearTimeout(existingTimeout);
        }

        const timeout = setTimeout(() => {
          conversationTimeouts.delete(phone);

          // Enqueue the AI generation task in the sequential queue
          messageQueue.enqueue(phone, async () => {
            try {
              // Reload conversation mode to check if it's still AI_CONTROL
              const { data: currentConv } = await supabaseAdmin
                .from('ia_conversations')
                .select('status, id, contact_name, contact_phone')
                .eq('contact_phone', phone)
                .single();

              if (!currentConv || currentConv.status !== 'AI_CONTROL') {
                console.log(`[Webhook] Conversation ${phone} is no longer in AI_CONTROL. Skipping AI response.`);
                return;
              }

              // Fetch the last 20 messages for context (ordered chronologically)
              const { data: history, error: historyError } = await supabaseAdmin
                .from('ia_messages')
                .select('sender, content')
                .eq('conversation_id', currentConv.id)
                .order('created_at', { ascending: false })
                .limit(20);

              if (historyError) throw historyError;

              const chronologicalHistory = (history || []).reverse();

              // Send "composing" presence status to WhatsApp immediately when beginning generation
              await sendPresence(phone, 'composing');

              // Call Claude to formulate response (pass image if any for Vision)
              const aiResponseText = await getAiResponse(
                currentConv.id,
                chronologicalHistory,
                currentConv.contact_name || pushName || '',
                currentConv.contact_phone || phone || '',
                undefined,
                clientImageBase64,
                clientImageMimetype
              );

              if (!aiResponseText || !aiResponseText.trim()) {
                await sendPresence(phone, 'paused');
                return;
              }

              // Realistic typing animation: keeps the three dots alive during the
              // entire delay, proportional to the message length.
              console.log(`[Webhook] Simulating typing for ${calculateTypingDelay(aiResponseText)}ms before sending.`);
              await simulateTypingAndSend(phone, aiResponseText);

              // Save AI response in DB
              const { error: aiInsertError } = await supabaseAdmin
                .from('ia_messages')
                .insert({
                  conversation_id: currentConv.id,
                  sender: 'IA',
                  content: aiResponseText
                });

              if (aiInsertError) throw aiInsertError;
              console.log(`[Webhook] AI responded successfully and message saved.`);
            } catch (error) {
              console.error(`[Webhook] Error executing enqueued AI task for ${phone}:`, error);
            }
          });
        }, 8000); // 8-second inactivity window

        conversationTimeouts.set(phone, timeout);
      } else {
        console.log(`[Webhook] Chat in HUMAN_CONTROL mode. No AI response triggered.`);
      }
    } catch (error) {
      console.error(`[Webhook] Error handling client message:`, error);
    }
  }

  // Acknowledge webhook immediately
  res.status(200).json({ status: 'received' });
}
