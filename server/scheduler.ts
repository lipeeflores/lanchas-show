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

      // Check stages and send appropriate follow-ups
      if (conv.stage === 'cotado') {
        // Rule: last message > 24h ago
        if (msSinceLastMsg >= TWENTY_FOUR_HOURS) {
          // Prevent double follow-up (check if we already sent this exact message)
          const alreadySent = messages.some(m => 
            m.sender === 'IA' && 
            m.content.includes('Conseguiu ver as opções')
          );

          if (!alreadySent) {
            const text = 'Oi! Tudo bem? 😊 Conseguiu ver as opções que te mandei? A agenda para essa data ainda está disponível — mas pode fechar rápido 🛥️';
            await sendFollowUp(conv.id, conv.contact_phone, text);
          }
        }
      } 
      
      else if (conv.stage === 'sinal_solicitado') {
        // Rule: last message > 24h ago (equivalent to: Lead disse "vou confirmar com o pessoal")
        if (msSinceLastMsg >= TWENTY_FOUR_HOURS) {
          const alreadySent = messages.some(m => 
            m.sender === 'IA' && 
            m.content.includes('Conseguiu confirmar com o pessoal')
          );

          if (!alreadySent) {
            const text = 'Oi! Conseguiu confirmar com o pessoal? 🤩 Quero garantir essa data pra vocês antes que feche!';
            await sendFollowUp(conv.id, conv.contact_phone, text);
          }
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
export function startScheduler(): void {
  // '0 * * * *' = every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    await checkFollowUps();
  });
  console.log('[Scheduler] Hourly follow-up cron job initialized.');
}
