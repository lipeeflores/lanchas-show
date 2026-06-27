/**
 * Authenticated write endpoints for the admin panel. Every route here uses
 * supabaseAdmin (service_role) and bypasses RLS — therefore every route MUST be
 * wrapped in requireAdmin, which is applied via app.use() in index.ts.
 */
import { Express, Request, Response } from 'express';
import { supabaseAdmin } from './supabase';

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

/** Picks only the listed keys from `src`. Drops undefined values. */
function pick<T extends Record<string, any>>(src: T, allowed: readonly (keyof T | string)[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of allowed) {
    const k = key as string;
    if (src && Object.prototype.hasOwnProperty.call(src, k) && src[k] !== undefined) {
      out[k] = src[k];
    }
  }
  return out;
}

function sendError(res: Response, status: number, error: string): void {
  res.status(status).json({ success: false, error });
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch(err => {
      console.error('[admin_routes] Unhandled error:', err);
      if (!res.headersSent) {
        sendError(res, 500, err?.message || 'Erro interno');
      }
    });
  };
}

// ──────────────────────────────────────────────────────────────────
// Allowed field whitelists per table (defense-in-depth against payload pollution)
// ──────────────────────────────────────────────────────────────────

const CUSTOMER_FIELDS = [
  'full_name', 'email', 'phone', 'document_cpf', 'document_rg',
  'address', 'notes', 'tags', 'rating_stars', 'rating_notes'
] as const;

const RESERVATION_FIELDS = [
  'boat_id', 'customer_id', 'start_date', 'end_date', 'status',
  'total_price', 'paid_amount', 'base_price_closed', 'floating_mat_status',
  'floating_mat_value', 'extra_hours_qty', 'extra_hours_total_value',
  'total_reservation_value', 'passenger_count', 'boarding_point', 'destination',
  'negotiation_status', 'payment_link_url', 'contract_link_url',
  'tapete_status', 'docuseal_submission_id', 'commission_value', 'notes'
] as const;

const PARTNER_FIELDS = [
  'name', 'management_level', 'contact_phone', 'phone', 'ical_url', 'bank_account_info'
] as const;

const BOAT_FIELDS = [
  'name', 'capacity', 'size', 'image', 'image_urls', 'hourly_rate', 'daily_rate',
  'original_rate', 'boarding_points', 'allowed_destinations',
  'price_low_season', 'price_high_season', 'price_weekend_holiday',
  'min_price_low_season', 'min_price_high_season', 'min_price_weekend_holiday',
  'has_floating_mat', 'floating_mat_price', 'extra_hour_price',
  'status', 'partner_id', 'owner_type', 'partner_net_value', 'rules_and_info',
  'description', 'include_captain', 'include_fuel', 'catalogo_url'
] as const;

const BOAT_EXPENSE_FIELDS = [
  'boat_id', 'reservation_id', 'type', 'category', 'amount', 'date', 'description'
] as const;

const ACCOUNTS_PAYABLE_FIELDS = [
  'due_date', 'amount', 'payee_type', 'partner_id', 'reservation_id',
  'description', 'status', 'boat_expense_id'
] as const;

const CASH_TRANSACTION_FIELDS = [
  'type', 'amount', 'description', 'reservation_id'
] as const;

const ROUTE_FIELDS = [
  'boat_id', 'embarkation_point', 'destination_point',
  'price_low_season', 'min_price_low_season',
  'price_weekend_holiday', 'min_price_weekend_holiday',
  'price_high_season', 'min_price_high_season'
] as const;

// ──────────────────────────────────────────────────────────────────
// Route registration
// ──────────────────────────────────────────────────────────────────

export function registerAdminRoutes(app: Express): void {

  // ════════════════════════════════════════════════════════════════
  // READ endpoints
  // ════════════════════════════════════════════════════════════════

  app.get('/api/admin/system-alerts', asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('system_alerts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.get('/api/admin/customers', asyncRoute(async (req, res) => {
    const { id, search } = req.query as Record<string, string>;
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('customers').select('*').eq('id', id).single();
      if (error) { sendError(res, 404, error.message); return; }
      res.json({ success: true, data });
      return;
    }
    let query = supabaseAdmin
      .from('customers')
      .select('*, reservations(total_price)')
      .order('created_at', { ascending: false });
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,document_cpf.ilike.%${search}%`
      );
    }
    const { data, error } = await query;
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.get('/api/admin/reservations', asyncRoute(async (req, res) => {
    const { start, end, month, year } = req.query as Record<string, string>;
    let query = supabaseAdmin
      .from('reservations')
      .select('*, boats(id, name, owner_type, partners(name)), customers(full_name, phone, tags, rating_stars, rating_notes)')
      .order('start_date', { ascending: false });
    if (month && year) {
      query = query.like('start_date', `${year}-${month.padStart(2, '0')}%`);
    } else {
      if (start) query = query.gte('start_date', start);
      if (end) query = query.lte('start_date', end);
    }
    const { data, error } = await query;
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.get('/api/admin/cash-transactions', asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('cash_transactions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.get('/api/admin/boats', asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('boats')
      .select('*, partners(name, management_level, bank_account_info, contact_phone), boat_expenses(*)')
      .order('name');
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.get('/api/admin/boats/:id/routes', asyncRoute(async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('boat_routes_pricing').select('*').eq('boat_id', id);
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.get('/api/admin/partners', asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('partners')
      .select('id, name, phone, contact_phone, bank_account_info, management_level, ical_url')
      .order('name');
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.get('/api/admin/accounts-payable', asyncRoute(async (req, res) => {
    const { status } = req.query as Record<string, string>;
    let query = supabaseAdmin
      .from('accounts_payable')
      .select('*, partners(name)')
      .order('due_date');
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.get('/api/admin/boat-expenses', asyncRoute(async (req, res) => {
    const { limit } = req.query as Record<string, string>;
    let query = supabaseAdmin
      .from('boat_expenses')
      .select('*, boats(name)')
      .order('date', { ascending: false });
    if (limit) query = query.limit(parseInt(limit, 10));
    const { data, error } = await query;
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.get('/api/admin/ia-conversations', asyncRoute(async (req, res) => {
    const { since } = req.query as Record<string, string>;
    let query = supabaseAdmin
      .from('ia_conversations')
      .select('*')
      .order('last_message_at', { ascending: false });
    if (since) query = query.gte('created_at', since);
    const { data, error } = await query;
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.get('/api/admin/ia-messages', asyncRoute(async (req, res) => {
    const { conversation_id, since } = req.query as Record<string, string>;
    if (!conversation_id && !since) {
      sendError(res, 400, 'conversation_id ou since é obrigatório');
      return;
    }
    let query = supabaseAdmin
      .from('ia_messages')
      .select('*')
      .order('created_at');
    if (conversation_id) query = query.eq('conversation_id', conversation_id);
    if (since) query = query.gte('created_at', since);
    const { data, error } = await query;
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.get('/api/admin/ia-campaigns', asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('ia_campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.get('/api/admin/evaluations', asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('evaluations')
      .select('*, boats(name)')
      .order('created_at', { ascending: false });
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.delete('/api/admin/evaluations/:id', asyncRoute(async (req, res) => {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('evaluations').delete().eq('id', id);
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true });
  }));

  app.get('/api/admin/contratos-template', asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('contratos_template')
      .select('html_content')
      .eq('id', 'default')
      .single();
    if (error) { sendError(res, 404, error.message); return; }
    res.json({ success: true, data });
  }));

  // ════════════════════════════════════════════════════════════════
  // WRITE endpoints
  // ════════════════════════════════════════════════════════════════

  // ── ia_campaigns ────────────────────────────────────────────────
  app.patch('/api/admin/ia-campaigns/:id/approve', asyncRoute(async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('ia_campaigns')
      .update({ status: 'APPROVED', approved_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  // ── customers ───────────────────────────────────────────────────
  app.post('/api/admin/customers', asyncRoute(async (req, res) => {
    const payload = pick(req.body || {}, CUSTOMER_FIELDS);
    if (!payload.full_name) { sendError(res, 400, 'full_name é obrigatório'); return; }
    const { data, error } = await supabaseAdmin
      .from('customers')
      .insert(payload)
      .select()
      .single();
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.patch('/api/admin/customers/:id', asyncRoute(async (req, res) => {
    const { id } = req.params;
    const payload = pick(req.body || {}, CUSTOMER_FIELDS);
    const { data, error } = await supabaseAdmin
      .from('customers')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  // ── reservations ────────────────────────────────────────────────
  app.post('/api/admin/reservations', asyncRoute(async (req, res) => {
    const payload = pick(req.body || {}, RESERVATION_FIELDS);
    if (!payload.boat_id || !payload.customer_id) {
      sendError(res, 400, 'boat_id e customer_id são obrigatórios');
      return;
    }
    const { data, error } = await supabaseAdmin
      .from('reservations')
      .insert(payload)
      .select('id')
      .single();
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.patch('/api/admin/reservations/:id', asyncRoute(async (req, res) => {
    const { id } = req.params;
    const payload = pick(req.body || {}, RESERVATION_FIELDS);
    const { data, error } = await supabaseAdmin
      .from('reservations')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.delete('/api/admin/reservations/:id', asyncRoute(async (req, res) => {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('reservations')
      .delete()
      .eq('id', id);
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true });
  }));

  // ── cash_transactions ───────────────────────────────────────────
  app.post('/api/admin/cash-transactions', asyncRoute(async (req, res) => {
    const payload = pick(req.body || {}, CASH_TRANSACTION_FIELDS);
    if (!payload.type || !payload.amount || !payload.description) {
      sendError(res, 400, 'type, amount e description são obrigatórios');
      return;
    }
    const { data, error } = await supabaseAdmin
      .from('cash_transactions')
      .insert(payload)
      .select()
      .single();
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  // ── accounts_payable ────────────────────────────────────────────
  app.post('/api/admin/accounts-payable', asyncRoute(async (req, res) => {
    const payload = pick(req.body || {}, ACCOUNTS_PAYABLE_FIELDS);
    if (!payload.amount || !payload.description || !payload.payee_type) {
      sendError(res, 400, 'amount, description e payee_type são obrigatórios');
      return;
    }
    const { data, error } = await supabaseAdmin
      .from('accounts_payable')
      .insert(payload)
      .select()
      .single();
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.patch('/api/admin/accounts-payable/:id', asyncRoute(async (req, res) => {
    const { id } = req.params;
    const payload = pick(req.body || {}, ACCOUNTS_PAYABLE_FIELDS);
    const { data, error } = await supabaseAdmin
      .from('accounts_payable')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.delete('/api/admin/accounts-payable/:id', asyncRoute(async (req, res) => {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('accounts_payable')
      .delete()
      .eq('id', id);
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true });
  }));

  // ── partners ────────────────────────────────────────────────────
  app.post('/api/admin/partners', asyncRoute(async (req, res) => {
    const payload = pick(req.body || {}, PARTNER_FIELDS);
    if (!payload.name || !payload.management_level) {
      sendError(res, 400, 'name e management_level são obrigatórios');
      return;
    }
    const { data, error } = await supabaseAdmin
      .from('partners')
      .insert(payload)
      .select()
      .single();
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.patch('/api/admin/partners/:id', asyncRoute(async (req, res) => {
    const { id } = req.params;
    const payload = pick(req.body || {}, PARTNER_FIELDS);
    const { data, error } = await supabaseAdmin
      .from('partners')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.delete('/api/admin/partners/:id', asyncRoute(async (req, res) => {
    const { id } = req.params;
    // Detach boats first (same behaviour as the old frontend code)
    await supabaseAdmin.from('boats').update({ partner_id: null }).eq('partner_id', id);
    const { error } = await supabaseAdmin.from('partners').delete().eq('id', id);
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true });
  }));

  // ── boats (with nested routes) ──────────────────────────────────
  // body shape: { boat: {...}, routes?: [{...}, ...] }
  // If routes is provided, all existing routes for the boat are replaced.
  app.post('/api/admin/boats', asyncRoute(async (req, res) => {
    const boatPayload = pick(req.body?.boat || {}, BOAT_FIELDS);
    const routes = Array.isArray(req.body?.routes) ? req.body.routes : null;
    if (!boatPayload.name) { sendError(res, 400, 'name é obrigatório'); return; }

    const { data: inserted, error } = await supabaseAdmin
      .from('boats')
      .insert(boatPayload)
      .select('id')
      .single();
    if (error || !inserted) { sendError(res, 400, error?.message || 'Erro ao criar lancha'); return; }

    if (routes) {
      const routePayloads = routes.map((r: any) => ({ ...pick(r, ROUTE_FIELDS), boat_id: inserted.id }));
      if (routePayloads.length > 0) {
        const { error: insErr } = await supabaseAdmin.from('boat_routes_pricing').insert(routePayloads);
        if (insErr) { sendError(res, 400, insErr.message); return; }
      }
    }

    res.json({ success: true, data: inserted });
  }));

  app.patch('/api/admin/boats/:id', asyncRoute(async (req, res) => {
    const { id } = req.params;
    const boatPayload = pick(req.body?.boat || {}, BOAT_FIELDS);
    const routes = Array.isArray(req.body?.routes) ? req.body.routes : null;

    const { error } = await supabaseAdmin
      .from('boats')
      .update(boatPayload)
      .eq('id', id);
    if (error) { sendError(res, 400, error.message); return; }

    if (routes) {
      // Replace all routes for this boat
      const { error: delErr } = await supabaseAdmin
        .from('boat_routes_pricing')
        .delete()
        .eq('boat_id', id);
      if (delErr) { sendError(res, 400, delErr.message); return; }

      if (routes.length > 0) {
        const routePayloads = routes.map((r: any) => ({ ...pick(r, ROUTE_FIELDS), boat_id: id }));
        const { error: insErr } = await supabaseAdmin
          .from('boat_routes_pricing')
          .insert(routePayloads);
        if (insErr) { sendError(res, 400, insErr.message); return; }
      }
    }

    res.json({ success: true });
  }));

  app.delete('/api/admin/boats/:id', asyncRoute(async (req, res) => {
    const { id } = req.params;
    // Cascade: routes, expenses, reservations, then boat itself.
    await supabaseAdmin.from('boat_routes_pricing').delete().eq('boat_id', id);
    await supabaseAdmin.from('boat_expenses').delete().eq('boat_id', id);
    await supabaseAdmin.from('reservations').delete().eq('boat_id', id);
    const { error } = await supabaseAdmin.from('boats').delete().eq('id', id);
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true });
  }));

  // ── boat_expenses ───────────────────────────────────────────────
  app.post('/api/admin/boat-expenses', asyncRoute(async (req, res) => {
    const payload = pick(req.body || {}, BOAT_EXPENSE_FIELDS);
    if (!payload.boat_id || !payload.type || !payload.amount) {
      sendError(res, 400, 'boat_id, type e amount são obrigatórios');
      return;
    }
    const { data, error } = await supabaseAdmin
      .from('boat_expenses')
      .insert(payload)
      .select()
      .single();
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  app.delete('/api/admin/boat-expenses/:id', asyncRoute(async (req, res) => {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('boat_expenses')
      .delete()
      .eq('id', id);
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true });
  }));

  // ── global_settings (upsert one row by key) ─────────────────────
  app.put('/api/admin/global-settings', asyncRoute(async (req, res) => {
    const { key, value } = req.body || {};
    if (!key) { sendError(res, 400, 'key é obrigatório'); return; }
    const { data, error } = await supabaseAdmin
      .from('global_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .select()
      .single();
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));

  // ── contratos_template (single 'default' row) ──────────────────
  app.put('/api/admin/contratos-template', asyncRoute(async (req, res) => {
    const { html_content } = req.body || {};
    if (typeof html_content !== 'string') {
      sendError(res, 400, 'html_content é obrigatório');
      return;
    }
    const { data, error } = await supabaseAdmin
      .from('contratos_template')
      .upsert({ id: 'default', html_content, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) { sendError(res, 400, error.message); return; }
    res.json({ success: true, data });
  }));
}
