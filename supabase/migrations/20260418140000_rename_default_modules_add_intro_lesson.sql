-- ==============================================
-- Rename default "Modulo inicial" modules and add intro lesson with YouTube video
-- For every course that still has the default module, rename it to a course-related title
-- and insert 1 welcome/intro lesson with a unique YouTube video.
-- ==============================================

DO $$
DECLARE
  r RECORD;
  video_urls TEXT[] := ARRAY[
    'https://www.youtube.com/embed/8aGhZQkoFbQ',
    'https://www.youtube.com/embed/BJjsfNO5JTo',
    'https://www.youtube.com/embed/WPvGqX-TXP0',
    'https://www.youtube.com/embed/Tn6-PIqc4UM',
    'https://www.youtube.com/embed/zOjov-2OZ0E',
    'https://www.youtube.com/embed/w7ejDZ8SWv8',
    'https://www.youtube.com/embed/PkZNo7MFNFg',
    'https://www.youtube.com/embed/DHvZLI7Db8E',
    'https://www.youtube.com/embed/Ke90Tje7VS0',
    'https://www.youtube.com/embed/UB1O30fR-EE',
    'https://www.youtube.com/embed/pTB0EiLXUC8',
    'https://www.youtube.com/embed/W6NZfCO5SIk',
    'https://www.youtube.com/embed/hdI2bqOjy3c',
    'https://www.youtube.com/embed/jS4aFq5-91M',
    'https://www.youtube.com/embed/WGJJIrtnfpk',
    'https://www.youtube.com/embed/Oe421EPjeBE',
    'https://www.youtube.com/embed/5fb2aPlgoys',
    'https://www.youtube.com/embed/qz0aGYrrlhU',
    'https://www.youtube.com/embed/SccSCuHhOw0',
    'https://www.youtube.com/embed/eIrMbAQSU34',
    'https://www.youtube.com/embed/3PHXvlpOkf4',
    'https://www.youtube.com/embed/XKHEtdqhLK8',
    'https://www.youtube.com/embed/EerdGm-ehJQ',
    'https://www.youtube.com/embed/NCwa_xi0Uuc',
    'https://www.youtube.com/embed/f79MRyMsjrQ',
    'https://www.youtube.com/embed/XIOs2YVJ5nE',
    'https://www.youtube.com/embed/gzAdSUOsf_A',
    'https://www.youtube.com/embed/lHiuaihXas4',
    'https://www.youtube.com/embed/rJzxsBkucGU',
    'https://www.youtube.com/embed/9P8mASSREYM'
  ];
  idx INT := 1;
  total_videos INT := array_length(video_urls, 1);
  new_title TEXT;
  intro_lesson_title TEXT;
BEGIN
  FOR r IN
    SELECT m.id AS module_id, m.course_id, c.title AS course_title
    FROM public.modules m
    JOIN public.courses c ON c.id = m.course_id
    WHERE m.title = 'Modulo inicial'
      AND m.is_default = true
    ORDER BY c.created_at ASC, c.id ASC
  LOOP
    -- Rename module based on course title
    new_title := 'Boas-vindas ao ' || r.course_title;
    intro_lesson_title := 'Introdução: ' || r.course_title;

    UPDATE public.modules
    SET title = new_title,
        description = 'Módulo de abertura do curso'
    WHERE id = r.module_id;

    -- Insert intro lesson only if module doesn't already have lessons
    IF NOT EXISTS (SELECT 1 FROM public.lessons WHERE module_id = r.module_id) THEN
      INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
      VALUES (
        r.module_id,
        intro_lesson_title,
        'Aula de abertura com visão geral do curso e objetivos de aprendizado.',
        video_urls[idx],
        900,
        0,
        true
      );

      -- Rotate video index (wrap around if exceeds)
      idx := idx + 1;
      IF idx > total_videos THEN
        idx := 1;
      END IF;
    END IF;
  END LOOP;
END $$;
