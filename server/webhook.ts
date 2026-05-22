import { Request, Response } from 'express';
import { supabaseAdmin } from './supabase';
import { sendWhatsAppMessage } from './evolution';
import { getAiResponse } from './groq';
import { messageQueue } from './queue';

/**
 * Extracts text content from various Evolution API message types.
 */
function extractMessageText(messageObj: any): string {
  if (!messageObj) return '';
  if (typeof messageObj === 'string') return messageObj;
  
  if (messageObj.conversation) return messageObj.conversation;
  if (messageObj.extendedTextMessage?.text) return messageObj.extendedTextMessage.text;
  
  // Non-text message indicators
  if (messageObj.imageMessage) return '[Foto]';
  if (messageObj.documentMessage) return '[Documento]';
  if (messageObj.audioMessage) return '[Áudio]';
  if (messageObj.videoMessage) return '[Vídeo]';
  if (messageObj.stickerMessage) return '[Figurinha]';
  
  return '';
}

/**
 * Webhook handler for Evolution API.
 */
export async function handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  const body = req.body;

  // Evolution API sends 'messages.upsert' or 'MESSAGES_UPSERT'
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

  // Extract message text content
  const textContent = extractMessageText(data.message);
  if (!textContent) {
    res.status(200).json({ status: 'ignored', reason: 'Empty text or unsupported message type' });
    return;
  }

  console.log(`[Webhook] Event: ${event} | Phone: ${phone} | fromMe: ${fromMe} | Msg: "${textContent.substring(0, 30)}..."`);

  // Enqueue message processing to prevent concurrency issues per phone number
  messageQueue.enqueue(phone, async () => {
    try {
      // 1. Get or create conversation in DB
      let { data: conversation, error: convError } = await supabaseAdmin
        .from('ia_conversations')
        .select('*')
        .eq('contact_phone', phone)
        .maybeSingle();

      if (convError) throw convError;

      if (!conversation) {
        // Create new conversation
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
        console.log(`[Webhook] Created new conversation for phone ${phone}.`);
      }

      if (fromMe) {
        // Message sent from our side (either by IA or manually by the Admin on their phone)
        // Check if this message was already saved (e.g. by our own script)
        const { data: existing, error: existError } = await supabaseAdmin
          .from('ia_messages')
          .select('id')
          .eq('conversation_id', conversation.id)
          .eq('content', textContent)
          .limit(1);

        if (existError) throw existError;

        if (existing && existing.length > 0) {
          // Already registered, skip
          console.log(`[Webhook] Outgoing message already registered. Skipping.`);
          return;
        }

        // Outgoing message not in DB -> Sent manually by admin via phone -> Save as ADMIN
        const { error: insertError } = await supabaseAdmin
          .from('ia_messages')
          .insert({
            conversation_id: conversation.id,
            sender: 'ADMIN',
            content: textContent
          });

        if (insertError) throw insertError;
        console.log(`[Webhook] Outgoing message saved as ADMIN (manual reply via phone).`);
      } else {
        // Incoming message from the Client
        // 1. Save client's message in the DB
        const { error: insertError } = await supabaseAdmin
          .from('ia_messages')
          .insert({
            conversation_id: conversation.id,
            sender: 'CLIENT',
            content: textContent
          });

        if (insertError) throw insertError;
        console.log(`[Webhook] Incoming message saved as CLIENT.`);

        // 2. Check conversation mode
        if (conversation.status === 'AI_CONTROL') {
          // Fetch complete history to feed Groq (ordered chronologically)
          const { data: history, error: historyError } = await supabaseAdmin
            .from('ia_messages')
            .select('sender, content')
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: true });

          if (historyError) throw historyError;

          // Call Groq to generate response
          const aiResponseText = await getAiResponse(conversation.id, history || []);

          // Send message to WhatsApp via Evolution API
          await sendWhatsAppMessage(phone, aiResponseText);

          // Save AI response in DB
          const { error: aiInsertError } = await supabaseAdmin
            .from('ia_messages')
            .insert({
              conversation_id: conversation.id,
              sender: 'IA',
              content: aiResponseText
            });

          if (aiInsertError) throw aiInsertError;
          console.log(`[Webhook] AI responded successfully and message saved as IA.`);
        } else {
          console.log(`[Webhook] Chat in HUMAN_CONTROL mode. No AI response triggered.`);
        }
      }
    } catch (error) {
      console.error(`[Webhook] Error in enqueued task for phone ${phone}:`, error);
    }
  });

  // Acknowledge webhook immediately
  res.status(200).json({ status: 'received' });
}
