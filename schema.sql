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
    auth_user_id UUID       UNIQUE REFERENCES auth.users(id),
    username_lc TEXT        UNIQUE NOT NULL,   -- lowercase, brukes for case-insensitive innlogging
    password    TEXT,                           -- legacy: ikke bruk for nye innlogginger
    color       TEXT        NOT NULL DEFAULT '#f0a500',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pl_users
    ADD COLUMN IF NOT EXISTS nickname TEXT,
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id);

ALTER TABLE public.pl_users
    ALTER COLUMN password DROP NOT NULL;

UPDATE public.pl_users
SET password = NULL
WHERE auth_user_id IS NOT NULL AND password IS NOT NULL;

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
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

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

-- ── INDEKSER ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pl_drinks_user_id ON public.pl_drinks(user_id);
CREATE INDEX IF NOT EXISTS idx_pl_drinks_ts      ON public.pl_drinks(ts);
CREATE INDEX IF NOT EXISTS idx_pl_drinks_event_id ON public.pl_drinks(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pl_users_auth_user_id ON public.pl_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_pl_events_code_lc ON public.pl_events(code_lc);
CREATE INDEX IF NOT EXISTS idx_pl_event_members_user_id ON public.pl_event_members(user_id);
CREATE INDEX IF NOT EXISTS idx_pl_event_members_event_id ON public.pl_event_members(event_id);
CREATE INDEX IF NOT EXISTS idx_pl_drink_comments_drink_id ON public.pl_drink_comments(drink_id);
CREATE INDEX IF NOT EXISTS idx_pl_drink_reactions_drink_id ON public.pl_drink_reactions(drink_id);

-- ── ROW LEVEL SECURITY ─────────────────────────────────
-- RLS protects data when the public anon key is used from the browser.
-- Authenticated users only get the access allowed by the policies below.
ALTER TABLE public.pl_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_drink_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_event_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_drinks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_drink_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_drink_reactions ENABLE ROW LEVEL SECURITY;

-- Helper functions used by policies. SECURITY DEFINER prevents RLS recursion.
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id
    FROM public.pl_users
    WHERE auth_user_id = (SELECT auth.uid())
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (
    id UUID,
    username TEXT,
    nickname TEXT,
    avatar_url TEXT,
    color TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id, u.username, u.nickname, u.avatar_url, u.color, u.created_at
    FROM public.pl_users u
    WHERE u.auth_user_id = (SELECT auth.uid())
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_event_member(event_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.pl_event_members
        WHERE event_id = event_uuid
          AND user_id = public.current_profile_id()
    )
$$;

CREATE OR REPLACE FUNCTION public.can_read_drink(drink_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.pl_drinks d
        WHERE d.id = drink_uuid
          AND (d.event_id IS NULL OR public.is_event_member(d.event_id))
    )
$$;

CREATE OR REPLACE FUNCTION public.create_event_with_code(event_name TEXT, input_code TEXT)
RETURNS public.pl_events
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    profile_id UUID;
    clean_name TEXT;
    clean_code TEXT;
    new_event public.pl_events;
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN
        RAISE EXCEPTION 'Du må være logget inn.';
    END IF;

    profile_id := public.current_profile_id();
    IF profile_id IS NULL THEN
        RAISE EXCEPTION 'Fant ikke profil for innlogget bruker.';
    END IF;

    clean_name := NULLIF(TRIM(event_name), '');
    clean_code := UPPER(REGEXP_REPLACE(COALESCE(TRIM(input_code), ''), '[^A-Za-z0-9-]', '', 'g'));

    IF clean_name IS NULL OR CHAR_LENGTH(clean_name) > 48 THEN
        RAISE EXCEPTION 'Ugyldig navn.';
    END IF;
    IF CHAR_LENGTH(clean_code) < 3 OR CHAR_LENGTH(clean_code) > 24 THEN
        RAISE EXCEPTION 'Ugyldig kode.';
    END IF;

    INSERT INTO public.pl_events (name, code, code_lc, created_by)
    VALUES (clean_name, clean_code, LOWER(clean_code), profile_id)
    RETURNING * INTO new_event;

    INSERT INTO public.pl_event_members (event_id, user_id)
    VALUES (new_event.id, profile_id)
    ON CONFLICT (event_id,user_id) DO NOTHING;

    RETURN new_event;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Koden er allerede brukt.';
END;
$$;

CREATE OR REPLACE FUNCTION public.join_event_by_code(input_code TEXT)
RETURNS public.pl_events
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    profile_id UUID;
    clean_code TEXT;
    found_event public.pl_events;
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN
        RAISE EXCEPTION 'Du må være logget inn.';
    END IF;

    profile_id := public.current_profile_id();
    IF profile_id IS NULL THEN
        RAISE EXCEPTION 'Fant ikke profil for innlogget bruker.';
    END IF;

    clean_code := LOWER(REGEXP_REPLACE(COALESCE(TRIM(input_code), ''), '[^A-Za-z0-9-]', '', 'g'));
    SELECT * INTO found_event
    FROM public.pl_events
    WHERE code_lc = clean_code
    LIMIT 1;

    IF found_event.id IS NULL THEN
        RAISE EXCEPTION 'Fant ingen tur med den koden.';
    END IF;

    INSERT INTO public.pl_event_members (event_id, user_id)
    VALUES (found_event.id, profile_id)
    ON CONFLICT (event_id,user_id) DO NOTHING;

    RETURN found_event;
END;
$$;

REVOKE ALL ON TABLE public.pl_users FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pl_drink_types FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pl_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pl_event_members FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pl_drinks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pl_drink_comments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pl_drink_reactions FROM PUBLIC, anon, authenticated;

GRANT SELECT (id,username,nickname,avatar_url,color,created_at) ON public.pl_users TO authenticated;
GRANT INSERT (username,nickname,avatar_url,auth_user_id,username_lc,color) ON public.pl_users TO authenticated;
GRANT UPDATE (nickname,avatar_url,color) ON public.pl_users TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_drink_types TO authenticated;
GRANT SELECT ON public.pl_events TO authenticated;
GRANT SELECT ON public.pl_event_members TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.pl_drinks TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.pl_drink_comments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.pl_drink_reactions TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_profile_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_event_member(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_read_drink(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_event_with_code(TEXT,TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_event_by_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_drink(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_event_with_code(TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_event_by_code(TEXT) TO authenticated;

-- Drop old open policies and recreate least-privilege policies.
DROP POLICY IF EXISTS "open_access_users"        ON public.pl_users;
DROP POLICY IF EXISTS "open_access_drink_types"  ON public.pl_drink_types;
DROP POLICY IF EXISTS "open_access_events"       ON public.pl_events;
DROP POLICY IF EXISTS "open_access_event_members" ON public.pl_event_members;
DROP POLICY IF EXISTS "open_access_drinks"       ON public.pl_drinks;
DROP POLICY IF EXISTS "open_access_drink_comments" ON public.pl_drink_comments;
DROP POLICY IF EXISTS "open_access_drink_reactions" ON public.pl_drink_reactions;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.pl_users;
DROP POLICY IF EXISTS "profiles_insert_self" ON public.pl_users;
DROP POLICY IF EXISTS "profiles_update_self" ON public.pl_users;
DROP POLICY IF EXISTS "drink_types_select_authenticated" ON public.pl_drink_types;
DROP POLICY IF EXISTS "drink_types_insert_self" ON public.pl_drink_types;
DROP POLICY IF EXISTS "drink_types_update_self" ON public.pl_drink_types;
DROP POLICY IF EXISTS "drink_types_delete_self" ON public.pl_drink_types;
DROP POLICY IF EXISTS "events_select_members" ON public.pl_events;
DROP POLICY IF EXISTS "event_members_select_members" ON public.pl_event_members;
DROP POLICY IF EXISTS "drinks_select_visible" ON public.pl_drinks;
DROP POLICY IF EXISTS "drinks_insert_self" ON public.pl_drinks;
DROP POLICY IF EXISTS "drinks_delete_self" ON public.pl_drinks;
DROP POLICY IF EXISTS "comments_select_visible_drinks" ON public.pl_drink_comments;
DROP POLICY IF EXISTS "comments_insert_self_visible_drink" ON public.pl_drink_comments;
DROP POLICY IF EXISTS "comments_delete_self" ON public.pl_drink_comments;
DROP POLICY IF EXISTS "reactions_select_visible_drinks" ON public.pl_drink_reactions;
DROP POLICY IF EXISTS "reactions_insert_self_visible_drink" ON public.pl_drink_reactions;
DROP POLICY IF EXISTS "reactions_delete_self" ON public.pl_drink_reactions;

CREATE POLICY "profiles_select_authenticated"
    ON public.pl_users FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "profiles_insert_self"
    ON public.pl_users FOR INSERT TO authenticated
    WITH CHECK (auth_user_id = (SELECT auth.uid()));

CREATE POLICY "profiles_update_self"
    ON public.pl_users FOR UPDATE TO authenticated
    USING (id = public.current_profile_id())
    WITH CHECK (id = public.current_profile_id() AND auth_user_id = (SELECT auth.uid()));

CREATE POLICY "drink_types_select_authenticated"
    ON public.pl_drink_types FOR SELECT TO authenticated
    USING (created_by = public.current_profile_id());

CREATE POLICY "drink_types_insert_self"
    ON public.pl_drink_types FOR INSERT TO authenticated
    WITH CHECK (created_by = public.current_profile_id());

CREATE POLICY "drink_types_update_self"
    ON public.pl_drink_types FOR UPDATE TO authenticated
    USING (created_by = public.current_profile_id())
    WITH CHECK (created_by = public.current_profile_id());

CREATE POLICY "drink_types_delete_self"
    ON public.pl_drink_types FOR DELETE TO authenticated
    USING (created_by = public.current_profile_id());

CREATE POLICY "events_select_members"
    ON public.pl_events FOR SELECT TO authenticated
    USING (public.is_event_member(id));

CREATE POLICY "event_members_select_members"
    ON public.pl_event_members FOR SELECT TO authenticated
    USING (user_id = public.current_profile_id() OR public.is_event_member(event_id));

CREATE POLICY "drinks_select_visible"
    ON public.pl_drinks FOR SELECT TO authenticated
    USING (event_id IS NULL OR public.is_event_member(event_id));

CREATE POLICY "drinks_insert_self"
    ON public.pl_drinks FOR INSERT TO authenticated
    WITH CHECK (user_id = public.current_profile_id() AND (event_id IS NULL OR public.is_event_member(event_id)));

CREATE POLICY "drinks_delete_self"
    ON public.pl_drinks FOR DELETE TO authenticated
    USING (user_id = public.current_profile_id());

CREATE POLICY "comments_select_visible_drinks"
    ON public.pl_drink_comments FOR SELECT TO authenticated
    USING (public.can_read_drink(drink_id));

CREATE POLICY "comments_insert_self_visible_drink"
    ON public.pl_drink_comments FOR INSERT TO authenticated
    WITH CHECK (user_id = public.current_profile_id() AND public.can_read_drink(drink_id));

CREATE POLICY "comments_delete_self"
    ON public.pl_drink_comments FOR DELETE TO authenticated
    USING (user_id = public.current_profile_id());

CREATE POLICY "reactions_select_visible_drinks"
    ON public.pl_drink_reactions FOR SELECT TO authenticated
    USING (public.can_read_drink(drink_id));

CREATE POLICY "reactions_insert_self_visible_drink"
    ON public.pl_drink_reactions FOR INSERT TO authenticated
    WITH CHECK (user_id = public.current_profile_id() AND public.can_read_drink(drink_id));

CREATE POLICY "reactions_delete_self"
    ON public.pl_drink_reactions FOR DELETE TO authenticated
    USING (user_id = public.current_profile_id());

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
END $$;

-- ═══════════════════════════════════════════════════
--  Ferdig! Hent anon-nøkkelen din fra:
--  Supabase Dashboard → Settings → API → anon / public
-- ═══════════════════════════════════════════════════
