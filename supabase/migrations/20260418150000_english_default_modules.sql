-- ==============================================
-- 1) Update handle_new_course trigger to use English default module name ('Module 1')
-- 2) Rename existing "Boas-vindas ao ..." modules and intro lessons to English
-- ==============================================

-- 1. Update trigger to create modules in English
CREATE OR REPLACE FUNCTION public.handle_new_course()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.modules (course_id, title, description, sort_order, is_default)
  VALUES (NEW.id, 'Module 1', NULL, 0, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Rename existing modules that were renamed in the previous migration
UPDATE public.modules m
SET title = 'Welcome to ' || c.title
FROM public.courses c
WHERE m.course_id = c.id
  AND m.title = 'Boas-vindas ao ' || c.title;

-- 3. Rename intro lessons created in the previous migration
UPDATE public.lessons l
SET title = 'Introduction: ' || c.title,
    description = 'Opening lesson with course overview and learning objectives.'
FROM public.modules m
JOIN public.courses c ON c.id = m.course_id
WHERE l.module_id = m.id
  AND l.title = 'Introdução: ' || c.title;
