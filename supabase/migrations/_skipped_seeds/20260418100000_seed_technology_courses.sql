-- ==============================================
-- Seed: 5 Technology Courses with Modules and Lessons
-- Tenant: hub_0fd699cfbc4d (lookup by slug)
-- ==============================================

-- Get tenant_id by slug (hub_0fd699cfbc4d is the slug, not UUID)
WITH tenant_lookup AS (
  SELECT id AS tenant_id FROM public.tenants WHERE public_id = 'hub_0fd699cfbc4d'
)

-- 1. AI & Machine Learning Fundamentals
,course_1 AS (
  INSERT INTO public.courses (tenant_id, slug, title, description, is_active)
  SELECT tenant_id, 'ai-fundamentals', 'AI & Machine Learning Fundamentals', 
  'Learn the basics of artificial intelligence and machine learning. From neural networks to deep learning, master the foundations of modern AI.', true
  FROM tenant_lookup
  ON CONFLICT DO NOTHING
  RETURNING id, tenant_id
)

-- Module 1: Introduction to AI
,module_1_1 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Introduction to AI', 'Understand what AI is and its real-world applications', 0
  FROM course_1
  RETURNING id, course_id
)

-- Lessons for Module 1.1
,lesson_1_1_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'What is Artificial Intelligence?', 'Overview of AI concepts and history', 
  'https://www.youtube.com/embed/ad79nYk2kZo', 1200, 0, true
  FROM module_1_1
  RETURNING id
)
,lesson_1_1_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Real-World AI Applications', 'Practical uses of AI in industry', 
  'https://www.youtube.com/embed/F1jZqcp-oNE', 900, 1, true
  FROM module_1_1
  RETURNING id
)

-- Module 2: Machine Learning Basics
,module_1_2 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Machine Learning Basics', 'Core ML algorithms and concepts', 1
  FROM course_1
  RETURNING id, course_id
)

-- Lessons for Module 1.2
,lesson_1_2_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Supervised vs Unsupervised Learning', 'Learn the two main paradigms of ML', 
  'https://www.youtube.com/embed/Lte5VW-7P-0', 1200, 0, true
  FROM module_1_2
  RETURNING id
)
,lesson_1_2_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Linear Regression Explained', 'Understanding the basics of regression', 
  'https://www.youtube.com/embed/zPG4NjIkCok', 1500, 1, true
  FROM module_1_2
  RETURNING id
)

-- Module 3: Neural Networks & Deep Learning
,module_1_3 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Neural Networks & Deep Learning', 'Advanced neural network architectures', 2
  FROM course_1
  RETURNING id, course_id
)

-- Lessons for Module 1.3
,lesson_1_3_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Introduction to Neural Networks', 'How neural networks work and why they matter', 
  'https://www.youtube.com/embed/aircAruvnKk', 1800, 0, true
  FROM module_1_3
  RETURNING id
)
,lesson_1_3_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Deep Learning & CNNs', 'Convolutional neural networks for image recognition', 
  'https://www.youtube.com/embed/nDPWbc9KxCw', 2100, 1, true
  FROM module_1_3
  RETURNING id
)

-- 2. Web Development Masterclass
,course_2 AS (
  INSERT INTO public.courses (tenant_id, slug, title, description, is_active)
  SELECT tenant_id, 'web-development', 'Web Development Masterclass', 
  'Master modern web development from HTML, CSS, and JavaScript to advanced React patterns. Build professional, responsive web applications.', true
  FROM tenant_lookup
  ON CONFLICT DO NOTHING
  RETURNING id, tenant_id
)

-- Module 1: HTML & CSS Foundations
,module_2_1 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'HTML & CSS Foundations', 'Learn the building blocks of web pages', 0
  FROM course_2
  RETURNING id, course_id
)

-- Lessons for Module 2.1
,lesson_2_1_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'HTML Basics and Semantics', 'Understanding HTML structure and semantic elements', 
  'https://www.youtube.com/embed/qz0aGYrrlhU', 1200, 0, true
  FROM module_2_1
  RETURNING id
)
,lesson_2_1_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'CSS Styling and Layouts', 'Flexbox, Grid, and responsive design principles', 
  'https://www.youtube.com/embed/OXGznpKZ_sA', 1500, 1, true
  FROM module_2_1
  RETURNING id
)
,lesson_2_1_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Responsive Web Design', 'Mobile-first approach and media queries', 
  'https://www.youtube.com/embed/srvUrASNj0s', 1200, 2, true
  FROM module_2_1
  RETURNING id
)

-- Module 2: JavaScript Essentials
,module_2_2 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'JavaScript Essentials', 'Core JavaScript concepts and best practices', 1
  FROM course_2
  RETURNING id, course_id
)

-- Lessons for Module 2.2
,lesson_2_2_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'JavaScript Fundamentals', 'Variables, functions, closures, and scope', 
  'https://www.youtube.com/embed/W6NZfCO5tTE', 1500, 0, true
  FROM module_2_2
  RETURNING id
)
,lesson_2_2_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'DOM Manipulation and Events', 'Interacting with the DOM and handling user events', 
  'https://www.youtube.com/embed/5fb2aS1qjSo', 1300, 1, true
  FROM module_2_2
  RETURNING id
)

-- Module 3: React & Modern Frameworks
,module_2_3 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'React & Modern Frameworks', 'Building modern web apps with React', 2
  FROM course_2
  RETURNING id, course_id
)

-- Lessons for Module 2.3
,lesson_2_3_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'React Fundamentals', 'Components, hooks, and state management', 
  'https://www.youtube.com/embed/Ke90Tje7VS0', 1500, 0, true
  FROM module_2_3
  RETURNING id
)
,lesson_2_3_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Advanced React Patterns', 'Context API, custom hooks, and performance optimization', 
  'https://www.youtube.com/embed/nI14i10l3-0', 1800, 1, true
  FROM module_2_3
  RETURNING id
)

-- 3. Python for Data Science
,course_3 AS (
  INSERT INTO public.courses (tenant_id, slug, title, description, is_active)
  SELECT tenant_id, 'python-data-science', 'Python for Data Science', 
  'Learn Python programming with a focus on data analysis, manipulation, and visualization. Master Pandas, NumPy, and Matplotlib.', true
  FROM tenant_lookup
  ON CONFLICT DO NOTHING
  RETURNING id, tenant_id
)

-- Module 1: Python Fundamentals
,module_3_1 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Python Fundamentals', 'Getting started with Python programming', 0
  FROM course_3
  RETURNING id, course_id
)

-- Lessons for Module 3.1
,lesson_3_1_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Python Basics and Syntax', 'Variables, data types, and control structures', 
  'https://www.youtube.com/embed/LHBE6Q9XlzI', 1200, 0, true
  FROM module_3_1
  RETURNING id
)
,lesson_3_1_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Functions and Modules', 'Writing reusable code with functions and imports', 
  'https://www.youtube.com/embed/F5XqxnJD-B4', 1400, 1, true
  FROM module_3_1
  RETURNING id
)

-- Module 2: Data Analysis with Pandas
,module_3_2 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Data Analysis with Pandas', 'DataFrames, cleaning, and data manipulation', 1
  FROM course_3
  RETURNING id, course_id
)

-- Lessons for Module 3.2
,lesson_3_2_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Pandas DataFrames Essentials', 'Creating, loading, and manipulating data', 
  'https://www.youtube.com/embed/vmEHCJofslg', 1500, 0, true
  FROM module_3_2
  RETURNING id
)
,lesson_3_2_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Data Cleaning and Transformation', 'Handling missing data and transforming datasets', 
  'https://www.youtube.com/embed/bDhvCp3-teE', 1600, 1, true
  FROM module_3_2
  RETURNING id
)

-- Module 3: Data Visualization
,module_3_3 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Data Visualization', 'Creating meaningful visualizations with Python', 2
  FROM course_3
  RETURNING id, course_id
)

-- Lessons for Module 3.3
,lesson_3_3_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Matplotlib and Seaborn Basics', 'Creating plots and statistical visualizations', 
  'https://www.youtube.com/embed/q7Bo_J8x_dw', 1400, 0, true
  FROM module_3_3
  RETURNING id
)
,lesson_3_3_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Interactive Dashboards with Plotly', 'Building interactive data visualizations', 
  'https://www.youtube.com/embed/u4yJWoFZ5oY', 1500, 1, true
  FROM module_3_3
  RETURNING id
)

-- 4. Cloud & DevOps Essentials
,course_4 AS (
  INSERT INTO public.courses (tenant_id, slug, title, description, is_active)
  SELECT tenant_id, 'cloud-devops', 'Cloud & DevOps Essentials', 
  'Master cloud computing, containerization, and orchestration. Deploy and scale applications with Docker and Kubernetes.', true
  FROM tenant_lookup
  ON CONFLICT DO NOTHING
  RETURNING id, tenant_id
)

-- Module 1: Cloud Computing Basics
,module_4_1 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Cloud Computing Basics', 'Understanding cloud services and providers', 0
  FROM course_4
  RETURNING id, course_id
)

-- Lessons for Module 4.1
,lesson_4_1_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Cloud Services Overview', 'IaaS, PaaS, SaaS and major cloud providers', 
  'https://www.youtube.com/embed/NQohXvfzEeE', 1300, 0, true
  FROM module_4_1
  RETURNING id
)
,lesson_4_1_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Deploying Applications to the Cloud', 'Best practices for cloud deployments', 
  'https://www.youtube.com/embed/X48VuDVv0Z0', 1400, 1, true
  FROM module_4_1
  RETURNING id
)

-- Module 2: Containerization & Docker
,module_4_2 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Containerization & Docker', 'Building and managing Docker containers', 1
  FROM course_4
  RETURNING id, course_id
)

-- Lessons for Module 4.2
,lesson_4_2_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Docker Fundamentals', 'Images, containers, and Docker CLI', 
  'https://www.youtube.com/embed/3c-iBn73dDE', 1500, 0, true
  FROM module_4_2
  RETURNING id
)
,lesson_4_2_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Docker Compose and Multi-Container Apps', 'Orchestrating multiple containers locally', 
  'https://www.youtube.com/embed/ZX3t-KksKeM', 1400, 1, true
  FROM module_4_2
  RETURNING id
)

-- Module 3: Kubernetes Orchestration
,module_4_3 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Kubernetes Orchestration', 'Container orchestration at scale', 2
  FROM course_4
  RETURNING id, course_id
)

-- Lessons for Module 4.3
,lesson_4_3_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Kubernetes Architecture and Concepts', 'Pods, services, and deployments', 
  'https://www.youtube.com/embed/s_o8dwzRlu4', 1600, 0, true
  FROM module_4_3
  RETURNING id
)
,lesson_4_3_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Deploying and Managing Apps with K8s', 'CI/CD pipelines and production deployments', 
  'https://www.youtube.com/embed/X48VuDVv0Z0', 1700, 1, true
  FROM module_4_3
  RETURNING id
)

-- 5. Mobile Development with React Native
,course_5 AS (
  INSERT INTO public.courses (tenant_id, slug, title, description, is_active)
  SELECT tenant_id, 'react-native-mobile', 'Mobile Development with React Native', 
  'Build cross-platform mobile applications for iOS and Android using React Native. Master navigation, state management, and native APIs.', true
  FROM tenant_lookup
  ON CONFLICT DO NOTHING
  RETURNING id, tenant_id
)

-- Module 1: React Native Fundamentals
,module_5_1 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'React Native Fundamentals', 'Getting started with React Native development', 0
  FROM course_5
  RETURNING id, course_id
)

-- Lessons for Module 5.1
,lesson_5_1_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'React Native Setup and First App', 'Environment setup and creating your first mobile app', 
  'https://www.youtube.com/embed/FrFZWsCEV8k', 1500, 0, true
  FROM module_5_1
  RETURNING id
)
,lesson_5_1_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Components and Styling in React Native', 'Built-in components and styling methods', 
  'https://www.youtube.com/embed/0-S5a0eS84c', 1400, 1, true
  FROM module_5_1
  RETURNING id
)

-- Module 2: Navigation & State Management
,module_5_2 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Navigation & State Management', 'React Navigation and state management patterns', 1
  FROM course_5
  RETURNING id, course_id
)

-- Lessons for Module 5.2
,lesson_5_2_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'React Navigation Fundamentals', 'Stack, tab, and drawer navigation', 
  'https://www.youtube.com/embed/fW-_lqXwYWc', 1500, 0, true
  FROM module_5_2
  RETURNING id
)
,lesson_5_2_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'State Management with Context and Redux', 'Managing app state efficiently', 
  'https://www.youtube.com/embed/W6i4SoKYv3c', 1600, 1, true
  FROM module_5_2
  RETURNING id
)

-- Module 3: Advanced Patterns & APIs
,module_5_3 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Advanced Patterns & APIs', 'Accessing native APIs and advanced patterns', 2
  FROM course_5
  RETURNING id, course_id
)

-- Lessons for Module 5.3
,lesson_5_3_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Accessing Native Modules and APIs', 'Camera, geolocation, and device features', 
  'https://www.youtube.com/embed/S9QkVxLR_wI', 1400, 0, true
  FROM module_5_3
  RETURNING id
)
,lesson_5_3_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Performance Optimization and Deployment', 'Profiling, optimization, and app store deployment', 
  'https://www.youtube.com/embed/tqSNMPVKlf4', 1500, 1, true
  FROM module_5_3
  RETURNING id
)

-- Final query to confirm success
SELECT 'All courses created successfully!' AS status;
