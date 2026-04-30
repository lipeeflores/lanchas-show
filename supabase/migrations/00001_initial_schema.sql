-- Migration 00001: Initial Schema for Lanchas Show

-- 1. Create Tables

-- Customers (Clients/Guests)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    document_cpf TEXT,
    notes TEXT,
    tags TEXT[]
);

-- Boats (Lanchas/Inventory)
CREATE TABLE IF NOT EXISTS public.boats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    capacity INT NOT NULL,
    size INT,
    image TEXT,
    image_urls TEXT[] DEFAULT '{}'::TEXT[],
    hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    daily_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    original_rate DECIMAL(10,2),
    boarding_points TEXT[],
    allowed_destinations TEXT[],
    price_low_season DECIMAL(10,2) DEFAULT 0.00,
    price_high_season DECIMAL(10,2) DEFAULT 0.00,
    price_weekend_holiday DECIMAL(10,2) DEFAULT 0.00,
    min_price_low_season DECIMAL(10,2) DEFAULT 0.00,
    min_price_high_season DECIMAL(10,2) DEFAULT 0.00,
    min_price_weekend_holiday DECIMAL(10,2) DEFAULT 0.00,
    has_floating_mat BOOLEAN DEFAULT false,
    floating_mat_price DECIMAL(10,2) DEFAULT 0.00,
    extra_hour_price DECIMAL(10,2) DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'AVAILABLE' -- AVAILABLE, MAINTENANCE, IN_USE
);

-- Reservations (Bookings for boats)
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW
    total_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    base_price_closed DECIMAL(10,2) DEFAULT 0.00,
    floating_mat_status TEXT CHECK (floating_mat_status IN ('none', 'paid', 'courtesy')) DEFAULT 'none',
    floating_mat_value DECIMAL(10,2) DEFAULT 0.00,
    extra_hours_qty INT DEFAULT 0,
    extra_hours_total_value DECIMAL(10,2) DEFAULT 0.00,
    total_reservation_value DECIMAL(10,2) DEFAULT 0.00,
    passenger_count INT DEFAULT 1,
    boarding_point TEXT,
    destination TEXT,
    negotiation_status TEXT DEFAULT 'PROSPECTING',
    last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    payment_link_url TEXT,
    contract_link_url TEXT
);

-- View for n8n Catalog
CREATE OR REPLACE VIEW public.vw_boats_catalog_n8n AS
SELECT 
    id,
    name,
    capacity,
    daily_rate as base_price_brl,
    owner_type,
    status,
    'https://lanchas-show.vercel.app/lancha/' || id AS catalog_link
FROM public.boats
WHERE status = 'AVAILABLE';


-- Consumptions (Items consumed or extra services like Laundry/Minibar)
CREATE TABLE IF NOT EXISTS public.consumptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL, -- MINIBAR, LAUNDRY, EXTRA_SERVICE, OTHER
    description TEXT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_price DECIMAL(10,2) NOT NULL DEFAULT 0.00
);


-- 2. Row Level Security Setup

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumptions ENABLE ROW LEVEL SECURITY;

-- Allow read/write access to authenticated users (B2B Admin dashboard)
-- Note: Replace with proper role-based access if public bookings are allowed.
CREATE POLICY "Allow ALL for authenticated on customers" ON public.customers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow ALL for authenticated on boats" ON public.boats FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow ALL for authenticated on reservations" ON public.reservations FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow ALL for authenticated on consumptions" ON public.consumptions FOR ALL TO authenticated USING (true);

-- Allow public read access to boats (for B2C booking engine)
CREATE POLICY "Allow SELECT for anon on boats" ON public.boats FOR SELECT TO anon USING (true);

-- Partners
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    management_level TEXT NOT NULL, -- LEVEL_1, LEVEL_2
    contact_phone TEXT,
    ical_url TEXT
);

ALTER TABLE public.boats ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;
ALTER TABLE public.boats ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'OWN'; -- OWN, PARTNER_L1, PARTNER_L2

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow ALL for authenticated on partners" ON public.partners FOR ALL TO authenticated USING (true);

-- System Alerts
CREATE TABLE IF NOT EXISTS public.system_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    type TEXT NOT NULL, -- PIX, WARNING, INFO
    amount DECIMAL(10,2),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false
);
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow ALL for authenticated on system_alerts" ON public.system_alerts FOR ALL TO authenticated USING (true);

-- Fleet Management & Finance
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS bank_account_info TEXT;
ALTER TABLE public.boats ADD COLUMN IF NOT EXISTS partner_net_value DECIMAL(10,2);
ALTER TABLE public.boats ADD COLUMN IF NOT EXISTS rules_and_info TEXT;

CREATE TABLE IF NOT EXISTS public.boat_expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT
);
ALTER TABLE public.boat_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow ALL for authenticated on boat_expenses" ON public.boat_expenses FOR ALL TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.accounts_payable (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    due_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(10,2) NOT NULL,
    payee_type TEXT NOT NULL,
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING'
);
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow ALL for authenticated on accounts_payable" ON public.accounts_payable FOR ALL TO authenticated USING (true);

-- Cash Flow Ledger
CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    type TEXT NOT NULL, -- INCOME, EXPENSE
    amount DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL
);
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow ALL for authenticated on cash_transactions" ON public.cash_transactions FOR ALL TO authenticated USING (true);

-- AI Command Center
CREATE TABLE IF NOT EXISTS public.ia_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    contact_name TEXT NOT NULL,
    contact_phone TEXT,
    contact_type TEXT NOT NULL DEFAULT 'CLIENT',
    status TEXT NOT NULL DEFAULT 'AI_CONTROL',
    subject TEXT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL
);
ALTER TABLE public.ia_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow ALL for authenticated on ia_conversations" ON public.ia_conversations FOR ALL TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.ia_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    conversation_id UUID NOT NULL REFERENCES public.ia_conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL,
    content TEXT NOT NULL
);
ALTER TABLE public.ia_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow ALL for authenticated on ia_messages" ON public.ia_messages FOR ALL TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.ia_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    copy_text TEXT NOT NULL,
    image_url TEXT,
    target_tags TEXT[],
    status TEXT NOT NULL DEFAULT 'DRAFT',
    approved_at TIMESTAMP WITH TIME ZONE,
    sent_count INT DEFAULT 0
);
ALTER TABLE public.ia_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow ALL for authenticated on ia_campaigns" ON public.ia_campaigns FOR ALL TO authenticated USING (true);

-- Global Settings (Calendar / Pricing Engine)
CREATE TABLE IF NOT EXISTS public.global_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow ALL for authenticated on global_settings" ON public.global_settings FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow SELECT for anon on global_settings" ON public.global_settings FOR SELECT TO anon USING (true);

-- Boat Routes Pricing (price per route combination)
CREATE TABLE IF NOT EXISTS public.boat_routes_pricing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
    embarkation_point TEXT NOT NULL,
    destination_point TEXT NOT NULL,
    price_low_season DECIMAL(10,2) DEFAULT 0.00,
    min_price_low_season DECIMAL(10,2) DEFAULT 0.00,
    price_weekend_holiday DECIMAL(10,2) DEFAULT 0.00,
    min_price_weekend_holiday DECIMAL(10,2) DEFAULT 0.00,
    price_high_season DECIMAL(10,2) DEFAULT 0.00,
    min_price_high_season DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(boat_id, embarkation_point, destination_point)
);
ALTER TABLE public.boat_routes_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow ALL for authenticated on boat_routes_pricing" ON public.boat_routes_pricing FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow SELECT for anon on boat_routes_pricing" ON public.boat_routes_pricing FOR SELECT TO anon USING (true);
