-- Migration: Restrict anon SELECT on sensitive tables
-- All admin reads are now proxied through the authenticated backend (service_role).
-- The frontend anon key must NOT have direct SELECT access to PII or financial data.
--
-- Tables kept public for the pricing engine and public-facing catalog:
--   boats, boat_routes_pricing, global_settings, evaluations (ratings are public)
--
-- Tables restricted to service_role only:
--   customers, reservations, cash_transactions, accounts_payable, boat_expenses,
--   partners, system_alerts, ia_conversations, ia_messages, ia_campaigns

-- ── Revoke anon SELECT ────────────────────────────────────────────────────────

REVOKE SELECT ON customers        FROM anon;
REVOKE SELECT ON reservations     FROM anon;
REVOKE SELECT ON cash_transactions FROM anon;
REVOKE SELECT ON accounts_payable FROM anon;
REVOKE SELECT ON boat_expenses    FROM anon;
REVOKE SELECT ON partners         FROM anon;
REVOKE SELECT ON system_alerts    FROM anon;
REVOKE SELECT ON ia_conversations FROM anon;
REVOKE SELECT ON ia_messages      FROM anon;
REVOKE SELECT ON ia_campaigns     FROM anon;
REVOKE SELECT ON contratos_template FROM anon;

-- ── Revoke anon write operations on tables that were never meant to allow them ─

-- evaluations: anon INSERT was intentional (public rating form), but DELETE was not.
-- We keep anon INSERT so customers can submit ratings at /avaliacao.
REVOKE DELETE ON evaluations FROM anon;
REVOKE UPDATE ON evaluations FROM anon;

-- ── Drop existing overly-permissive RLS policies for anon on restricted tables ─

-- customers
DROP POLICY IF EXISTS "anon_can_read_customers"   ON customers;
DROP POLICY IF EXISTS "anon_select_customers"     ON customers;

-- reservations
DROP POLICY IF EXISTS "anon_can_read_reservations"  ON reservations;
DROP POLICY IF EXISTS "anon_select_reservations"    ON reservations;

-- cash_transactions
DROP POLICY IF EXISTS "anon_can_read_cash_transactions" ON cash_transactions;
DROP POLICY IF EXISTS "anon_select_cash_transactions"   ON cash_transactions;

-- accounts_payable
DROP POLICY IF EXISTS "anon_can_read_accounts_payable" ON accounts_payable;
DROP POLICY IF EXISTS "anon_select_accounts_payable"   ON accounts_payable;

-- boat_expenses
DROP POLICY IF EXISTS "anon_can_read_boat_expenses" ON boat_expenses;
DROP POLICY IF EXISTS "anon_select_boat_expenses"   ON boat_expenses;

-- partners
DROP POLICY IF EXISTS "anon_can_read_partners" ON partners;
DROP POLICY IF EXISTS "anon_select_partners"   ON partners;

-- system_alerts
DROP POLICY IF EXISTS "anon_can_read_system_alerts" ON system_alerts;
DROP POLICY IF EXISTS "anon_select_system_alerts"   ON system_alerts;

-- ia_conversations
DROP POLICY IF EXISTS "anon_can_read_ia_conversations" ON ia_conversations;
DROP POLICY IF EXISTS "anon_select_ia_conversations"   ON ia_conversations;

-- ia_messages
DROP POLICY IF EXISTS "anon_can_read_ia_messages" ON ia_messages;
DROP POLICY IF EXISTS "anon_select_ia_messages"   ON ia_messages;

-- ia_campaigns
DROP POLICY IF EXISTS "anon_can_read_ia_campaigns" ON ia_campaigns;
DROP POLICY IF EXISTS "anon_select_ia_campaigns"   ON ia_campaigns;

-- contratos_template
DROP POLICY IF EXISTS "anon_can_read_contratos_template" ON contratos_template;
DROP POLICY IF EXISTS "anon_select_contratos_template"   ON contratos_template;

-- evaluations (delete/update)
DROP POLICY IF EXISTS "anon_delete_evaluations" ON evaluations;
DROP POLICY IF EXISTS "anon_update_evaluations" ON evaluations;

-- ── Ensure service_role still has full access (it bypasses RLS by design) ────
-- service_role privileges are not affected by REVOKE on anon; this is a no-op
-- but documents intent clearly.
GRANT ALL ON customers         TO service_role;
GRANT ALL ON reservations      TO service_role;
GRANT ALL ON cash_transactions TO service_role;
GRANT ALL ON accounts_payable  TO service_role;
GRANT ALL ON boat_expenses     TO service_role;
GRANT ALL ON partners          TO service_role;
GRANT ALL ON system_alerts     TO service_role;
GRANT ALL ON ia_conversations  TO service_role;
GRANT ALL ON ia_messages       TO service_role;
GRANT ALL ON ia_campaigns      TO service_role;
GRANT ALL ON contratos_template TO service_role;
GRANT ALL ON evaluations       TO service_role;
