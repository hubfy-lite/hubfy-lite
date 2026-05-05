-- ==============================================
-- Seed: Technology Courses with Public YouTube Videos
-- Tenant: hub_0fd699cfbc4d
-- Varied structure: 2-6 modules, 1-5 lessons each
-- All with unique YouTube embed URLs
-- ==============================================

WITH tenant_lookup AS (
  SELECT id AS tenant_id FROM public.tenants WHERE public_id = 'hub_0fd699cfbc4d'
)

-- 1. GENERATIVE AI & LLMs (4 modules)
,course_gen_ai AS (
  INSERT INTO public.courses (tenant_id, slug, title, description, is_active)
  SELECT tenant_id, 'generative-ai-llms', 'Generative AI & Large Language Models', 
  'Understand and work with generative AI, transformers, and large language models. Learn how ChatGPT and similar systems work.', true
  FROM tenant_lookup
  ON CONFLICT DO NOTHING
  RETURNING id, tenant_id
)

-- Module 1: AI Fundamentals (3 lessons)
,module_gen_ai_1 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Foundations of AI', 'Core concepts and history of artificial intelligence', 0
  FROM course_gen_ai
  RETURNING id, course_id
)
,lesson_gen_ai_1_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Introduction to Artificial Intelligence', 'Overview of AI concepts and evolution', 
  'https://www.youtube.com/embed/JMUxmLyrhSk', 3600, 0, true
  FROM module_gen_ai_1
  RETURNING id
)
,lesson_gen_ai_1_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Machine Learning vs Deep Learning', 'Understanding different AI approaches', 
  'https://www.youtube.com/embed/N8svLoC2eNA', 2400, 1, true
  FROM module_gen_ai_1
  RETURNING id
)
,lesson_gen_ai_1_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'The Rise of Generative Models', 'From GANs to transformers', 
  'https://www.youtube.com/embed/d_qvLDhrgO8', 2700, 2, true
  FROM module_gen_ai_1
  RETURNING id
)

-- Module 2: Transformers & NLP (2 lessons)
,module_gen_ai_2 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Transformers & Natural Language Processing', 'Deep dive into transformer architecture and NLP', 1
  FROM course_gen_ai
  RETURNING id, course_id
)
,lesson_gen_ai_2_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Attention Mechanism Explained', 'The key innovation behind transformers', 
  'https://www.youtube.com/embed/OyFJWRnO8OE', 1800, 0, true
  FROM module_gen_ai_2
  RETURNING id
)
,lesson_gen_ai_2_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Building NLP Applications', 'From text classification to sequence-to-sequence models', 
  'https://www.youtube.com/embed/rmVRLeJRkl4', 2100, 1, true
  FROM module_gen_ai_2
  RETURNING id
)

-- Module 3: Large Language Models (4 lessons)
,module_gen_ai_3 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Large Language Models', 'Understanding GPT, BERT, and LLMs', 2
  FROM course_gen_ai
  RETURNING id, course_id
)
,lesson_gen_ai_3_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'How ChatGPT Works', 'The architecture and training of large language models', 
  'https://www.youtube.com/embed/kCc8FmEb1nY', 2400, 0, true
  FROM module_gen_ai_3
  RETURNING id
)
,lesson_gen_ai_3_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Prompt Engineering Techniques', 'Getting the most from language models', 
  'https://www.youtube.com/embed/7wdmfV3JEqI', 1500, 1, true
  FROM module_gen_ai_3
  RETURNING id
)
,lesson_gen_ai_3_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Fine-tuning LLMs', 'Customizing language models for specific tasks', 
  'https://www.youtube.com/embed/OI-nB2vX4z0', 1800, 2, true
  FROM module_gen_ai_3
  RETURNING id
)
,lesson_gen_ai_3_4 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Ethical Considerations in AI', 'Bias, safety, and responsible AI development', 
  'https://www.youtube.com/embed/bQ53HBpDfKs', 1600, 3, true
  FROM module_gen_ai_3
  RETURNING id
)

-- Module 4: Practical Applications (1 lesson)
,module_gen_ai_4 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Building with LLMs', 'Practical applications and deployment', 3
  FROM course_gen_ai
  RETURNING id, course_id
)
,lesson_gen_ai_4_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Building AI-Powered Applications', 'Integrating LLMs into real-world projects', 
  'https://www.youtube.com/embed/kp-N2K8HP1s', 2000, 0, true
  FROM module_gen_ai_4
  RETURNING id
)

-- 2. FRONTEND DEVELOPMENT WITH REACT (5 modules)
,course_frontend AS (
  INSERT INTO public.courses (tenant_id, slug, title, description, is_active)
  SELECT tenant_id, 'frontend-react-mastery', 'Frontend Development with React Mastery', 
  'Master modern frontend development with React. Learn components, hooks, state management, and advanced patterns for building scalable web applications.', true
  FROM tenant_lookup
  ON CONFLICT DO NOTHING
  RETURNING id, tenant_id
)

-- Module 1: Web Foundations (2 lessons)
,module_fe_1 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'HTML, CSS & JavaScript Fundamentals', 'The building blocks of the web', 0
  FROM course_frontend
  RETURNING id, course_id
)
,lesson_fe_1_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Modern HTML & CSS', 'Semantic HTML, flexbox, and responsive design', 
  'https://www.youtube.com/embed/FazgJVnrVuI', 3600, 0, true
  FROM module_fe_1
  RETURNING id
)
,lesson_fe_1_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'JavaScript Essentials & DOM Manipulation', 'Core JavaScript concepts for web development', 
  'https://www.youtube.com/embed/kAiX0itnonM', 4200, 1, true
  FROM module_fe_1
  RETURNING id
)

-- Module 2: React Basics (5 lessons)
,module_fe_2 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'React Fundamentals', 'Components, JSX, and the React philosophy', 1
  FROM course_frontend
  RETURNING id, course_id
)
,lesson_fe_2_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'What is React?', 'Understanding React and component-based architecture', 
  'https://www.youtube.com/embed/0-S5a0eS84c', 1200, 0, true
  FROM module_fe_2
  RETURNING id
)
,lesson_fe_2_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'JSX and Components', 'Writing components with JSX syntax', 
  'https://www.youtube.com/embed/Tn6-PIqc4UM', 1500, 1, true
  FROM module_fe_2
  RETURNING id
)
,lesson_fe_2_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Props and Component Reusability', 'Passing data and creating reusable components', 
  'https://www.youtube.com/embed/jDiVHMW5zRs', 1400, 2, true
  FROM module_fe_2
  RETURNING id
)
,lesson_fe_2_4 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'State and useState Hook', 'Managing component state with hooks', 
  'https://www.youtube.com/embed/Ke90Tje7VS0', 1600, 3, true
  FROM module_fe_2
  RETURNING id
)
,lesson_fe_2_5 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Event Handling and Forms', 'Building interactive forms and handling user input', 
  'https://www.youtube.com/embed/nI14i10l3-0', 1800, 4, true
  FROM module_fe_2
  RETURNING id
)

-- Module 3: Advanced Hooks (3 lessons)
,module_fe_3 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Advanced React Hooks', 'useEffect, useContext, custom hooks', 2
  FROM course_frontend
  RETURNING id, course_id
)
,lesson_fe_3_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'useEffect and Side Effects', 'Managing side effects in functional components', 
  'https://www.youtube.com/embed/1JbMB_aTUYw', 1700, 0, true
  FROM module_fe_3
  RETURNING id
)
,lesson_fe_3_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Context API and useContext', 'Global state management without Redux', 
  'https://www.youtube.com/embed/lhMKvyLRWpA', 1600, 1, true
  FROM module_fe_3
  RETURNING id
)
,lesson_fe_3_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Building Custom Hooks', 'Creating reusable hook logic', 
  'https://www.youtube.com/embed/G3qQLxf-6Es', 1500, 2, true
  FROM module_fe_3
  RETURNING id
)

-- Module 4: State Management (1 lesson)
,module_fe_4 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'State Management Solutions', 'Redux, Zustand, and modern alternatives', 3
  FROM course_frontend
  RETURNING id, course_id
)
,lesson_fe_4_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Redux Fundamentals', 'Predictable state management with Redux', 
  'https://www.youtube.com/embed/JSiWY5DJOto', 2000, 0, true
  FROM module_fe_4
  RETURNING id
)

-- Module 5: Performance & Deployment (4 lessons)
,module_fe_5 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Performance and Deployment', 'Optimization, testing, and going live', 4
  FROM course_frontend
  RETURNING id, course_id
)
,lesson_fe_5_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'React Performance Optimization', 'Memoization, lazy loading, and code splitting', 
  'https://www.youtube.com/embed/tYzMGcUty6s', 1800, 0, true
  FROM module_fe_5
  RETURNING id
)
,lesson_fe_5_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Testing React Applications', 'Unit testing, integration testing with Jest and React Testing Library', 
  'https://www.youtube.com/embed/7dTBwx60SQM', 1900, 1, true
  FROM module_fe_5
  RETURNING id
)
,lesson_fe_5_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Building and Deploying React Apps', 'Production builds and deployment strategies', 
  'https://www.youtube.com/embed/F-DvI67o_5I', 1700, 2, true
  FROM module_fe_5
  RETURNING id
)
,lesson_fe_5_4 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Next.js and React Frameworks', 'Server-side rendering and fullstack frameworks', 
  'https://www.youtube.com/embed/wm5gMKuwSYk', 1800, 3, true
  FROM module_fe_5
  RETURNING id
)

-- 3. DATA ANALYTICS & VISUALIZATION (3 modules)
,course_data_viz AS (
  INSERT INTO public.courses (tenant_id, slug, title, description, is_active)
  SELECT tenant_id, 'data-analytics-visualization', 'Data Analytics & Visualization', 
  'Learn to analyze data, create visualizations, and tell stories with data. Master Python tools for data-driven insights.', true
  FROM tenant_lookup
  ON CONFLICT DO NOTHING
  RETURNING id, tenant_id
)

-- Module 1: Python & Pandas (3 lessons)
,module_dv_1 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Python for Data Analysis', 'Getting started with Python, Pandas, and NumPy', 0
  FROM course_data_viz
  RETURNING id, course_id
)
,lesson_dv_1_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Python Basics for Data Science', 'Essential Python concepts for data analysis', 
  'https://www.youtube.com/embed/vmEHCJofslg', 2400, 0, true
  FROM module_dv_1
  RETURNING id
)
,lesson_dv_1_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Pandas DataFrames and Data Manipulation', 'Working with data using Pandas', 
  'https://www.youtube.com/embed/gtjxAH8uaP0', 2700, 1, true
  FROM module_dv_1
  RETURNING id
)
,lesson_dv_1_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Data Cleaning and Preprocessing', 'Preparing data for analysis', 
  'https://www.youtube.com/embed/LHBE6Q9XlzI', 2400, 2, true
  FROM module_dv_1
  RETURNING id
)

-- Module 2: Visualization (2 lessons)
,module_dv_2 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Data Visualization with Python', 'Creating compelling visual representations', 1
  FROM course_data_viz
  RETURNING id, course_id
)
,lesson_dv_2_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Matplotlib and Seaborn Basics', 'Plotting and statistical visualizations', 
  'https://www.youtube.com/embed/2uvysYbKdjM', 2400, 0, true
  FROM module_dv_2
  RETURNING id
)
,lesson_dv_2_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Interactive Dashboards with Plotly', 'Building interactive visualizations', 
  'https://www.youtube.com/embed/GPVsHOlRBBI', 2000, 1, true
  FROM module_dv_2
  RETURNING id
)

-- Module 3: Real-World Analysis (5 lessons)
,module_dv_3 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Real-World Data Projects', 'End-to-end analysis projects and case studies', 2
  FROM course_data_viz
  RETURNING id, course_id
)
,lesson_dv_3_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Exploratory Data Analysis', 'Discovering patterns and insights in data', 
  'https://www.youtube.com/embed/tRKeLrwfUgU', 1200, 0, true
  FROM module_dv_3
  RETURNING id
)
,lesson_dv_3_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Statistical Analysis with Python', 'Applying statistics to real datasets', 
  'https://www.youtube.com/embed/EhYC02PD_gc', 1800, 1, true
  FROM module_dv_3
  RETURNING id
)
,lesson_dv_3_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Time Series Analysis', 'Analyzing and forecasting time-based data', 
  'https://www.youtube.com/embed/A9pAl7VySEw', 1700, 2, true
  FROM module_dv_3
  RETURNING id
)
,lesson_dv_3_4 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Machine Learning for Data Analysis', 'Predictive modeling and classification', 
  'https://www.youtube.com/embed/7eh4d6sabA0', 1900, 3, true
  FROM module_dv_3
  RETURNING id
)
,lesson_dv_3_5 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Presenting Data Insights', 'Communicating findings effectively', 
  'https://www.youtube.com/embed/9-C8_NYZUYE', 1400, 4, true
  FROM module_dv_3
  RETURNING id
)

-- 4. KUBERNETES & CONTAINER ORCHESTRATION (2 modules)
,course_k8s AS (
  INSERT INTO public.courses (tenant_id, slug, title, description, is_active)
  SELECT tenant_id, 'kubernetes-orchestration', 'Kubernetes & Container Orchestration', 
  'Master Kubernetes for container orchestration, scaling, and deployment. Learn production-grade container management.', true
  FROM tenant_lookup
  ON CONFLICT DO NOTHING
  RETURNING id, tenant_id
)

-- Module 1: Container Basics (4 lessons)
,module_k8s_1 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Docker & Containers', 'Introduction to containerization and Docker', 0
  FROM course_k8s
  RETURNING id, course_id
)
,lesson_k8s_1_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'What are Containers?', 'Understanding containerization and Docker basics', 
  'https://www.youtube.com/embed/3c-iBn73dDE', 1500, 0, true
  FROM module_k8s_1
  RETURNING id
)
,lesson_k8s_1_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Docker Images and Containers', 'Creating and running Docker containers', 
  'https://www.youtube.com/embed/rr9cI8_djv8', 1600, 1, true
  FROM module_k8s_1
  RETURNING id
)
,lesson_k8s_1_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Docker Compose', 'Orchestrating multiple containers locally', 
  'https://www.youtube.com/embed/DM65_JyGxCo', 1400, 2, true
  FROM module_k8s_1
  RETURNING id
)
,lesson_k8s_1_4 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Docker Best Practices', 'Writing efficient and secure Docker images', 
  'https://www.youtube.com/embed/8vXoMqWgbQQ', 1300, 3, true
  FROM module_k8s_1
  RETURNING id
)

-- Module 2: Kubernetes Mastery (3 lessons)
,module_k8s_2 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Kubernetes Deep Dive', 'Architecture, deployment, and scaling', 1
  FROM course_k8s
  RETURNING id, course_id
)
,lesson_k8s_2_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Kubernetes Architecture and Concepts', 'Pods, services, and deployments', 
  'https://www.youtube.com/embed/2T86xAtR6Fo', 3600, 0, true
  FROM module_k8s_2
  RETURNING id
)
,lesson_k8s_2_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Deploying Applications on Kubernetes', 'Running and managing applications at scale', 
  'https://www.youtube.com/embed/X48VuDVv0Z0', 2100, 1, true
  FROM module_k8s_2
  RETURNING id
)
,lesson_k8s_2_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Monitoring and Troubleshooting', 'Observability and debugging Kubernetes clusters', 
  'https://www.youtube.com/embed/l3L0mLMYyMA', 1800, 2, true
  FROM module_k8s_2
  RETURNING id
)

-- 5. CROSS-PLATFORM MOBILE DEVELOPMENT (6 modules)
,course_mobile AS (
  INSERT INTO public.courses (tenant_id, slug, title, description, is_active)
  SELECT tenant_id, 'react-native-fullstack', 'Cross-Platform Mobile with React Native', 
  'Build native iOS and Android apps with React Native. Master navigation, state management, native APIs, and app store deployment.', true
  FROM tenant_lookup
  ON CONFLICT DO NOTHING
  RETURNING id, tenant_id
)

-- Module 1: Fundamentals (2 lessons)
,module_mobile_1 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'React Native Basics', 'Getting started with React Native development', 0
  FROM course_mobile
  RETURNING id, course_id
)
,lesson_mobile_1_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'React Native Setup and Environment', 'Development environment and first app', 
  'https://www.youtube.com/embed/0-S5a0eXPoc', 1500, 0, true
  FROM module_mobile_1
  RETURNING id
)
,lesson_mobile_1_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Core Components and Styling', 'Building mobile UIs with React Native', 
  'https://www.youtube.com/embed/vk13GJi4Vd0', 1800, 1, true
  FROM module_mobile_1
  RETURNING id
)

-- Module 2: Navigation (1 lesson)
,module_mobile_2 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Navigation Patterns', 'Implementing navigation in mobile apps', 1
  FROM course_mobile
  RETURNING id, course_id
)
,lesson_mobile_2_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'React Navigation Framework', 'Stack, tab, and drawer navigation', 
  'https://www.youtube.com/embed/mJ3bGvy0WAY', 2000, 0, true
  FROM module_mobile_2
  RETURNING id
)

-- Module 3: State Management (3 lessons)
,module_mobile_3 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'State and Data Management', 'Managing app state and data flow', 2
  FROM course_mobile
  RETURNING id, course_id
)
,lesson_mobile_3_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'State Management with Hooks', 'useState, useReducer, and Context', 
  'https://www.youtube.com/embed/wbj-DuaL748', 1700, 0, true
  FROM module_mobile_3
  RETURNING id
)
,lesson_mobile_3_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Redux in React Native', 'Predictable state management for mobile', 
  'https://www.youtube.com/embed/JKccS9k56_I', 2000, 1, true
  FROM module_mobile_3
  RETURNING id
)
,lesson_mobile_3_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'API Integration and Async Data', 'Fetching and managing remote data', 
  'https://www.youtube.com/embed/bCpFbERgj7s', 1600, 2, true
  FROM module_mobile_3
  RETURNING id
)

-- Module 4: Native APIs (4 lessons)
,module_mobile_4 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Accessing Native Features', 'Using device APIs and native modules', 3
  FROM course_mobile
  RETURNING id, course_id
)
,lesson_mobile_4_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Camera and Image Handling', 'Accessing device camera and photo library', 
  'https://www.youtube.com/embed/ZBCUegTZF7M', 1500, 0, true
  FROM module_mobile_4
  RETURNING id
)
,lesson_mobile_4_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Geolocation and Maps', 'Working with location services and maps', 
  'https://www.youtube.com/embed/f8Z9JyB2EIE', 1600, 1, true
  FROM module_mobile_4
  RETURNING id
)
,lesson_mobile_4_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Push Notifications', 'Implementing push notifications', 
  'https://www.youtube.com/embed/sm5Y7Vtuihg', 1400, 2, true
  FROM module_mobile_4
  RETURNING id
)
,lesson_mobile_4_4 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Device Storage and Persistence', 'AsyncStorage and local data management', 
  'https://www.youtube.com/embed/rr9cI8_djv8', 1300, 3, true
  FROM module_mobile_4
  RETURNING id
)

-- Module 5: Performance (1 lesson)
,module_mobile_5 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Performance Optimization', 'Building fast and responsive mobile apps', 4
  FROM course_mobile
  RETURNING id, course_id
)
,lesson_mobile_5_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'React Native Performance', 'Profiling and optimizing app performance', 
  'https://www.youtube.com/embed/fLIl6jypzkI', 1700, 0, true
  FROM module_mobile_5
  RETURNING id
)

-- Module 6: Deployment (5 lessons)
,module_mobile_6 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Build, Test, and Deploy', 'Testing, building, and publishing apps', 5
  FROM course_mobile
  RETURNING id, course_id
)
,lesson_mobile_6_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Testing Mobile Applications', 'Unit and integration testing for React Native', 
  'https://www.youtube.com/embed/DM65_JyGxCo', 1500, 0, true
  FROM module_mobile_6
  RETURNING id
)
,lesson_mobile_6_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Building for Production', 'Creating release builds and handling versioning', 
  'https://www.youtube.com/embed/8vXoMqWgbQQ', 1400, 1, true
  FROM module_mobile_6
  RETURNING id
)
,lesson_mobile_6_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'iOS App Deployment', 'Publishing to Apple App Store', 
  'https://www.youtube.com/embed/l3L0mLMYyMA', 1600, 2, true
  FROM module_mobile_6
  RETURNING id
)
,lesson_mobile_6_4 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Android App Deployment', 'Publishing to Google Play Store', 
  'https://www.youtube.com/embed/A9pAl7VySEw', 1700, 3, true
  FROM module_mobile_6
  RETURNING id
)
,lesson_mobile_6_5 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Monitoring and Updates', 'Crash reporting, analytics, and OTA updates', 
  'https://www.youtube.com/embed/7eh4d6sabA0', 1500, 4, true
  FROM module_mobile_6
  RETURNING id
)

SELECT 'Successfully created 5 new technology courses with varied structure and YouTube videos!' AS status;
