-- Existing storefront addresses stay unchanged. New collisions use a random numeric suffix.
CREATE OR REPLACE FUNCTION vendor_slug_from(name text, own_id uuid) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  base text := left(trim(both '-' from regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '-', 'g')), 44);
  candidate text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('vendor_slug'));
  base := trim(both '-' from base);
  IF length(base) < 2 THEN base := 'shop'; END IF;
  IF vendor_slug_reserved(base) THEN base := left(base, 39) || '-shop'; END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM vendors WHERE slug = candidate AND id IS DISTINCT FROM own_id) LOOP
    candidate := base || '-' || (10000 + floor(random() * 90000)::int)::text;
  END LOOP;
  RETURN candidate;
END;
$$;
