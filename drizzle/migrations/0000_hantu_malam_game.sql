CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  tanggal_lahir date NOT NULL,
  username text NOT NULL UNIQUE,
  kode_id text NOT NULL UNIQUE,
  karakter_pilihan text NOT NULL DEFAULT 'raka',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rooms (
  code text PRIMARY KEY,
  host_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'lobby',
  created_at timestamptz NOT NULL DEFAULT now(),
  map text NOT NULL DEFAULT 'rumah',
  CONSTRAINT rooms_map_check CHECK (map IN ('rumah','rumahsakit','kuburan','hotel'))
);
CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL REFERENCES public.rooms(code) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  nama text NOT NULL,
  username text NOT NULL,
  karakter text NOT NULL,
  role text,
  status text NOT NULL DEFAULT 'alive',
  joined_at timestamptz NOT NULL DEFAULT now(),
  role_pref text NOT NULL DEFAULT 'hunter',
  UNIQUE (room_code, profile_id)
);
CREATE TABLE public.game_state (
  room_code text PRIMARY KEY REFERENCES public.rooms(code) ON DELETE CASCADE,
  keys_found int NOT NULL DEFAULT 0,
  started_at timestamptz,
  winner text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms, public.players, public.game_state TO anon, authenticated;
GRANT ALL ON public.rooms, public.players, public.game_state TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms open" ON public.rooms FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "players open" ON public.players FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "state open" ON public.game_state FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;

CREATE OR REPLACE FUNCTION public.create_profile(p_nama text, p_tanggal date, p_karakter text)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.profiles; base text; i int := 0;
BEGIN
  IF length(trim(p_nama)) < 2 OR length(p_nama) > 30 THEN RAISE EXCEPTION 'Nama tidak valid'; END IF;
  IF p_karakter NOT IN ('raka','aisyah','qila','nabila') THEN RAISE EXCEPTION 'Karakter tidak valid'; END IF;
  base := upper(regexp_replace(split_part(trim(p_nama),' ',1), '[^A-Za-z0-9]', '', 'g'));
  IF base = '' THEN base := 'PEMBURU'; END IF;
  base := left(base, 12);
  LOOP
    i := i + 1;
    BEGIN
      INSERT INTO public.profiles(nama, tanggal_lahir, username, kode_id, karakter_pilihan)
      VALUES (trim(p_nama), p_tanggal, base || '_' || lpad((floor(random()*10000))::int::text, 4, '0'),
              'HM-' || lpad((floor(random()*10000))::int::text, 4, '0'), p_karakter)
      RETURNING * INTO r;
      RETURN r;
    EXCEPTION WHEN unique_violation THEN
      IF i > 30 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.login_id_card(p_kode text, p_nama text)
RETURNS SETOF public.profiles LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.profiles
  WHERE kode_id = upper(trim(p_kode))
    AND (p_nama IS NULL OR lower(trim(nama)) = lower(trim(p_nama)) OR lower(username) = lower(trim(p_nama)))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.set_karakter(p_id uuid, p_kode text, p_karakter text)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.profiles;
BEGIN
  IF p_karakter NOT IN ('raka','aisyah','qila','nabila') THEN RAISE EXCEPTION 'Karakter tidak valid'; END IF;
  UPDATE public.profiles SET karakter_pilihan = p_karakter WHERE id = p_id AND kode_id = p_kode RETURNING * INTO r;
  RETURN r;
END $$;

GRANT EXECUTE ON FUNCTION public.create_profile(text, date, text), public.set_karakter(uuid, text, text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.login_id_card(text, text) FROM anon, authenticated, public;

CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id)
);
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_nama text NOT NULL,
  sender_karakter text NOT NULL,
  recipient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_created_idx ON public.chat_messages (created_at DESC);
GRANT SELECT ON public.chat_messages TO anon, authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "world chat readable for 24h" ON public.chat_messages FOR SELECT TO anon, authenticated
  USING (recipient_id IS NULL AND created_at > now() - interval '24 hours');
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

CREATE OR REPLACE FUNCTION public.me_ok(p_id uuid, p_kode text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_id AND kode_id = p_kode);
$$;

CREATE OR REPLACE FUNCTION public.send_chat(p_id uuid, p_kode text, p_to uuid, p_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me public.profiles;
BEGIN
  SELECT * INTO me FROM public.profiles WHERE id = p_id AND kode_id = p_kode;
  IF me.id IS NULL THEN RAISE EXCEPTION 'Kartu ID tidak valid'; END IF;
  IF length(trim(p_body)) = 0 OR length(p_body) > 200 THEN RAISE EXCEPTION 'Pesan tidak valid'; END IF;
  IF p_to IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.friendships WHERE status = 'accepted'
     AND ((requester_id = p_id AND addressee_id = p_to) OR (requester_id = p_to AND addressee_id = p_id))) THEN
    RAISE EXCEPTION 'Hanya bisa chat pribadi dengan teman';
  END IF;
  DELETE FROM public.chat_messages WHERE recipient_id IS NULL AND created_at < now() - interval '24 hours';
  INSERT INTO public.chat_messages(sender_id, sender_nama, sender_karakter, recipient_id, body)
  VALUES (me.id, me.nama, me.karakter_pilihan, p_to, trim(p_body));
END $$;

CREATE OR REPLACE FUNCTION public.list_dm(p_id uuid, p_kode text, p_other uuid)
RETURNS SETOF public.chat_messages LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.chat_messages
  WHERE public.me_ok(p_id, p_kode)
    AND ((sender_id = p_id AND recipient_id = p_other) OR (sender_id = p_other AND recipient_id = p_id))
  ORDER BY created_at DESC LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.send_friend_request(p_id uuid, p_kode text, p_target_kode text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t uuid;
BEGIN
  IF NOT public.me_ok(p_id, p_kode) THEN RAISE EXCEPTION 'Kartu ID tidak valid'; END IF;
  SELECT id INTO t FROM public.profiles WHERE kode_id = upper(trim(p_target_kode));
  IF t IS NULL THEN RAISE EXCEPTION 'Kode ID tidak ditemukan'; END IF;
  IF t = p_id THEN RAISE EXCEPTION 'Itu kode ID kamu sendiri'; END IF;
  IF EXISTS (SELECT 1 FROM public.friendships WHERE requester_id = t AND addressee_id = p_id) THEN
    UPDATE public.friendships SET status = 'accepted' WHERE requester_id = t AND addressee_id = p_id;
    RETURN 'accepted';
  END IF;
  INSERT INTO public.friendships(requester_id, addressee_id) VALUES (p_id, t) ON CONFLICT DO NOTHING;
  RETURN 'pending';
END $$;

CREATE OR REPLACE FUNCTION public.respond_friend(p_id uuid, p_kode text, p_other uuid, p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.me_ok(p_id, p_kode) THEN RAISE EXCEPTION 'Kartu ID tidak valid'; END IF;
  IF p_accept THEN
    UPDATE public.friendships SET status = 'accepted' WHERE requester_id = p_other AND addressee_id = p_id;
  ELSE
    DELETE FROM public.friendships WHERE (requester_id = p_other AND addressee_id = p_id) OR (requester_id = p_id AND addressee_id = p_other);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.list_friends(p_id uuid, p_kode text)
RETURNS TABLE(friend_id uuid, nama text, username text, kode_id text, karakter text, status text, incoming boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.nama, p.username, p.kode_id, p.karakter_pilihan, f.status, f.addressee_id = p_id
  FROM public.friendships f
  JOIN public.profiles p ON p.id = CASE WHEN f.requester_id = p_id THEN f.addressee_id ELSE f.requester_id END
  WHERE public.me_ok(p_id, p_kode) AND (f.requester_id = p_id OR f.addressee_id = p_id)
  ORDER BY f.status, p.nama;
$$;

GRANT EXECUTE ON FUNCTION public.me_ok(uuid, text), public.send_chat(uuid, text, uuid, text), public.list_dm(uuid, text, uuid),
  public.send_friend_request(uuid, text, text), public.respond_friend(uuid, text, uuid, boolean), public.list_friends(uuid, text) TO anon, authenticated;

CREATE TABLE public.admin_profiles (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_profiles TO service_role;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.first_profile_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_profiles) THEN
    INSERT INTO public.admin_profiles(profile_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER profiles_first_admin AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.first_profile_admin();

CREATE OR REPLACE FUNCTION public.is_admin(p_id uuid, p_kode text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_profiles a JOIN public.profiles p ON p.id = a.profile_id
    WHERE p.id = p_id AND p.kode_id = p_kode
  )
$$;
REVOKE EXECUTE ON FUNCTION public.first_profile_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid, text) TO anon, authenticated;

CREATE TABLE public.account_locks (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  pass_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.account_locks TO service_role;
ALTER TABLE public.account_locks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_password(p_id uuid, p_kode text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.account_locks l JOIN public.profiles p ON p.id = l.profile_id WHERE p.id = p_id AND p.kode_id = p_kode);
$$;

CREATE OR REPLACE FUNCTION public.set_password(p_id uuid, p_kode text, p_old text, p_new text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE h text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_id AND kode_id = p_kode) THEN RAISE EXCEPTION 'Akun tidak ditemukan'; END IF;
  SELECT pass_hash INTO h FROM public.account_locks WHERE profile_id = p_id;
  IF h IS NOT NULL AND (p_old IS NULL OR crypt(p_old, h) <> h) THEN RAISE EXCEPTION 'Password lama salah'; END IF;
  IF p_new IS NULL OR length(p_new) = 0 THEN
    DELETE FROM public.account_locks WHERE profile_id = p_id;
    RETURN;
  END IF;
  IF length(p_new) < 4 OR length(p_new) > 72 THEN RAISE EXCEPTION 'Password harus 4-72 karakter'; END IF;
  INSERT INTO public.account_locks(profile_id, pass_hash) VALUES (p_id, crypt(p_new, gen_salt('bf')))
  ON CONFLICT (profile_id) DO UPDATE SET pass_hash = EXCLUDED.pass_hash, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.login_secure(p_kode text, p_nama text, p_pass text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE r public.profiles; h text;
BEGIN
  SELECT * INTO r FROM public.profiles
  WHERE kode_id = upper(trim(p_kode))
    AND (lower(trim(nama)) = lower(trim(p_nama)) OR lower(username) = lower(trim(p_nama)))
  LIMIT 1;
  IF r.id IS NULL THEN RETURN jsonb_build_object('status', 'notfound'); END IF;
  SELECT pass_hash INTO h FROM public.account_locks WHERE profile_id = r.id;
  IF h IS NOT NULL THEN
    IF p_pass IS NULL OR p_pass = '' THEN RETURN jsonb_build_object('status', 'need_password'); END IF;
    IF crypt(p_pass, h) <> h THEN RETURN jsonb_build_object('status', 'wrong'); END IF;
  END IF;
  RETURN jsonb_build_object('status', 'ok', 'profile', to_jsonb(r));
END $$;