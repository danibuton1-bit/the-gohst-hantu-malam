ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS countdown_until timestamptz;
CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('lobby_bg','music_lobby','music_game','sfx_ghost')),
  ghost text,
  media_type text NOT NULL DEFAULT 'image',
  path text NOT NULL,
  url text NOT NULL,
  nama text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.media_assets TO anon, authenticated;
GRANT ALL ON public.media_assets TO service_role;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media readable" ON public.media_assets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "game media public read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'game-media');