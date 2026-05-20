-- ═══════════════════════════════════════════════════
--  Pilseligaen – Supabase SQL Schema
--  Kjør dette i Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════

-- ── BRUKERE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pl_users (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    username    TEXT        NOT NULL,
    nickname    TEXT,
    avatar_url  TEXT,
    username_lc TEXT        UNIQUE NOT NULL,   -- lowercase, brukes for case-insensitive innlogging
    password    TEXT        NOT NULL,           -- klartekst (venneapp, ikke sensitiv)
    color       TEXT        NOT NULL DEFAULT '#f0a500',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pl_users
    ADD COLUMN IF NOT EXISTS nickname TEXT,
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;

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

-- EVENTER / TURER
CREATE TABLE IF NOT EXISTS public.pl_events (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    code        TEXT        NOT NULL,
    code_lc     TEXT        UNIQUE NOT NULL,
    created_by  UUID        REFERENCES public.pl_users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    ended_at    TIMESTAMPTZ
);

ALTER TABLE public.pl_events
    ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.pl_event_members (
    event_id    UUID        NOT NULL REFERENCES public.pl_events(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES public.pl_users(id) ON DELETE CASCADE,
    joined_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (event_id,user_id)
);

-- ── DRIKKELOGG ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pl_drinks (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES public.pl_users(id) ON DELETE CASCADE,
    event_id    UUID        REFERENCES public.pl_events(id) ON DELETE SET NULL,
    type_name   TEXT        NOT NULL,
    vol_ml      NUMERIC     NOT NULL,
    abv         NUMERIC     NOT NULL,
    qty         NUMERIC     NOT NULL DEFAULT 1,
    grams       NUMERIC     NOT NULL,           -- gram alkohol (vol_ml * abv/100 * 0.789 * qty)
    ts          TIMESTAMPTZ NOT NULL,            -- tidspunkt for drikken
    note        TEXT        DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pl_drinks
    ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.pl_events(id) ON DELETE SET NULL;

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

-- ── ACHIEVEMENT-REAKSJONER ────────────────────────────
CREATE TABLE IF NOT EXISTS public.pl_achievement_reactions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    achievement_id  TEXT        NOT NULL,
    user_id         UUID        NOT NULL REFERENCES public.pl_users(id) ON DELETE CASCADE,
    emoji           TEXT        NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (achievement_id,user_id,emoji)
);

-- ── INDEKSER ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pl_drinks_user_id ON public.pl_drinks(user_id);
CREATE INDEX IF NOT EXISTS idx_pl_drinks_ts      ON public.pl_drinks(ts);
CREATE INDEX IF NOT EXISTS idx_pl_drinks_event_id ON public.pl_drinks(event_id);
CREATE INDEX IF NOT EXISTS idx_pl_events_code_lc ON public.pl_events(code_lc);
CREATE INDEX IF NOT EXISTS idx_pl_event_members_user_id ON public.pl_event_members(user_id);
CREATE INDEX IF NOT EXISTS idx_pl_event_members_event_id ON public.pl_event_members(event_id);
CREATE INDEX IF NOT EXISTS idx_pl_drink_comments_drink_id ON public.pl_drink_comments(drink_id);
CREATE INDEX IF NOT EXISTS idx_pl_drink_reactions_drink_id ON public.pl_drink_reactions(drink_id);
CREATE INDEX IF NOT EXISTS idx_pl_achievement_reactions_aid ON public.pl_achievement_reactions(achievement_id);

-- ── ROW LEVEL SECURITY ─────────────────────────────────
-- RLS må være aktivert for at anon-nøkkelen skal fungere.
-- Policies er satt til å tillate alt (venneapp).
ALTER TABLE public.pl_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_drink_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_event_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_drinks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_drink_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_drink_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_achievement_reactions ENABLE ROW LEVEL SECURITY;

-- Drop policies if they already exist, then recreate
DROP POLICY IF EXISTS "open_access_users"        ON public.pl_users;
DROP POLICY IF EXISTS "open_access_drink_types"  ON public.pl_drink_types;
DROP POLICY IF EXISTS "open_access_events"       ON public.pl_events;
DROP POLICY IF EXISTS "open_access_event_members" ON public.pl_event_members;
DROP POLICY IF EXISTS "open_access_drinks"       ON public.pl_drinks;
DROP POLICY IF EXISTS "open_access_drink_comments" ON public.pl_drink_comments;
DROP POLICY IF EXISTS "open_access_drink_reactions" ON public.pl_drink_reactions;
DROP POLICY IF EXISTS "open_access_achievement_reactions" ON public.pl_achievement_reactions;

CREATE POLICY "open_access_users"
    ON public.pl_users FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY "open_access_drink_types"
    ON public.pl_drink_types FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY "open_access_events"
    ON public.pl_events FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY "open_access_event_members"
    ON public.pl_event_members FOR ALL TO anon, authenticated
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

CREATE POLICY "open_access_achievement_reactions"
    ON public.pl_achievement_reactions FOR ALL TO anon, authenticated
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
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='pl_events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pl_events;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='pl_event_members'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pl_event_members;
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

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='pl_achievement_reactions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pl_achievement_reactions;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════
--  Ferdig! Hent anon-nøkkelen din fra:
--  Supabase Dashboard → Settings → API → anon / public
-- ═══════════════════════════════════════════════════
