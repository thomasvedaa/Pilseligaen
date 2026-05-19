-- ═══════════════════════════════════════════════════
--  Pilseligaen – Supabase SQL Schema
--  Kjør dette i Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════

-- ── BRUKERE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pl_users (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    username    TEXT        NOT NULL,
    username_lc TEXT        UNIQUE NOT NULL,   -- lowercase, brukes for case-insensitive innlogging
    password    TEXT        NOT NULL,           -- klartekst (venneapp, ikke sensitiv)
    color       TEXT        NOT NULL DEFAULT '#f0a500',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── EGENDEFINERTE DRIKKETYPER ──────────────────────────
CREATE TABLE IF NOT EXISTS public.pl_drink_types (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    vol_ml      NUMERIC     NOT NULL,
    abv         NUMERIC     NOT NULL,
    created_by  UUID        REFERENCES public.pl_users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── DRIKKELOGG ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pl_drinks (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES public.pl_users(id) ON DELETE CASCADE,
    type_name   TEXT        NOT NULL,
    vol_ml      NUMERIC     NOT NULL,
    abv         NUMERIC     NOT NULL,
    qty         NUMERIC     NOT NULL DEFAULT 1,
    grams       NUMERIC     NOT NULL,           -- gram alkohol (vol_ml * abv/100 * 0.789 * qty)
    ts          TIMESTAMPTZ NOT NULL,            -- tidspunkt for drikken
    note        TEXT        DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEKSER ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pl_drinks_user_id ON public.pl_drinks(user_id);
CREATE INDEX IF NOT EXISTS idx_pl_drinks_ts      ON public.pl_drinks(ts);

-- ── ROW LEVEL SECURITY ─────────────────────────────────
-- RLS må være aktivert for at anon-nøkkelen skal fungere.
-- Policies er satt til å tillate alt (venneapp).
ALTER TABLE public.pl_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_drink_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_drinks      ENABLE ROW LEVEL SECURITY;

-- Drop policies if they already exist, then recreate
DROP POLICY IF EXISTS "open_access_users"        ON public.pl_users;
DROP POLICY IF EXISTS "open_access_drink_types"  ON public.pl_drink_types;
DROP POLICY IF EXISTS "open_access_drinks"       ON public.pl_drinks;

CREATE POLICY "open_access_users"
    ON public.pl_users FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY "open_access_drink_types"
    ON public.pl_drink_types FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY "open_access_drinks"
    ON public.pl_drinks FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

-- ── REALTIME (for sanntids-ledertavle) ─────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.pl_drinks;

-- ═══════════════════════════════════════════════════
--  Ferdig! Hent anon-nøkkelen din fra:
--  Supabase Dashboard → Settings → API → anon / public
-- ═══════════════════════════════════════════════════
