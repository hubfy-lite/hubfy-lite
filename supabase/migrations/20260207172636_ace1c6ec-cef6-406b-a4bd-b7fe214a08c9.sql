-- 1. Create course category enum
CREATE TYPE public.course_category AS ENUM (
  'business_entrepreneurship',
  'marketing_sales',
  'finance_investments',
  'technology_programming',
  'ai_automation',
  'design_creativity',
  'productivity_organization',
  'career_professional',
  'education_learning',
  'health_wellbeing',
  'fitness_performance',
  'nutrition_food',
  'personal_development',
  'relationships_social',
  'hobbies_lifestyle'
);

-- 2. Add category column to courses
ALTER TABLE public.courses
ADD COLUMN category public.course_category NULL;

-- 3. Rename thumbnail_url to cover_vertical_url
ALTER TABLE public.courses
RENAME COLUMN thumbnail_url TO cover_vertical_url;

-- 4. Add cover_horizontal_url column
ALTER TABLE public.courses
ADD COLUMN cover_horizontal_url text NULL;

-- 5. Add thumbnail_url to lessons
ALTER TABLE public.lessons
ADD COLUMN thumbnail_url text NULL;