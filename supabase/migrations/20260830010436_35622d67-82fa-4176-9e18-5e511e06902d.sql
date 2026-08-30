CREATE TABLE public.prayer_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  day DATE NOT NULL,
  prayer TEXT NOT NULL,
  answer TEXT NOT NULL CHECK (answer IN ('yes','no')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day, prayer)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prayer_logs TO authenticated;
GRANT ALL ON public.prayer_logs TO service_role;
ALTER TABLE public.prayer_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own prayer logs" ON public.prayer_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);