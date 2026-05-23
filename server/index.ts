import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { handleWhatsAppWebhook } from './webhook';
import { ensureInstanceCreated, getConnectionState, getConnectQrCode, sendWhatsAppMessage } from './evolution';
import { startScheduler } from './scheduler';
import { supabaseAdmin } from './supabase';
import { handleAsaasWebhook } from './webhook_asaas';
import { handleDocusealWebhook } from './webhook_docuseal';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Webhooks
app.post('/api/asaas/webhook', handleAsaasWebhook);
app.post('/api/docuseal/webhook', handleDocusealWebhook);

// Routes
// 1. Webhook endpoint from Evolution API (using wildcard to capture event sub-paths)
app.post('/api/whatsapp/webhook*', (req, res, next) => {
  console.log(`[Server] Webhook received: ${req.method} ${req.url}`);
  next();
}, handleWhatsAppWebhook);

// 2. WhatsApp connection status and QR code endpoint
app.get('/api/whatsapp/connect', async (req, res) => {
  try {
    const state = await getConnectionState();
    let qr = null;
    
    if (state !== 'open') {
      qr = await getConnectQrCode();
    }
    
    res.json({
      success: true,
      state,
      qr
    });
  } catch (error: any) {
    console.error('[Server] Error in /api/whatsapp/connect:', error);
    res.status(500).json({ success: false, error: error.message || 'Erro ao consultar status do WhatsApp' });
  }
});

// 3. Toggle conversation mode (AI_CONTROL vs HUMAN_CONTROL)
app.patch('/api/conversations/:id/mode', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // should be 'AI_CONTROL' or 'HUMAN_CONTROL'

  if (status !== 'AI_CONTROL' && status !== 'HUMAN_CONTROL') {
    res.status(400).json({ success: false, error: 'Status inválido. Deve ser AI_CONTROL ou HUMAN_CONTROL.' });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('ia_conversations')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, conversation: data });
  } catch (error: any) {
    console.error(`[Server] Error toggling mode for conversation ${id}:`, error);
    res.status(500).json({ success: false, error: error.message || 'Erro ao alterar modo da conversa' });
  }
});

// 4. Send manual message from Admin
app.post('/api/conversations/:id/messages', async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    res.status(400).json({ success: false, error: 'Mensagem vazia' });
    return;
  }

  try {
    // 1. Get conversation to retrieve contact phone
    const { data: conv, error: convError } = await supabaseAdmin
      .from('ia_conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (convError || !conv) {
      throw new Error(convError?.message || 'Conversa não encontrada');
    }

    // 2. Send via WhatsApp
    await sendWhatsAppMessage(conv.contact_phone, content);

    // 3. Save as ADMIN in database
    const { data: message, error: insertError } = await supabaseAdmin
      .from('ia_messages')
      .insert({
        conversation_id: id,
        sender: 'ADMIN',
        content: content
      })
      .select()
      .single();

    if (insertError) throw insertError;

    res.json({ success: true, message });
  } catch (error: any) {
    console.error(`[Server] Error sending manual message:`, error);
    res.status(500).json({ success: false, error: error.message || 'Erro ao enviar mensagem manual' });
  }
});

// Start Server
app.listen(port, async () => {
  console.log(`[Server] Backend listening on port ${port}`);
  
  // Initialize services
  await ensureInstanceCreated();
  startScheduler();
});
