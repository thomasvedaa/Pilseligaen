-- ═══════════════════════════════════════════════════
--  Pilseligaen – Supabase SQL Schema
--  Kjør dette i Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════

-- ── BRUKERE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pl_users (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    username    TEXT        NOT NULL,
    nickname    TEXT,
    username_lc TEXT        UNIQUE NOT NULL,   -- lowercase, brukes for case-insensitive innlogging
    password    TEXT        NOT NULL,           -- klartekst (venneapp, ikke sensitiv)
    color       TEXT        NOT NULL DEFAULT '#f0a500',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pl_users
    ADD COLUMN IF NOT EXISTS nickname TEXT;

UPDATE public.pl_users
SET nickname = username
WHERE nickname IS NULL OR trim(nickname) = '';

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

-- ── FEED-KOMMENTARER ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pl_drink_comments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    drink_id    UUID        NOT NULL REFERENCES public.pl_drinks(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES public.pl_users(id) ON DELETE CASCADE,
    body        TEXT        NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 240),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── FEED-REAKSJONER ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pl_drink_reactions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    drink_id    UUID        NOT NULL REFERENCES public.pl_drinks(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES public.pl_users(id) ON DELETE CASCADE,
    emoji       TEXT        NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (drink_id,user_id,emoji)
);

-- ── INDEKSER ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pl_drinks_user_id ON public.pl_drinks(user_id);
CREATE INDEX IF NOT EXISTS idx_pl_drinks_ts      ON public.pl_drinks(ts);
CREATE INDEX IF NOT EXISTS idx_pl_drink_comments_drink_id ON public.pl_drink_comments(drink_id);
CREATE INDEX IF NOT EXISTS idx_pl_drink_reactions_drink_id ON public.pl_drink_reactions(drink_id);

-- ── ROW LEVEL SECURITY ─────────────────────────────────
-- RLS må være aktivert for at anon-nøkkelen skal fungere.
-- Policies er satt til å tillate alt (venneapp).
ALTER TABLE public.pl_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_drink_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_drinks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_drink_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_drink_reactions ENABLE ROW LEVEL SECURITY;

-- Drop policies if they already exist, then recreate
DROP POLICY IF EXISTS "open_access_users"        ON public.pl_users;
DROP POLICY IF EXISTS "open_access_drink_types"  ON public.pl_drink_types;
DROP POLICY IF EXISTS "open_access_drinks"       ON public.pl_drinks;
DROP POLICY IF EXISTS "open_access_drink_comments" ON public.pl_drink_comments;
DROP POLICY IF EXISTS "open_access_drink_reactions" ON public.pl_drink_reactions;

CREATE POLICY "open_access_users"
    ON public.pl_users FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY "open_access_drink_types"
    ON public.pl_drink_types FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY "open_access_drinks"
    ON public.pl_drinks FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY "open_access_drink_comments"
    ON public.pl_drink_comments FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY "open_access_drink_reactions"
    ON public.pl_drink_reactions FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

-- ── REALTIME (for sanntids-ledertavle) ─────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='pl_drinks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pl_drinks;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='pl_drink_comments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pl_drink_comments;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='pl_drink_reactions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pl_drink_reactions;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════
--  Ferdig! Hent anon-nøkkelen din fra:
--  Supabase Dashboard → Settings → API → anon / public
-- ═══════════════════════════════════════════════════
