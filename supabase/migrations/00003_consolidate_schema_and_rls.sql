-- Migration 00003: Consolidate schema and tighten RLS
--
-- Goal: bring the migration history in sync with what the application code
-- actually expects, and turn the current "anon can do everything" reality into
-- explicit policies — without breaking the admin UI which today still uses
-- the anon key (no Supabase Auth login yet).
--
-- Notes on RLS strategy:
--   * Public-facing routes (/, /lancha/:id, /avaliacao) need anon SELECT/INSERT on
--     a narrow set of tables.
--   * Admin pages still call Supabase directly with the anon key (because the
--     login screen is `ADMIN/ADMIN` + localStorage — by product decision while
--     the platform is in private testing). So anon needs broad ALL access on
--     the operational tables for the admin UI to keep working today.
--   * Customers.document_cpf, contratos_template and ia_messages stay readable
--     by anon for the same reason. Once the admin is moved behind the backend
--     auth endpoint introduced in this iteration, these policies should be
--     restricted to authenticated/service_role only.

-- ──────────────────────────────────────────────────────────────────
-- 1. Missing columns on existing tables
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE public.boats             ADD COLUMN IF NOT EXISTS catalogo_url TEXT;

ALTER TABLE public.reservations      ADD COLUMN IF NOT EXISTS tapete_status TEXT DEFAULT 'disponivel';
ALTER TABLE public.reservations      ADD COLUMN IF NOT EXISTS docuseal_submission_id TEXT;
ALTER TABLE public.reservations      ADD COLUMN IF NOT EXISTS commission_value DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE public.reservations      ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.ia_conversations  ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'novo';
ALTER TABLE public.ia_conversations  ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE public.ia_conversations  ADD COLUMN IF NOT EXISTS pending_owners_message_id TEXT;
ALTER TABLE public.ia_conversations  ADD COLUMN IF NOT EXISTS pending_owners_question TEXT;

ALTER TABLE public.accounts_payable  ADD COLUMN IF NOT EXISTS boat_expense_id UUID REFERENCES public.boat_expenses(id) ON DELETE SET NULL;

ALTER TABLE public.partners          ADD COLUMN IF NOT EXISTS phone TEXT;  -- legacy alias used by some admin pages

-- Index for new columns frequently filtered
CREATE INDEX IF NOT EXISTS reservations_docuseal_submission_id_idx ON public.reservations(docuseal_submission_id);
CREATE INDEX IF NOT EXISTS ia_conversations_pending_owners_message_id_idx ON public.ia_conversations(pending_owners_message_id);
CREATE INDEX IF NOT EXISTS ia_conversations_target_date_idx ON public.ia_conversations(target_date);
CREATE INDEX IF NOT EXISTS accounts_payable_boat_expense_id_idx ON public.accounts_payable(boat_expense_id);

-- ──────────────────────────────────────────────────────────────────
-- 2. Missing tables
-- ──────────────────────────────────────────────────────────────────

-- Public evaluations form. Anyone can INSERT (the form is open), but only the
-- admin (via backend / authenticated role) reads.
CREATE TABLE IF NOT EXISTS public.evaluations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    boat_id UUID REFERENCES public.boats(id) ON DELETE SET NULL,
    boat_name_custom TEXT,
    boat_stars INT CHECK (boat_stars BETWEEN 1 AND 5),
    captain_name TEXT,
    captain_stars INT CHECK (captain_stars BETWEEN 1 AND 5),
    comments TEXT
);
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- Contract template store (single 'default' row used by server/contract.ts).
CREATE TABLE IF NOT EXISTS public.contratos_template (
    id TEXT PRIMARY KEY,
    html_content TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.contratos_template ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────
-- 3. RLS — reset & rebuild policies so they match the current reality.
--    The migration is idempotent: we drop the legacy "authenticated"-only
--    policies (which never matched the anon-key admin) and replace them
--    with explicit policies for both roles.
-- ──────────────────────────────────────────────────────────────────

DO $$
DECLARE
    pol_rec RECORD;
    target_tables TEXT[] := ARRAY[
        'customers','boats','reservations','consumptions','partners',
        'system_alerts','boat_expenses','accounts_payable','cash_transactions',
        'ia_conversations','ia_messages','ia_campaigns','global_settings',
        'boat_routes_pricing','evaluations','contratos_template'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY target_tables LOOP
        -- Skip if table doesn't exist yet (defensive on partial schemas)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) THEN
            CONTINUE;
        END IF;

        FOR pol_rec IN
            SELECT policyname
            FROM pg_policies
            WHERE schemaname = 'public' AND tablename = t
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_rec.policyname, t);
        END LOOP;
    END LOOP;
END $$;

-- Operational tables the admin UI reads/writes via anon key (current product state).
-- Backend (service_role) always bypasses RLS so it's covered implicitly.
CREATE POLICY "anon all customers"            ON public.customers            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all reservations"         ON public.reservations         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all consumptions"         ON public.consumptions         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all partners"             ON public.partners             FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all system_alerts"        ON public.system_alerts        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all boat_expenses"        ON public.boat_expenses        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all accounts_payable"     ON public.accounts_payable     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all cash_transactions"    ON public.cash_transactions    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all ia_conversations"     ON public.ia_conversations     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all ia_messages"          ON public.ia_messages          FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all ia_campaigns"         ON public.ia_campaigns         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all boat_routes_pricing"  ON public.boat_routes_pricing  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all boats"                ON public.boats                FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all global_settings"      ON public.global_settings      FOR ALL TO anon USING (true) WITH CHECK (true);

-- Evaluations: anon may INSERT and SELECT (admin dashboard reads via anon today).
CREATE POLICY "anon insert evaluations" ON public.evaluations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon select evaluations" ON public.evaluations FOR SELECT TO anon USING (true);
-- No DELETE/UPDATE for anon — evaluations are immutable from the public form.

-- Contratos template: read-only via anon (the admin Dashboard might preview the
-- template), writes happen via backend (service_role bypasses RLS).
CREATE POLICY "anon select contratos_template" ON public.contratos_template FOR SELECT TO anon USING (true);

-- Authenticated role: keep ALL on operational tables too, in case Supabase Auth
-- is wired up later. service_role always bypasses RLS.
CREATE POLICY "authd all customers"           ON public.customers           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authd all reservations"        ON public.reservations        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authd all consumptions"        ON public.consumptions        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authd all partners"            ON public.partners            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authd all system_alerts"       ON public.system_alerts       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authd all boat_expenses"       ON public.boat_expenses       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authd all accounts_payable"    ON public.accounts_payable    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authd all cash_transactions"   ON public.cash_transactions   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authd all ia_conversations"    ON public.ia_conversations    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authd all ia_messages"         ON public.ia_messages         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authd all ia_campaigns"        ON public.ia_campaigns        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authd all boat_routes_pricing" ON public.boat_routes_pricing FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authd all boats"               ON public.boats               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authd all global_settings"     ON public.global_settings     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authd all evaluations"         ON public.evaluations         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authd all contratos_template"  ON public.contratos_template  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────
-- 4. Storage bucket policy for 'contracts' (PDFs uploaded by the contract
--    generator). The backend uses service_role which bypasses bucket RLS;
--    we just ensure the bucket exists.
-- ──────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', true)
ON CONFLICT (id) DO NOTHING;
