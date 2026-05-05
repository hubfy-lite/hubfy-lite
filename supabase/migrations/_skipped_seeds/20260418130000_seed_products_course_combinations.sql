-- ==============================================
-- Seed: 9 Products with Course Combinations
-- Tenant: hub_0fd699cfbc4d
-- Combines 11 existing courses in random groups (1-4 courses per product)
-- ==============================================

WITH tenant_lookup AS (
  SELECT id AS tenant_id FROM public.tenants WHERE public_id = 'hub_0fd699cfbc4d'
),

-- Lookup all 11 courses
courses_lookup AS (
  SELECT
    id,
    slug,
    title,
    CASE slug
      WHEN 'generative-ai-llms' THEN 1
      WHEN 'frontend-react' THEN 2
      WHEN 'data-analytics' THEN 3
      WHEN 'kubernetes' THEN 4
      WHEN 'react-native-mobile' THEN 5
      WHEN 'fullstack-web-development' THEN 6
      WHEN 'python-programming-mastery' THEN 7
      WHEN 'backend-architecture-system-design' THEN 8
      WHEN 'creative-coding-generative-art' THEN 9
      WHEN 'ai-agents-automation' THEN 10
      WHEN 'modern-programming-languages' THEN 11
    END as course_idx
  FROM public.courses
  WHERE tenant_id = (SELECT tenant_id FROM tenant_lookup)
    AND slug IN (
      'generative-ai-llms',
      'frontend-react',
      'data-analytics',
      'kubernetes',
      'react-native-mobile',
      'fullstack-web-development',
      'python-programming-mastery',
      'backend-architecture-system-design',
      'creative-coding-generative-art',
      'ai-agents-automation',
      'modern-programming-languages'
    )
),

-- 1. Full-Stack Fundamentals (2 courses: Frontend React + Full-Stack Web Development)
product_1 AS (
  INSERT INTO public.products (tenant_id, name, description, status, unit_amount, currency)
  SELECT tenant_id,
    'Full-Stack Fundamentals Bundle',
    'Learn frontend with React and complete full-stack development. Perfect for web developers starting their journey.',
    'draft', 0, 'BRL'
  FROM tenant_lookup
  RETURNING id
),
pc_1_1 AS (
  INSERT INTO public.product_courses (product_id, course_id)
  SELECT (SELECT id FROM product_1), id
  FROM courses_lookup
  WHERE slug IN ('frontend-react', 'fullstack-web-development')
),

-- 2. Python Data Science Bundle (2 courses: Python Programming Mastery + Data Analytics)
product_2 AS (
  INSERT INTO public.products (tenant_id, name, description, status, unit_amount, currency)
  SELECT tenant_id,
    'Python Data Science Master',
    'Master Python programming and data analytics. Ideal for aspiring data scientists and analysts.',
    'draft', 0, 'BRL'
  FROM tenant_lookup
  RETURNING id
),
pc_2_1 AS (
  INSERT INTO public.product_courses (product_id, course_id)
  SELECT (SELECT id FROM product_2), id
  FROM courses_lookup
  WHERE slug IN ('python-programming-mastery', 'data-analytics')
),

-- 3. Mobile Development Pro (2 courses: React Native Mobile + Full-Stack Web Development)
product_3 AS (
  INSERT INTO public.products (tenant_id, name, description, status, unit_amount, currency)
  SELECT tenant_id,
    'Mobile Development Pro Bundle',
    'Build mobile and web applications. Learn React Native for mobile and full-stack backend skills.',
    'draft', 0, 'BRL'
  FROM tenant_lookup
  RETURNING id
),
pc_3_1 AS (
  INSERT INTO public.product_courses (product_id, course_id)
  SELECT (SELECT id FROM product_3), id
  FROM courses_lookup
  WHERE slug IN ('react-native-mobile', 'fullstack-web-development')
),

-- 4. AI & Machine Learning Suite (3 courses: Generative AI & LLMs + Python Programming + AI Agents & Automation)
product_4 AS (
  INSERT INTO public.products (tenant_id, name, description, status, unit_amount, currency)
  SELECT tenant_id,
    'AI & Machine Learning Suite',
    'Complete AI education. Learn LLMs, Python programming, and build intelligent automated systems.',
    'draft', 0, 'BRL'
  FROM tenant_lookup
  RETURNING id
),
pc_4_1 AS (
  INSERT INTO public.product_courses (product_id, course_id)
  SELECT (SELECT id FROM product_4), id
  FROM courses_lookup
  WHERE slug IN ('generative-ai-llms', 'python-programming-mastery', 'ai-agents-automation')
),

-- 5. Backend Mastery (3 courses: Backend Architecture + Kubernetes + Full-Stack Web)
product_5 AS (
  INSERT INTO public.products (tenant_id, name, description, status, unit_amount, currency)
  SELECT tenant_id,
    'Backend Infrastructure Mastery',
    'Master backend development. Learn system design, Kubernetes orchestration, and modern APIs.',
    'draft', 0, 'BRL'
  FROM tenant_lookup
  RETURNING id
),
pc_5_1 AS (
  INSERT INTO public.product_courses (product_id, course_id)
  SELECT (SELECT id FROM product_5), id
  FROM courses_lookup
  WHERE slug IN ('backend-architecture-system-design', 'kubernetes', 'fullstack-web-development')
),

-- 6. Creative Tech Bundle (2 courses: Creative Coding & Generative Art + Generative AI & LLMs)
product_6 AS (
  INSERT INTO public.products (tenant_id, name, description, status, unit_amount, currency)
  SELECT tenant_id,
    'Creative Technology Bundle',
    'Combine art and AI. Learn generative art techniques and LLMs for creative automation.',
    'draft', 0, 'BRL'
  FROM tenant_lookup
  RETURNING id
),
pc_6_1 AS (
  INSERT INTO public.product_courses (product_id, course_id)
  SELECT (SELECT id FROM product_6), id
  FROM courses_lookup
  WHERE slug IN ('creative-coding-generative-art', 'generative-ai-llms')
),

-- 7. Complete Programming Path (4 courses: Python + Frontend React + Backend Architecture + Modern Languages)
product_7 AS (
  INSERT INTO public.products (tenant_id, name, description, status, unit_amount, currency)
  SELECT tenant_id,
    'Complete Programming Path',
    'Comprehensive programming education. Learn Python, frontend, backend, and modern programming languages.',
    'draft', 0, 'BRL'
  FROM tenant_lookup
  RETURNING id
),
pc_7_1 AS (
  INSERT INTO public.product_courses (product_id, course_id)
  SELECT (SELECT id FROM product_7), id
  FROM courses_lookup
  WHERE slug IN ('python-programming-mastery', 'frontend-react', 'backend-architecture-system-design', 'modern-programming-languages')
),

-- 8. DevOps & Cloud Infrastructure (3 courses: Kubernetes + Backend Architecture + Generative AI)
product_8 AS (
  INSERT INTO public.products (tenant_id, name, description, status, unit_amount, currency)
  SELECT tenant_id,
    'DevOps & Cloud Infrastructure',
    'Build scalable systems. Learn Kubernetes, system design, and intelligent cloud automation with AI.',
    'draft', 0, 'BRL'
  FROM tenant_lookup
  RETURNING id
),
pc_8_1 AS (
  INSERT INTO public.product_courses (product_id, course_id)
  SELECT (SELECT id FROM product_8), id
  FROM courses_lookup
  WHERE slug IN ('kubernetes', 'backend-architecture-system-design', 'generative-ai-llms')
),

-- 9. AI Automation Specialist (3 courses: AI Agents & Automation + Modern Languages + Python)
product_9 AS (
  INSERT INTO public.products (tenant_id, name, description, status, unit_amount, currency)
  SELECT tenant_id,
    'AI Automation Specialist',
    'Build intelligent automation systems. Learn AI agents, modern languages, and Python for automation workflows.',
    'draft', 0, 'BRL'
  FROM tenant_lookup
  RETURNING id
),
pc_9_1 AS (
  INSERT INTO public.product_courses (product_id, course_id)
  SELECT (SELECT id FROM product_9), id
  FROM courses_lookup
  WHERE slug IN ('ai-agents-automation', 'modern-programming-languages', 'python-programming-mastery')
)

SELECT 'Products created successfully' as status;
