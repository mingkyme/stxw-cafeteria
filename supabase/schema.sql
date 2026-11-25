-- First-time setup for a dedicated Supabase project.
-- Public readers can SELECT only. Secret-key access is server/local only.
BEGIN;

CREATE TABLE public.meals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cafeteria text NOT NULL DEFAULT 'stxw 타워 구내식당'
    CHECK (length(btrim(cafeteria)) > 0),
  meal_date date NOT NULL,
  meal_type text NOT NULL DEFAULT 'lunch'
    CONSTRAINT meals_lunch_only CHECK (meal_type = 'lunch'),
  corner text NOT NULL DEFAULT '기본'
    CHECK (length(btrim(corner)) > 0),
  menus text[] NOT NULL
    CHECK (cardinality(menus) > 0 AND array_ndims(menus) = 1
      AND array_position(menus, NULL) IS NULL),
  source_path text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meals_date_slot_unique
    UNIQUE (cafeteria, meal_date, meal_type, corner)
);

CREATE INDEX meals_meal_date_idx ON public.meals (meal_date);

CREATE FUNCTION public.set_meals_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER meals_set_updated_at
BEFORE UPDATE ON public.meals
FOR EACH ROW EXECUTE FUNCTION public.set_meals_updated_at();

ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.meals FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.meals_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.meals TO anon, authenticated;
GRANT ALL ON TABLE public.meals TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.meals_id_seq TO service_role;

CREATE POLICY meals_public_read
ON public.meals FOR SELECT
TO anon, authenticated
USING (true);

COMMENT ON COLUMN public.meals.source_path IS
  'Public source URL/path only. Never store secrets or private local paths here.';

NOTIFY pgrst, 'reload schema';
COMMIT;
