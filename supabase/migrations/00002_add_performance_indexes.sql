-- Migration 00002: Add Performance Indexes for Lanchas Show

-- 1. Optimizing reservations queries (Map, Dashboard, and webhook availability checks)
CREATE INDEX IF NOT EXISTS reservations_boat_id_start_date_idx ON public.reservations(boat_id, start_date);
CREATE INDEX IF NOT EXISTS reservations_customer_id_idx ON public.reservations(customer_id);
CREATE INDEX IF NOT EXISTS reservations_end_date_idx ON public.reservations(end_date);
CREATE INDEX IF NOT EXISTS reservations_status_idx ON public.reservations(status);

-- 2. Optimizing chat & customer matching queries (webhook, CLI, and dashboards)
CREATE INDEX IF NOT EXISTS ia_conversations_contact_phone_idx ON public.ia_conversations(contact_phone);
CREATE INDEX IF NOT EXISTS ia_conversations_stage_created_at_idx ON public.ia_conversations(stage, created_at);
CREATE INDEX IF NOT EXISTS ia_conversations_customer_id_idx ON public.ia_conversations(customer_id);

-- 3. Optimizing chat messages (chat log loading, inactivity checking)
CREATE INDEX IF NOT EXISTS ia_messages_conversation_id_created_at_idx ON public.ia_messages(conversation_id, created_at DESC);

-- 4. Optimizing foreign key columns to speed up joins and cascades
CREATE INDEX IF NOT EXISTS boat_expenses_boat_id_idx ON public.boat_expenses(boat_id);
CREATE INDEX IF NOT EXISTS boat_expenses_reservation_id_idx ON public.boat_expenses(reservation_id);

CREATE INDEX IF NOT EXISTS accounts_payable_partner_id_idx ON public.accounts_payable(partner_id);
CREATE INDEX IF NOT EXISTS accounts_payable_reservation_id_idx ON public.accounts_payable(reservation_id);

CREATE INDEX IF NOT EXISTS cash_transactions_reservation_id_idx ON public.cash_transactions(reservation_id);

CREATE INDEX IF NOT EXISTS consumptions_reservation_id_idx ON public.consumptions(reservation_id);

CREATE INDEX IF NOT EXISTS boat_routes_pricing_boat_id_idx ON public.boat_routes_pricing(boat_id);
