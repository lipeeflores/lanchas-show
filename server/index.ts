import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { handleWhatsAppWebhook } from './webhook';
import { ensureInstanceCreated, getConnectionState, getConnectQrCode, sendWhatsAppMessage, simulateTypingAndSend } from './evolution';
import { startScheduler } from './scheduler';
import { supabaseAdmin } from './supabase';
import { handleAsaasWebhook } from './webhook_asaas';
import { handleDocusealWebhook } from './webhook_docuseal';
import { requireAdmin, signSession, validateAdminCredentials } from './auth';
import { registerAdminRoutes } from './admin_routes';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const app = express();
const port = process.env.PORT || 3001;
const BOOT_TIME = new Date().toISOString();

// Capture the raw body for webhook signature verification (DocuSeal HMAC).
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));

// Health check — useful for Railway/Vercel uptime and deployment verification.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, boot: BOOT_TIME });
});

// ──────────────────────────────────────────────────────────────────
// Webhooks (each handler validates its own signature/token).
// ──────────────────────────────────────────────────────────────────
app.post('/api/asaas/webhook', handleAsaasWebhook);
app.post('/api/docuseal/webhook', handleDocusealWebhook);

// Evolution API webhook (using wildcard to capture event sub-paths).
app.post('/api/whatsapp/webhook*', (req, res, next) => {
  console.log(`[Server] Webhook received: ${req.method} ${req.url}`);
  next();
}, handleWhatsAppWebhook);

// ──────────────────────────────────────────────────────────────────
// Admin authentication
// ──────────────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!validateAdminCredentials(username, password)) {
    res.status(401).json({ success: false, error: 'Credenciais inválidas.' });
    return;
  }
  const token = signSession(username);
  res.json({ success: true, token });
});

// ──────────────────────────────────────────────────────────────────
// Protected admin endpoints
// ──────────────────────────────────────────────────────────────────

// WhatsApp connection status and QR code endpoint.
app.get('/api/whatsapp/connect', requireAdmin, async (_req, res) => {
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

// Toggle conversation mode (AI_CONTROL vs HUMAN_CONTROL).
app.patch('/api/conversations/:id/mode', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

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

// All admin write endpoints (under /api/admin/*) require a valid session.
app.use('/api/admin', (req, res, next) => {
  if (req.path === '/login') return next();
  return requireAdmin(req, res, next);
});
registerAdminRoutes(app);

// Send manual message from Admin.
app.post('/api/conversations/:id/messages', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    res.status(400).json({ success: false, error: 'Mensagem vazia' });
    return;
  }

  try {
    const { data: conv, error: convError } = await supabaseAdmin
      .from('ia_conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (convError || !conv) {
      throw new Error(convError?.message || 'Conversa não encontrada');
    }

    // Mesma mensagem manual do admin também passa por typing simulation, pra
    // que o cliente perceba "alguém está digitando" — indistinguível de IA ou humano.
    await simulateTypingAndSend(conv.contact_phone, content);

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

  await ensureInstanceCreated();
  startScheduler();
});
