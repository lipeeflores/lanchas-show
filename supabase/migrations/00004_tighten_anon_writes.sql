-- Migration 00004: Tighten anon writes
--
-- The previous migration (00003) opened anon ALL on operational tables because
-- the admin panel was talking to Supabase directly with the anon key. Migration
-- 00004 now removes those anon write permissions: the admin panel hits the
-- backend (POST/PATCH/DELETE /api/admin/*) which uses service_role and bypasses
-- RLS entirely. Anon retains SELECT so admin reads keep working without any
-- frontend change.
--
-- Tables that keep anon write:
--   * evaluations: public form INSERT only (no UPDATE/DELETE).
-- Tables that keep anon SELECT only:
--   * boats, boat_routes_pricing, global_settings (public B2C site)
--   * customers, reservations, partners, system_alerts, boat_expenses,
--     accounts_payable, cash_transactions, ia_conversations, ia_messages,
--     ia_campaigns, contratos_template, consumptions (admin reads — TODO:
--     move these behind backend endpoints in a future migration so anon loses
--     SELECT on sensitive columns like customers.document_cpf).

-- Drop every existing policy on the targeted tables so we can rebuild cleanly.
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

-- ──────────────────────────────────────────────────────────────────
-- Anon: SELECT only on admin-read tables (no INSERT/UPDATE/DELETE).
-- ──────────────────────────────────────────────────────────────────
CREATE POLICY "anon select customers"           ON public.customers           FOR SELECT TO anon USING (true);
CREATE POLICY "anon select reservations"        ON public.reservations        FOR SELECT TO anon USING (true);
CREATE POLICY "anon select consumptions"        ON public.consumptions        FOR SELECT TO anon USING (true);
CREATE POLICY "anon select partners"            ON public.partners            FOR SELECT TO anon USING (true);
CREATE POLICY "anon select system_alerts"       ON public.system_alerts       FOR SELECT TO anon USING (true);
CREATE POLICY "anon select boat_expenses"       ON public.boat_expenses       FOR SELECT TO anon USING (true);
CREATE POLICY "anon select accounts_payable"    ON public.accounts_payable    FOR SELECT TO anon USING (true);
CREATE POLICY "anon select cash_transactions"   ON public.cash_transactions   FOR SELECT TO anon USING (true);
CREATE POLICY "anon select ia_conversations"    ON public.ia_conversations    FOR SELECT TO anon USING (true);
CREATE POLICY "anon select ia_messages"         ON public.ia_messages         FOR SELECT TO anon USING (true);
CREATE POLICY "anon select ia_campaigns"        ON public.ia_campaigns        FOR SELECT TO anon USING (true);
CREATE POLICY "anon select boats"               ON public.boats               FOR SELECT TO anon USING (true);
CREATE POLICY "anon select boat_routes_pricing" ON public.boat_routes_pricing FOR SELECT TO anon USING (true);
CREATE POLICY "anon select global_settings"     ON public.global_settings     FOR SELECT TO anon USING (true);
CREATE POLICY "anon select contratos_template"  ON public.contratos_template  FOR SELECT TO anon USING (true);

-- Evaluations: anon may INSERT (public form) and SELECT, never UPDATE/DELETE.
CREATE POLICY "anon insert evaluations" ON public.evaluations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon select evaluations" ON public.evaluations FOR SELECT TO anon USING (true);

-- ──────────────────────────────────────────────────────────────────
-- Authenticated role: keep full access in case Supabase Auth is wired up later
-- (e.g. real per-user admin accounts via a future migration).
-- ──────────────────────────────────────────────────────────────────
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
