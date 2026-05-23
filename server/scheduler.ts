import cron from 'node-cron';
import { supabaseAdmin } from './supabase';
import { sendWhatsAppMessage } from './evolution';

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

      // 1. 3-Tier sequential follow-ups for active negotiations
      if (
        (conv.stage === 'novo' || conv.stage === 'cotado' || conv.stage === 'sinal_solicitado') &&
        (lastMsg.sender === 'IA' || lastMsg.sender === 'ADMIN')
      ) {
        // Define follow-up message pools for different tiers
        const TIER1_SINAL = [
          'Olá! O bloqueio de segurança da data expira em breve e precisarei liberar a lancha. Conseguiram decidir? 🙏',
          'Oi! Passando para lembrar que a data ainda está bloqueada para você, mas por pouco tempo. Conseguiram alinhar com o pessoal? 😊',
          'Olá! Conseguimos segurar a lancha até agora para você, mas há outros clientes interessados. Conseguimos fechar? 🛥️',
          'Oi! Tudo bem? Conseguiu ver o pix do sinal? Quero muito garantir essa navegação para vocês! ⚓'
        ];

        const TIER1_GERAL = [
          'Oi! Tudo bem? Passando para saber se ficou alguma dúvida sobre as lanchas ou se gostaria de ajustar algum detalhe do passeio! 🛥️',
          'Olá! 😊 Ficou alguma dúvida sobre as opções de lanchas que conversamos? Se quiser, posso ajustar o roteiro ou o número de pessoas!',
          'Oi! Passando para saber se o pessoal gostou da lancha! Tem alguma dúvida que eu possa te ajudar a esclarecer para fecharmos? 🚤',
          'Olá! Como estão os planos para o passeio? Se precisar de mais informações sobre o embarque ou os barcos, estou por aqui! ⚓'
        ];

        const TIER2_SINAL = [
          'Oi! Consigo te ajudar com alguma facilidade de pagamento (como parcelamento) para fecharmos agora e garantir a lancha? 💳',
          'Passando para avisar que a procura para essa data aumentou bastante. Consigo confirmar o recebimento do sinal para travar a reserva? 🛥️',
          'Temos apenas mais um horário de saída disponível para essa data. Quer que eu gere um novo link de pagamento para facilitar? ⚓'
        ];

        const TIER2_GERAL = [
          'Olha, selecionei as melhores lanchas para o seu perfil. Tem algum detalhe (como valor ou marinheiro) que esteja impedindo a gente de fechar? Consigo ver uma condição especial! 😉',
          'Você prefere um passeio mais focado em praias calmas ou agito (como o Caixa d’Aço)? Posso te ajudar a decidir a melhor rota para o seu grupo! 🏖️',
          'Quer fazer uma chamada rápida de 2 minutinhos para tirarmos as dúvidas e fecharmos o barco ideal? 📞'
        ];

        const TIER3_SINAL = [
          'Bom dia! Tudo bem? Conseguiram definir sobre o passeio? A lancha ainda está disponível, mas o bloqueio temporário precisará ser liberado hoje. Podemos confirmar? 🛥️',
          'Olá! Passando para dar uma última olhada se conseguimos manter a sua reserva. Se ainda tiver interesse, me avise para eu não liberar a data para outros clientes! 🙏'
        ];

        const TIER3_GERAL = [
          'Bom dia! 😊 Passando para te desejar um ótimo dia! Se ainda estiver planejando o passeio de lancha, tenho algumas vagas remanescentes com condições super especiais para fecharmos hoje. O que acha? 🚤',
          'Olá! Tudo bem? Conseguiram alinhar a data com o grupo? Se quiserem alterar o barco para um tamanho diferente para caber no orçamento de todos, me avise que eu te mando novas opções! ⚓'
        ];

        const lastMsgIsTier1 = 
          TIER1_SINAL.some(text => lastMsg.content.includes(text)) || 
          TIER1_GERAL.some(text => lastMsg.content.includes(text));

        const lastMsgIsTier2 = 
          TIER2_SINAL.some(text => lastMsg.content.includes(text)) || 
          TIER2_GERAL.some(text => lastMsg.content.includes(text));

        const lastMsgIsTier3 = 
          TIER3_SINAL.some(text => lastMsg.content.includes(text)) || 
          TIER3_GERAL.some(text => lastMsg.content.includes(text));

        // TIER 1: 30 minutes of initial silence
        if (!lastMsgIsTier1 && !lastMsgIsTier2 && !lastMsgIsTier3 && msSinceLastMsg >= THIRTY_MINUTES) {
          let followUpText = '';
          if (conv.stage === 'sinal_solicitado') {
            const idx = Math.floor(Math.random() * TIER1_SINAL.length);
            followUpText = TIER1_SINAL[idx];
          } else {
            const idx = Math.floor(Math.random() * TIER1_GERAL.length);
            followUpText = TIER1_GERAL[idx];
          }
          await sendFollowUp(conv.id, conv.contact_phone, followUpText);
          continue;
        }

        // TIER 2: 3 hours of silence after TIER 1 has been sent
        if (lastMsgIsTier1 && msSinceLastMsg >= THREE_HOURS) {
          let followUpText = '';
          if (conv.stage === 'sinal_solicitado') {
            const idx = Math.floor(Math.random() * TIER2_SINAL.length);
            followUpText = TIER2_SINAL[idx];
          } else {
            const idx = Math.floor(Math.random() * TIER2_GERAL.length);
            followUpText = TIER2_GERAL[idx];
          }
          await sendFollowUp(conv.id, conv.contact_phone, followUpText);
          continue;
        }

        // TIER 3: Next day (18+ hours) of silence after TIER 2 has been sent
        if (lastMsgIsTier2 && msSinceLastMsg >= EIGHTEEN_HOURS) {
          let followUpText = '';
          if (conv.stage === 'sinal_solicitado') {
            const idx = Math.floor(Math.random() * TIER3_SINAL.length);
            followUpText = TIER3_SINAL[idx];
          } else {
            const idx = Math.floor(Math.random() * TIER3_GERAL.length);
            followUpText = TIER3_GERAL[idx];
          }
          await sendFollowUp(conv.id, conv.contact_phone, followUpText);
          continue;
        }
      } 
      
      else if (conv.stage === 'pix_enviado') {
        // Rule 1: 4h follow-up
        // Rule 2: 24h follow-up
        const sent4h = messages.some(m => 
          m.sender === 'IA' && 
          m.content.includes('conseguiu fazer o sinal')
        );

        const sent24h = messages.some(m => 
          m.sender === 'IA' && 
          m.content.includes('interesse na reserva')
        );

        if (!sent4h && msSinceLastMsg >= FOUR_HOURS) {
          const text = 'Oi! Tudo bem? Passando pra ver se conseguiu fazer o sinal — a data ainda está disponível pra vocês 🛥️';
          await sendFollowUp(conv.id, conv.contact_phone, text);
        } 
        
        else if (sent4h && !sent24h && msSinceLastMsg >= TWENTY_HOURS) {
          // It's been 20 hours since the 4h follow-up message (approx 24h since original user cold point)
          const formattedDate = formatDate(conv.target_date);
          const dateSnippet = formattedDate ? ` do dia ${formattedDate}` : '';
          const text = `Bom dia! 😊 Passando pra ver se ainda tem interesse na reserva${dateSnippet}. Não quero que percam a data — a agenda fecha rápido nos feriados 🤩`;
          await sendFollowUp(conv.id, conv.contact_phone, text);
        }
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error running follow-up scheduler:', error);
  }
}

/**
 * Sends the follow-up message via Evolution API and registers it in the DB.
 */
async function sendFollowUp(conversationId: string, phone: string, text: string): Promise<void> {
  console.log(`[Scheduler] Sending follow-up to ${phone}: "${text.substring(0, 30)}..."`);
  
  try {
    // 1. Send via WhatsApp
    await sendWhatsAppMessage(phone, text);

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

        // Send WhatsApp message
        const text = `Como foi o dia a bordo? ✨\nSeu feedback é muito importante pra gente!\n\n⭐ Avalie no Google:\n${googleReviewUrl}\n\n🛥️ Avalie o barco e o marinheiro:\n${siteReviewUrl}`;
        await sendWhatsAppMessage(phone, text);

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
      // Check if we already messaged them today with a 9am reminder
      const { data: todayMessages, error: msgError } = await supabaseAdmin
        .from('ia_messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .gte('created_at', `${localDate}T00:00:00Z`);

      if (msgError) {
        console.error(`[Scheduler] Error fetching today's messages for conv ${conv.id}:`, msgError);
        continue;
      }

      const alreadySent = (todayMessages || []).some(m => 
        m.sender === 'IA' && 
        (m.content.includes('saída oficial') || m.content.includes('garantir a navegação'))
      );

      if (!alreadySent) {
        const text = `Bom dia! 🛥️ Vi que seu passeio estava planejado para hoje. Como a saída oficial das lanchas é às 10h, ainda dá tempo de aproveitar o dia e garantir a navegação! Vamos fechar?`;
        await sendFollowUp(conv.id, conv.contact_phone, text);
      }
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

    // 4. Send message
    await sendWhatsAppMessage(ownersGroupJid, reminderText);

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

