import cron from 'node-cron';
import { supabaseAdmin } from './supabase';
import { simulateTypingAndSend, sendWhatsAppMessage } from './evolution';
import { generateFollowUpMessage, FollowUpKind } from './claude';

const FOUR_HOURS = 4 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const TWENTY_HOURS = 20 * 60 * 60 * 1000;

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // YYYY-MM-DD -> DD/MM/YYYY
  }
  return dateStr;
}

/**
 * Checks all active conversations and sends automatic follow-ups if clients have gone cold.
 */
export async function checkFollowUps(): Promise<void> {
  console.log('[Scheduler] Running follow-up check...');

  // Quiet Hours Policy: Defer automated follow-ups from 22:00 to 08:00 (America/Sao_Paulo timezone)
  const localHourStr = new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
    hour: '2-digit'
  });
  const localHour = parseInt(localHourStr, 10);
  
  if (localHour >= 22 || localHour < 8) {
    console.log(`[Scheduler] Quiet hours active (${localHour}h). Skipping automated follow-ups.`);
    return;
  }

  try {
    // 1. Fetch active conversations (only those controlled by AI)
    const { data: conversations, error: convError } = await supabaseAdmin
      .from('ia_conversations')
      .select('*')
      .eq('status', 'AI_CONTROL');

    if (convError) throw convError;
    if (!conversations || conversations.length === 0) {
      console.log('[Scheduler] No active AI-controlled conversations found.');
      return;
    }

    for (const conv of conversations) {
      // 2. Fetch complete message history for the conversation to analyze context
      const { data: messages, error: msgError } = await supabaseAdmin
        .from('ia_messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false }); // Newest first

      if (msgError) {
        console.error(`[Scheduler] Error fetching messages for conversation ${conv.id}:`, msgError);
        continue;
      }

      if (!messages || messages.length === 0) continue;

      const lastMsg = messages[0];
      const now = Date.now();
      const msSinceLastMsg = now - new Date(lastMsg.created_at).getTime();

      const THIRTY_MINUTES = 30 * 60 * 1000;
      const THREE_HOURS = 3 * 60 * 60 * 1000;
      const EIGHTEEN_HOURS = 18 * 60 * 60 * 1000;

      // Count how many IA/ADMIN messages were sent CONSECUTIVELY after the last CLIENT message.
      // This is how we detect "tier" without fragile substring matching against hardcoded templates.
      let iaMsgsSinceClient = 0;
      for (const m of messages) {
        if (m.sender === 'CLIENT') break;
        if (m.sender === 'IA' || m.sender === 'ADMIN') iaMsgsSinceClient++;
      }

      // Conversion of history into the format expected by generateFollowUpMessage
      const chronologicalHistory = [...messages].reverse().map(m => ({ sender: m.sender, content: m.content }));

      // ── Negotiation follow-ups (novo / cotado / sinal_solicitado) ──
      if (
        (conv.stage === 'novo' || conv.stage === 'cotado' || conv.stage === 'sinal_solicitado') &&
        (lastMsg.sender === 'IA' || lastMsg.sender === 'ADMIN')
      ) {
        const isSinal = conv.stage === 'sinal_solicitado';
        let kind: FollowUpKind | null = null;

        // iaMsgsSinceClient = 1 → AI/admin answered once after client, now silent → first follow-up
        // iaMsgsSinceClient = 2 → AI already pinged once → second follow-up
        // iaMsgsSinceClient = 3 → AI already pinged twice → third (last) follow-up
        // iaMsgsSinceClient ≥ 4 → stop spamming
        if (iaMsgsSinceClient === 1 && msSinceLastMsg >= THIRTY_MINUTES) {
          kind = isSinal ? 'tier1_sinal' : 'tier1_geral';
        } else if (iaMsgsSinceClient === 2 && msSinceLastMsg >= THREE_HOURS) {
          kind = isSinal ? 'tier2_sinal' : 'tier2_geral';
        } else if (iaMsgsSinceClient === 3 && msSinceLastMsg >= EIGHTEEN_HOURS) {
          kind = isSinal ? 'tier3_sinal' : 'tier3_geral';
        }

        if (kind) {
          const text = await generateFollowUpMessage(
            chronologicalHistory,
            kind,
            conv.contact_name,
            conv.contact_phone,
            conv.target_date
          );
          if (text) await sendFollowUp(conv.id, conv.contact_phone, text);
          continue;
        }
      }

      // ── PIX waiting (cliente disse que ia pagar, comprovante não chegou) ──
      else if (conv.stage === 'pix_enviado') {
        let kind: FollowUpKind | null = null;

        if (iaMsgsSinceClient === 1 && msSinceLastMsg >= FOUR_HOURS) {
          kind = 'pix_4h';
        } else if (iaMsgsSinceClient === 2 && msSinceLastMsg >= TWENTY_HOURS) {
          kind = 'pix_24h';
        }

        if (kind) {
          const text = await generateFollowUpMessage(
            chronologicalHistory,
            kind,
            conv.contact_name,
            conv.contact_phone,
            conv.target_date
          );
          if (text) await sendFollowUp(conv.id, conv.contact_phone, text);
          continue;
        }
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error running follow-up scheduler:', error);
  }
}

/**
 * Sends the follow-up message with typing simulation and registers it in the DB.
 */
async function sendFollowUp(conversationId: string, phone: string, text: string): Promise<void> {
  console.log(`[Scheduler] Sending follow-up to ${phone}: "${text.substring(0, 30)}..."`);

  try {
    // 1. Send via WhatsApp with typing indicator + delay
    await simulateTypingAndSend(phone, text);

    // 2. Save in database
    const { error } = await supabaseAdmin
      .from('ia_messages')
      .insert({
        conversation_id: conversationId,
        sender: 'IA',
        content: text
      });

    if (error) throw error;
  } catch (error) {
    console.error(`[Scheduler] Failed to send/save follow-up message for ${phone}:`, error);
  }
}

/**
 * Starts the hourly cron job.
 */
/**
 * Queries yesterday's completed trips (status COMPLETED), and sends WhatsApp evaluations if not already sent.
 */
/**
 * Queries completed trips (status COMPLETED) from today and yesterday, and sends WhatsApp evaluations at 19:00 (or later depending on extra hours).
 */
export async function checkPostTrips(): Promise<void> {
  console.log('[Scheduler] Running post-trip evaluation check...');

  try {
    const now = new Date();
    const localStr = now.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // "YYYY-MM-DD HH:MM:SS"
    const todayStr = localStr.substring(0, 10);
    const currentHour = Number(localStr.substring(11, 13));

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).substring(0, 10);

    // Quiet Hours Policy: Defer automated evaluations from 22:00 to 08:00
    if (currentHour >= 22 || currentHour < 8) {
      console.log(`[Scheduler] Quiet hours active (${currentHour}h). Deferring post-trip evaluations.`);
      return;
    }

    // 1. Query reservations where status is COMPLETED
    const { data: reservations, error: resError } = await supabaseAdmin
      .from('reservations')
      .select('*, customers(*)')
      .eq('status', 'COMPLETED');

    if (resError) throw resError;

    // Filter for trips that happened today or yesterday
    const completedTrips = (reservations || []).filter(res => {
      if (!res.start_date) return false;
      const tripDate = new Date(res.start_date).toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).substring(0, 10);
      return tripDate === todayStr || tripDate === yesterdayStr;
    });

    if (completedTrips.length === 0) {
      console.log('[Scheduler] No completed trips found for today or yesterday.');
      return;
    }

    // 2. Fetch review URLs from global_settings
    const { data: settings } = await supabaseAdmin
      .from('global_settings')
      .select('key, value');

    const settingsMap: Record<string, any> = {};
    (settings || []).forEach(s => { settingsMap[s.key] = s.value; });

    let googleReviewUrl = 'https://www.google.com';
    let siteReviewUrl = 'https://lanchas-show.vercel.app/avaliacao';

    const parseUrl = (val: any) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    };

    if (settingsMap['google_review_url']) {
      googleReviewUrl = parseUrl(settingsMap['google_review_url']);
    }
    if (settingsMap['site_review_url']) {
      siteReviewUrl = parseUrl(settingsMap['site_review_url']);
    }

    for (const res of completedTrips) {
      const tripDate = new Date(res.start_date).toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).substring(0, 10);
      
      // If the trip is today, we check if it is already time to send (19h + extra hours)
      if (tripDate === todayStr) {
        const extraHours = Number(res.extra_hours_qty || 0);
        const targetHour = 19 + extraHours;
        if (currentHour < targetHour) {
          console.log(`[Scheduler] Trip for reservation ${res.id} is scheduled for today but end-hour buffer has not passed yet (target: ${targetHour}h, current: ${currentHour}h).`);
          continue;
        }
      }

      const phone = res.customers?.phone;
      if (!phone) {
        console.warn(`[Scheduler] Reservation ${res.id} has no customer phone, skipping.`);
        continue;
      }

      // Fetch active AI conversation to verify context and send message
      const { data: conv } = await supabaseAdmin
        .from('ia_conversations')
        .select('id')
        .eq('contact_phone', phone)
        .eq('status', 'AI_CONTROL')
        .limit(1)
        .maybeSingle();

      if (conv) {
        // Check if we already sent an evaluation message in the last 2 days to prevent duplicates
        const { data: alreadySentMsg } = await supabaseAdmin
          .from('ia_messages')
          .select('id')
          .eq('conversation_id', conv.id)
          .gte('created_at', `${yesterdayStr}T00:00:00Z`)
          .like('content', '%Como foi o dia a bordo%')
          .limit(1);

        if (alreadySentMsg && alreadySentMsg.length > 0) {
          console.log(`[Scheduler] Evaluation already sent to ${phone} for reservation ${res.id}.`);
          continue;
        }

        console.log(`[Scheduler] Processing completed reservation ${res.id} for client phone ${phone}`);

        // Send WhatsApp message with typing simulation
        const text = `Como foi o dia a bordo? ✨\nSeu feedback é muito importante pra gente!\n\n⭐ Avalie no Google:\n${googleReviewUrl}\n\n🛥️ Avalie o barco e o marinheiro:\n${siteReviewUrl}`;
        await simulateTypingAndSend(phone, text);

        // Save in message history
        await supabaseAdmin
          .from('ia_messages')
          .insert({
            conversation_id: conv.id,
            sender: 'IA',
            content: text
          });

        // Update stage to 'concluido'
        await supabaseAdmin
          .from('ia_conversations')
          .update({ stage: 'concluido' })
          .eq('id', conv.id);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error running post-trip evaluation scheduler:', error);
  }
}

/**
 * Checks if there are any active AI-controlled conversations scheduled for today (target_date = today)
 * that have not closed yet, and proactively messages them at 9:00 AM.
 */
export async function checkSameDay9AmFollowUps(): Promise<void> {
  try {
    const localStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // "YYYY-MM-DD HH:MM:SS"
    const localDate = localStr.substring(0, 10);
    const localHour = Number(localStr.substring(11, 13));

    // We only trigger this during the 9:00 AM hour (9:00 - 9:59)
    if (localHour !== 9) {
      return;
    }

    console.log(`[Scheduler] 9 AM check: looking for same-day bookings on date ${localDate}`);

    const { data: conversations, error: convError } = await supabaseAdmin
      .from('ia_conversations')
      .select('*')
      .eq('status', 'AI_CONTROL')
      .eq('target_date', localDate)
      .in('stage', ['novo', 'cotado', 'sinal_solicitado', 'pix_enviado']);

    if (convError) throw convError;
    if (!conversations || conversations.length === 0) {
      console.log('[Scheduler] No same-day pending conversations found for today.');
      return;
    }

    for (const conv of conversations) {
      // Check if we already messaged them today (any AI message after midnight in SC)
      const { data: todayMessages, error: msgError } = await supabaseAdmin
        .from('ia_messages')
        .select('sender, content, created_at')
        .eq('conversation_id', conv.id)
        .gte('created_at', `${localDate}T00:00:00Z`)
        .order('created_at', { ascending: false });

      if (msgError) {
        console.error(`[Scheduler] Error fetching today's messages for conv ${conv.id}:`, msgError);
        continue;
      }

      const sentSomeTodayByAI = (todayMessages || []).some(m => m.sender === 'IA');
      if (sentSomeTodayByAI) continue; // já mandou alguma coisa hoje

      // Fetch full history (last 20) for the AI to know the context
      const { data: fullHistory } = await supabaseAdmin
        .from('ia_messages')
        .select('sender, content')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const chronological = (fullHistory || []).reverse();

      const text = await generateFollowUpMessage(
        chronological,
        'same_day_9am',
        conv.contact_name,
        conv.contact_phone,
        conv.target_date
      );
      if (text) await sendFollowUp(conv.id, conv.contact_phone, text);
    }
  } catch (error) {
    console.error('[Scheduler] Error in checkSameDay9AmFollowUps:', error);
  }
}

/**
 * Checks if there are active rentals today at 14:00 that have not confirmed boarding yet,
 * and sends a reminder to the owners' group.
 */
export async function checkBoardingReminder(): Promise<void> {
  // Executa apenas na janela das 14:00 - 14:15
  const localTimeStr = new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  const [hour, minute] = localTimeStr.split(':').map(Number);

  if (hour !== 14 || minute > 15) {
    return;
  }

  const localDate = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).substring(0, 10); // YYYY-MM-DD
  const ownersGroupJid = process.env.OWNERS_GROUP_JID;
  if (!ownersGroupJid) {
    console.warn('[Scheduler] OWNERS_GROUP_JID is not defined. Skipping boarding reminder.');
    return;
  }

  try {
    // 1. Query today's active commercial reservations that are NOT COMPLETED
    const { data: reservations, error: resError } = await supabaseAdmin
      .from('reservations')
      .select('*, boats(*)')
      .like('start_date', `${localDate}%`)
      .not('status', 'in', '("COMPLETED","BLOCKED","CANCELLED","NO_SHOW")');

    if (resError) throw resError;
    if (!reservations || reservations.length === 0) {
      console.log('[Scheduler] No pending boardings for today.');
      return;
    }

    // 2. Check if we already sent the boarding reminder today to the owners group
    const { data: groupConversations } = await supabaseAdmin
      .from('ia_conversations')
      .select('id')
      .eq('contact_phone', ownersGroupJid)
      .limit(1)
      .maybeSingle();

    if (groupConversations) {
      const { data: sentMessages, error: msgError } = await supabaseAdmin
        .from('ia_messages')
        .select('id')
        .eq('conversation_id', groupConversations.id)
        .gte('created_at', `${localDate}T00:00:00Z`)
        .like('content', '%já foi realizado o embarque%')
        .limit(1);

      if (!msgError && sentMessages && sentMessages.length > 0) {
        console.log('[Scheduler] Boarding reminder already sent to owners group today.');
        return;
      }
    }

    // 3. Format reminder message listing the boats
    const boatNames = reservations.map(r => r.boats?.name).filter(Boolean);
    if (boatNames.length === 0) return;

    let reminderText = `Olá, pessoal! 🛥️ Consta na agenda passeio(s) programado(s) para hoje, mas o embarque ainda não foi confirmado no sistema:\n\n`;
    boatNames.forEach(name => {
      reminderText += `• *${name}*\n`;
    });
    reminderText += `\nJá foi realizado o embarque? Por favor, respondam aqui no grupo confirmando para que eu possa atualizar a agenda (ex: *"Embarque feito da ${boatNames[0]}"* ou *"embarcou"*).`;

    // 4. Send message with typing simulation
    await simulateTypingAndSend(ownersGroupJid, reminderText);

    // 5. Register in DB
    if (groupConversations) {
      await supabaseAdmin.from('ia_messages').insert({
        conversation_id: groupConversations.id,
        sender: 'IA',
        content: reminderText
      });
    }

    console.log('[Scheduler] Sent boarding reminder to owners group.');

  } catch (error) {
    console.error('[Scheduler] Error in checkBoardingReminder:', error);
  }
}

/**
 * Starts the cron agendador (runs every 15 minutes).
 */
export function startScheduler(): void {
  // '*/15 * * * *' = every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    await checkFollowUps();
    await checkSameDay9AmFollowUps();
    await checkBoardingReminder();
    await checkPostTrips();
  });
  console.log('[Scheduler] 15-minute follow-up, reminder and post-trip evaluation cron job initialized.');
}

