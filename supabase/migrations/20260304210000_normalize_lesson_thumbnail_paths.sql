-- Normalize lesson thumbnail references to plain object paths.
-- New standard: lessons.thumbnail_url stores only the file path in the public `covers` bucket.

CREATE OR REPLACE FUNCTION public.normalize_lesson_thumbnail_path(_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
  marker constant text := '/storage/v1/object/public/';
  marker_pos integer;
  object_ref text;
  slash_pos integer;
  bucket text;
  object_path text;
BEGIN
  IF _value IS NULL THEN
    RETURN NULL;
  END IF;

  v := btrim(_value);
  IF v = '' THEN
    RETURN NULL;
  END IF;

  -- Strip cache busters and fragments.
  v := split_part(split_part(v, '#', 1), '?', 1);

  -- If this is already a plain path, keep only the normalized path.
  IF left(lower(v), 4) <> 'http' THEN
    RETURN ltrim(v, '/');
  END IF;

  -- Convert Supabase public object URLs into path-only values.
  marker_pos := position(marker in v);
  IF marker_pos > 0 THEN
    object_ref := substr(v, marker_pos + char_length(marker));
    slash_pos := position('/' in object_ref);

    IF slash_pos > 0 THEN
      bucket := left(object_ref, slash_pos - 1);
      object_path := substr(object_ref, slash_pos + 1);

      -- `assets` is accepted as legacy source; files are backfilled to `covers`.
      IF bucket IN ('covers', 'assets') THEN
        RETURN object_path;
      END IF;
    END IF;
  END IF;

  -- External URL (not storage) stays as URL.
  RETURN v;
END;
$$;

UPDATE public.lessons
SET thumbnail_url = public.normalize_lesson_thumbnail_path(thumbnail_url)
WHERE thumbnail_url IS NOT NULL;
