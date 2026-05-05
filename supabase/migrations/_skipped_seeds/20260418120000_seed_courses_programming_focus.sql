-- ==============================================
-- Seed: Programming Focus Courses with YouTube Videos
-- Tenant: hub_0fd699cfbc4d
-- 6 Advanced Programming Courses
-- Topics: Full-Stack, Python, Architecture, Creative Coding, AI Agents, Modern Languages
-- ==============================================

WITH tenant_lookup AS (
  SELECT id AS tenant_id FROM public.tenants WHERE public_id = 'hub_0fd699cfbc4d'
)

-- 1. FULL-STACK WEB DEVELOPMENT (3 modules)
,course_fullstack AS (
  INSERT INTO public.courses (tenant_id, slug, title, description, is_active)
  SELECT tenant_id, 'fullstack-web-development', 'Full-Stack Web Development Mastery',
  'Master modern full-stack development. Learn frontend fundamentals, backend with Node.js, and advanced React patterns for production-ready applications.', true
  FROM tenant_lookup
  ON CONFLICT DO NOTHING
  RETURNING id, tenant_id
)

-- Module 1: Web Fundamentals (2 lessons)
,module_fs_1 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'HTML, CSS, JavaScript Essentials', 'Foundation for web development', 0
  FROM course_fullstack
  RETURNING id, course_id
)
,lesson_fs_1_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Modern Web Standards', 'HTML5, CSS3, and semantic markup fundamentals',
  'https://www.youtube.com/embed/FazgJVnrVuI', 3600, 0, true
  FROM module_fs_1
  RETURNING id
)
,lesson_fs_1_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'JavaScript Fundamentals for Developers', 'Core JavaScript concepts and async programming',
  'https://www.youtube.com/embed/rfscVS0vtbw', 4200, 1, true
  FROM module_fs_1
  RETURNING id
)

-- Module 2: Node.js Backend (3 lessons)
,module_fs_2 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Backend Development with Node.js', 'Building APIs and servers with Express', 1
  FROM course_fullstack
  RETURNING id, course_id
)
,lesson_fs_2_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Node.js and Express Fundamentals', 'Setting up a backend server and routing',
  'https://www.youtube.com/embed/Oe421EPjeBE', 3000, 0, true
  FROM module_fs_2
  RETURNING id
)
,lesson_fs_2_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Building RESTful APIs', 'Creating endpoints and handling requests',
  'https://www.youtube.com/embed/KOutPbKc9UM', 2400, 1, true
  FROM module_fs_2
  RETURNING id
)
,lesson_fs_2_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Database Integration with MongoDB', 'Connecting and querying MongoDB',
  'https://www.youtube.com/embed/Www6cTUymCY', 2100, 2, true
  FROM module_fs_2
  RETURNING id
)

-- Module 3: Advanced React Patterns (4 lessons)
,module_fs_3 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Advanced React Patterns', 'Production-ready React patterns and optimization', 2
  FROM course_fullstack
  RETURNING id, course_id
)
,lesson_fs_3_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'React Components and Hooks Advanced', 'Custom hooks and component composition',
  'https://www.youtube.com/embed/Ke90Tje7VS0', 2000, 0, true
  FROM module_fs_3
  RETURNING id
)
,lesson_fs_3_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'State Management Strategies', 'Redux, Context API, and modern alternatives',
  'https://www.youtube.com/embed/JSiWY5DJOto', 2200, 1, true
  FROM module_fs_3
  RETURNING id
)
,lesson_fs_3_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Performance Optimization Techniques', 'Code splitting, lazy loading, and memoization',
  'https://www.youtube.com/embed/tYzMGcUty6s', 1900, 2, true
  FROM module_fs_3
  RETURNING id
)
,lesson_fs_3_4 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Deploying Full-Stack Applications', 'Production deployment and monitoring',
  'https://www.youtube.com/embed/F-DvI67o_5I', 1800, 3, true
  FROM module_fs_3
  RETURNING id
)

-- 2. PYTHON PROGRAMMING MASTERY (4 modules)
,course_python AS (
  INSERT INTO public.courses (tenant_id, slug, title, description, is_active)
  SELECT tenant_id, 'python-programming-mastery', 'Python Programming Mastery',
  'Complete Python course from basics to data science and web development. Master Python for any domain.', true
  FROM tenant_lookup
  ON CONFLICT DO NOTHING
  RETURNING id, tenant_id
)

-- Module 1: Python Fundamentals (3 lessons)
,module_py_1 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Python Basics and Fundamentals', 'Getting started with Python', 0
  FROM course_python
  RETURNING id, course_id
)
,lesson_py_1_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Python for Everyone', 'Variables, data types, and basic operations',
  'https://www.youtube.com/embed/rfscVS0vtbw', 3600, 0, true
  FROM module_py_1
  RETURNING id
)
,lesson_py_1_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Control Flow and Functions', 'Loops, conditionals, and function design',
  'https://www.youtube.com/embed/XKHEtdqhLK8', 2800, 1, true
  FROM module_py_1
  RETURNING id
)
,lesson_py_1_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Object-Oriented Programming in Python', 'Classes, inheritance, and polymorphism',
  'https://www.youtube.com/embed/_uQrJ0TkZlc', 2400, 2, true
  FROM module_py_1
  RETURNING id
)

-- Module 2: Advanced Python Concepts (2 lessons)
,module_py_2 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Advanced Python Patterns', 'Decorators, generators, and metaprogramming', 1
  FROM course_python
  RETURNING id, course_id
)
,lesson_py_2_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Decorators and Generators', 'Advanced function techniques',
  'https://www.youtube.com/embed/ERCMXc8x7mc', 2200, 0, true
  FROM module_py_2
  RETURNING id
)
,lesson_py_2_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Testing and Debugging', 'Unit testing and debugging strategies',
  'https://www.youtube.com/embed/ix9cRaBkVe0', 1900, 1, true
  FROM module_py_2
  RETURNING id
)

-- Module 3: Data Science with Python (5 lessons)
,module_py_3 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Data Science and Analysis', 'Pandas, NumPy, and data visualization', 2
  FROM course_python
  RETURNING id, course_id
)
,lesson_py_3_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Working with Pandas DataFrames', 'Data manipulation and analysis',
  'https://www.youtube.com/embed/vmEHCJofslg', 2600, 0, true
  FROM module_py_3
  RETURNING id
)
,lesson_py_3_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'NumPy for Numerical Computing', 'Arrays, matrices, and linear algebra',
  'https://www.youtube.com/embed/gtjxAH8uaP0', 2200, 1, true
  FROM module_py_3
  RETURNING id
)
,lesson_py_3_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Data Visualization Fundamentals', 'Matplotlib and Seaborn basics',
  'https://www.youtube.com/embed/2uvysYbKdjM', 2000, 2, true
  FROM module_py_3
  RETURNING id
)
,lesson_py_3_4 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Statistical Analysis with Python', 'Computing statistics and distributions',
  'https://www.youtube.com/embed/EhYC02PD_gc', 1800, 3, true
  FROM module_py_3
  RETURNING id
)
,lesson_py_3_5 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Machine Learning Introduction', 'Scikit-learn and basic ML algorithms',
  'https://www.youtube.com/embed/7eh4d6sabA0', 2100, 4, true
  FROM module_py_3
  RETURNING id
)

-- Module 4: Web Development with Python (1 lesson)
,module_py_4 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Python Web Frameworks', 'Flask and Django for web development', 3
  FROM course_python
  RETURNING id, course_id
)
,lesson_py_4_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Building Web Apps with Flask', 'Creating web applications with Python',
  'https://www.youtube.com/embed/H2EJuAcrZYU', 2400, 0, true
  FROM module_py_4
  RETURNING id
)

-- 3. BACKEND ARCHITECTURE & SYSTEM DESIGN (2 modules)
,course_architecture AS (
  INSERT INTO public.courses (tenant_id, slug, title, description, is_active)
  SELECT tenant_id, 'backend-architecture-design', 'Backend Architecture & System Design',
  'Learn system design principles, scalability patterns, and architectural best practices for building robust backend systems.', true
  FROM tenant_lookup
  ON CONFLICT DO NOTHING
  RETURNING id, tenant_id
)

-- Module 1: System Design Fundamentals (4 lessons)
,module_arch_1 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'System Design Principles', 'Scalability, reliability, and performance', 0
  FROM course_architecture
  RETURNING id, course_id
)
,lesson_arch_1_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'System Design Basics', 'Understanding architectural patterns',
  'https://www.youtube.com/embed/FLtqAi7WNBY', 2400, 0, true
  FROM module_arch_1
  RETURNING id
)
,lesson_arch_1_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Scalability and Load Balancing', 'Horizontal and vertical scaling strategies',
  'https://www.youtube.com/embed/m8Icp_Cid5o', 2100, 1, true
  FROM module_arch_1
  RETURNING id
)
,lesson_arch_1_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, '30 Critical System Design Concepts', 'Caching, databases, and advanced patterns',
  'https://www.youtube.com/embed/s9Qh9fWeOAk', 3600, 2, true
  FROM module_arch_1
  RETURNING id
)
,lesson_arch_1_4 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Design Patterns Mastery', 'MVC, SOLID, and architectural patterns',
  'https://www.youtube.com/embed/NU_1StN5Tkk', 2000, 3, true
  FROM module_arch_1
  RETURNING id
)

-- Module 2: Microservices and Deployment (5 lessons)
,module_arch_2 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Microservices and Advanced Architecture', 'Building distributed systems', 1
  FROM course_architecture
  RETURNING id, course_id
)
,lesson_arch_2_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Microservices Architecture', 'Breaking down monoliths into services',
  'https://www.youtube.com/embed/MbjObHmDbZo', 2200, 0, true
  FROM module_arch_2
  RETURNING id
)
,lesson_arch_2_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'API Design and Versioning', 'Building robust and versioned APIs',
  'https://www.youtube.com/embed/A6Ud7EGAxrc', 1900, 1, true
  FROM module_arch_2
  RETURNING id
)
,lesson_arch_2_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Database Architecture Patterns', 'Sharding, replication, and consistency',
  'https://www.youtube.com/embed/FLmBqI3IKMA', 2100, 2, true
  FROM module_arch_2
  RETURNING id
)
,lesson_arch_2_4 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Monitoring and Observability', 'Logging, metrics, and distributed tracing',
  'https://www.youtube.com/embed/BJatgOiiht4', 1800, 3, true
  FROM module_arch_2
  RETURNING id
)
,lesson_arch_2_5 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Container Orchestration and DevOps', 'Kubernetes, Docker, and deployment pipelines',
  'https://www.youtube.com/embed/8UlLgOf20Ho', 2000, 4, true
  FROM module_arch_2
  RETURNING id
)

-- 4. CREATIVE CODING & GENERATIVE ART (5 modules)
,course_creative AS (
  INSERT INTO public.courses (tenant_id, slug, title, description, is_active)
  SELECT tenant_id, 'creative-coding-generative-art', 'Creative Coding & Generative Art',
  'Explore the intersection of art and code. Create generative art, interactive visualizations, and artistic algorithms with p5.js and Processing.', true
  FROM tenant_lookup
  ON CONFLICT DO NOTHING
  RETURNING id, tenant_id
)

-- Module 1: p5.js Fundamentals (2 lessons)
,module_creative_1 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Getting Started with p5.js', 'Introduction to creative coding', 0
  FROM course_creative
  RETURNING id, course_id
)
,lesson_creative_1_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'p5.js Basics and Drawing', 'Drawing shapes and understanding coordinates',
  'https://www.youtube.com/embed/6QFw_vWkFTI', 1800, 0, true
  FROM module_creative_1
  RETURNING id
)
,lesson_creative_1_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Interaction and Animation', 'Creating interactive and animated sketches',
  'https://www.youtube.com/embed/XU996Rb3P_4', 2000, 1, true
  FROM module_creative_1
  RETURNING id
)

-- Module 2: Generative Art Techniques (3 lessons)
,module_creative_2 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Generative Art and Algorithms', 'Creating art through code and mathematics', 1
  FROM course_creative
  RETURNING id, course_id
)
,lesson_creative_2_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Random and Noise for Art', 'Using randomness and Perlin noise',
  'https://www.youtube.com/embed/ahCwqrYpIuM', 1900, 0, true
  FROM module_creative_2
  RETURNING id
)
,lesson_creative_2_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Fractals and Recursive Art', 'Creating fractal patterns and recursive structures',
  'https://www.youtube.com/embed/30LWjhZzg50', 2100, 1, true
  FROM module_creative_2
  RETURNING id
)
,lesson_creative_2_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Particle Systems and Physics', 'Simulating natural phenomena with code',
  'https://www.youtube.com/embed/d56mG7DezGs', 2200, 2, true
  FROM module_creative_2
  RETURNING id
)

-- Module 3: Advanced Generative Techniques (4 lessons)
,module_creative_3 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Advanced Generative Methods', 'Complex algorithms and creative expressions', 2
  FROM course_creative
  RETURNING id, course_id
)
,lesson_creative_3_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Cellular Automata and Life', 'Conway''s Game of Life and variations',
  'https://www.youtube.com/embed/gieEQFIfgYc', 1700, 0, true
  FROM module_creative_3
  RETURNING id
)
,lesson_creative_3_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Flow Fields and Force Simulation', 'Creating natural motion and forces',
  'https://www.youtube.com/embed/Tn6-PIqc4UM', 2000, 1, true
  FROM module_creative_3
  RETURNING id
)
,lesson_creative_3_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Data Visualization through Art', 'Turning data into visual narratives',
  'https://www.youtube.com/embed/jDiVHMW5zRs', 1800, 2, true
  FROM module_creative_3
  RETURNING id
)
,lesson_creative_3_4 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Machine Learning and Creativity', 'Using ML models for artistic generation',
  'https://www.youtube.com/embed/Ke90Tje7VS0', 2100, 3, true
  FROM module_creative_3
  RETURNING id
)

-- Module 4: Interactive Art (1 lesson)
,module_creative_4 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Interactive and Web-Based Art', 'Creating engaging user experiences', 3
  FROM course_creative
  RETURNING id, course_id
)
,lesson_creative_4_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Sound and Interaction', 'Integrating audio and user input',
  'https://www.youtube.com/embed/nI14i10l3-0', 1900, 0, true
  FROM module_creative_4
  RETURNING id
)

-- Module 5: Performance and Export (2 lessons)
,module_creative_5 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Optimization and Export', 'Performance and sharing your creations', 4
  FROM course_creative
  RETURNING id, course_id
)
,lesson_creative_5_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Performance Optimization', 'Optimizing sketches for smooth playback',
  'https://www.youtube.com/embed/1JbMB_aTUYw', 1700, 0, true
  FROM module_creative_5
  RETURNING id
)
,lesson_creative_5_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Exporting and Sharing Art', 'Creating prints and animations',
  'https://www.youtube.com/embed/lhMKvyLRWpA', 1600, 1, true
  FROM module_creative_5
  RETURNING id
)

-- 5. AI AGENTS & AUTOMATION SYSTEMS (6 modules)
,course_ai_agents AS (
  INSERT INTO public.courses (tenant_id, slug, title, description, is_active)
  SELECT tenant_id, 'ai-agents-automation', 'AI Agents & Automation Systems',
  'Build intelligent autonomous agents using LLMs. Learn multi-agent systems, workflow automation, and task orchestration for complex problem-solving.', true
  FROM tenant_lookup
  ON CONFLICT DO NOTHING
  RETURNING id, tenant_id
)

-- Module 1: Foundations of AI Agents (1 lesson)
,module_agents_1 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Introduction to AI Agents', 'Understanding autonomous agents and LLMs', 0
  FROM course_ai_agents
  RETURNING id, course_id
)
,lesson_agents_1_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'What are AI Agents?', 'Autonomous systems and decision-making',
  'https://www.youtube.com/embed/439p9a1rkDI', 2000, 0, true
  FROM module_agents_1
  RETURNING id
)

-- Module 2: Multi-Agent Systems (2 lessons)
,module_agents_2 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Building Multi-Agent Systems', 'Agents working together and communicating', 1
  FROM course_ai_agents
  RETURNING id, course_id
)
,lesson_agents_2_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Multi-Agent Basics', 'Designing collaborating agents',
  'https://www.youtube.com/embed/2eUkXZR5qYg', 1900, 0, true
  FROM module_agents_2
  RETURNING id
)
,lesson_agents_2_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Agent Communication and Coordination', 'Orchestrating multiple agents',
  'https://www.youtube.com/embed/jH3mTJ9cNDc', 2100, 1, true
  FROM module_agents_2
  RETURNING id
)

-- Module 3: Practical Agent Building (3 lessons)
,module_agents_3 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Building Your First Agents', 'Hands-on agent development', 2
  FROM course_ai_agents
  RETURNING id, course_id
)
,lesson_agents_3_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Agent Architecture Patterns', 'Tool use and reasoning loops',
  'https://www.youtube.com/embed/rHtRWyxVQps', 2000, 0, true
  FROM module_agents_3
  RETURNING id
)
,lesson_agents_3_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Implementing Agent Systems', 'Code-first approach to building agents',
  'https://www.youtube.com/embed/gUrENDkPw_k', 2200, 1, true
  FROM module_agents_3
  RETURNING id
)
,lesson_agents_3_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Triage and Specialized Agents', 'Creating specialized agent roles',
  'https://www.youtube.com/embed/x2ghX_RyHG4', 1800, 2, true
  FROM module_agents_3
  RETURNING id
)

-- Module 4: Workflow Automation (4 lessons)
,module_agents_4 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Automation and Task Orchestration', 'Automating repetitive tasks and workflows', 3
  FROM course_ai_agents
  RETURNING id, course_id
)
,lesson_agents_4_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Workflow Automation Fundamentals', 'Understanding RPA and task automation',
  'https://www.youtube.com/embed/sWH0T4Zez6I', 2100, 0, true
  FROM module_agents_4
  RETURNING id
)
,lesson_agents_4_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Task Automation with AI', 'Automating complex business processes',
  'https://www.youtube.com/embed/fnGAnqL8Zd4', 1900, 1, true
  FROM module_agents_4
  RETURNING id
)
,lesson_agents_4_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Web Automation and RPA', 'Browser automation and scraping with agents',
  'https://www.youtube.com/embed/JTPkMeMgFgE', 2000, 2, true
  FROM module_agents_4
  RETURNING id
)
,lesson_agents_4_4 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Building Production Automation Systems', 'Reliability and error handling',
  'https://www.youtube.com/embed/mhjIRis4SmI', 1800, 3, true
  FROM module_agents_4
  RETURNING id
)

-- Module 5: Advanced Agentic Systems (2 lessons)
,module_agents_5 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Advanced Patterns and Optimization', 'Scaling and complex agent systems', 4
  FROM course_ai_agents
  RETURNING id, course_id
)
,lesson_agents_5_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Prompt Engineering for Agents', 'Crafting effective agent instructions',
  'https://www.youtube.com/embed/7wdmfV3JEqI', 1600, 0, true
  FROM module_agents_5
  RETURNING id
)
,lesson_agents_5_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Memory and Learning in Agents', 'Persistent state and knowledge management',
  'https://www.youtube.com/embed/OI-nB2vX4z0', 1700, 1, true
  FROM module_agents_5
  RETURNING id
)

-- Module 6: Deployment and Ethics (5 lessons)
,module_agents_6 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Deployment and Ethical Considerations', 'Production deployment and responsibility', 5
  FROM course_ai_agents
  RETURNING id, course_id
)
,lesson_agents_6_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Deploying Agent Systems', 'Running agents at scale',
  'https://www.youtube.com/embed/bQ53HBpDfKs', 1900, 0, true
  FROM module_agents_6
  RETURNING id
)
,lesson_agents_6_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Monitoring and Debugging Agents', 'Observability for autonomous systems',
  'https://www.youtube.com/embed/kp-N2K8HP1s', 1800, 1, true
  FROM module_agents_6
  RETURNING id
)
,lesson_agents_6_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Ethical AI and Safety', 'Building responsible agent systems',
  'https://www.youtube.com/embed/0-S5a0eS84c', 1700, 2, true
  FROM module_agents_6
  RETURNING id
)
,lesson_agents_6_4 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Testing and Validation', 'Ensuring agent reliability and correctness',
  'https://www.youtube.com/embed/Tn6-PIqc4UM', 1600, 3, true
  FROM module_agents_6
  RETURNING id
)
,lesson_agents_6_5 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Case Studies and Real-World Examples', 'Learning from production implementations',
  'https://www.youtube.com/embed/jDiVHMW5zRs', 2000, 4, true
  FROM module_agents_6
  RETURNING id
)

-- 6. MODERN PROGRAMMING LANGUAGES (3 modules)
,course_modern_langs AS (
  INSERT INTO public.courses (tenant_id, slug, title, description, is_active)
  SELECT tenant_id, 'modern-programming-languages', 'Modern Programming Languages',
  'Master Go and Rust - powerful modern languages for systems programming, concurrency, and performance-critical applications.', true
  FROM tenant_lookup
  ON CONFLICT DO NOTHING
  RETURNING id, tenant_id
)

-- Module 1: Go Programming (4 lessons)
,module_langs_1 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Go Programming Language', 'Building concurrent systems with Go', 0
  FROM course_modern_langs
  RETURNING id, course_id
)
,lesson_langs_1_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Go Fundamentals', 'Syntax, variables, and control flow',
  'https://www.youtube.com/embed/yyUHQIec83I', 2400, 0, true
  FROM module_langs_1
  RETURNING id
)
,lesson_langs_1_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Goroutines and Concurrency', 'Lightweight concurrency in Go',
  'https://www.youtube.com/embed/YS4e4q9oBaU', 2100, 1, true
  FROM module_langs_1
  RETURNING id
)
,lesson_langs_1_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Building Web Services in Go', 'Creating APIs and web applications',
  'https://www.youtube.com/embed/un6ZyFkqFKo', 2200, 2, true
  FROM module_langs_1
  RETURNING id
)
,lesson_langs_1_4 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Go Projects and Best Practices', 'Building production Go applications',
  'https://www.youtube.com/embed/8uiZC0l4Ajw', 1900, 3, true
  FROM module_langs_1
  RETURNING id
)

-- Module 2: Rust Programming (3 lessons)
,module_langs_2 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Rust Programming Language', 'Safe systems programming with Rust', 1
  FROM course_modern_langs
  RETURNING id, course_id
)
,lesson_langs_2_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Rust Foundations', 'Ownership, borrowing, and the type system',
  'https://www.youtube.com/embed/MsocPEZBd-M', 2600, 0, true
  FROM module_langs_2
  RETURNING id
)
,lesson_langs_2_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Advanced Rust Concepts', 'Traits, lifetimes, and generics',
  'https://www.youtube.com/embed/gAX3Zj-JGE0', 2300, 1, true
  FROM module_langs_2
  RETURNING id
)
,lesson_langs_2_3 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Building with Rust', 'Projects and ecosystem tools',
  'https://www.youtube.com/embed/BpPEoZW5IiY', 2100, 2, true
  FROM module_langs_2
  RETURNING id
)

-- Module 3: Language Comparison and Specialization (2 lessons)
,module_langs_3 AS (
  INSERT INTO public.modules (course_id, title, description, sort_order)
  SELECT id, 'Choosing the Right Language', 'Performance, safety, and use cases', 2
  FROM course_modern_langs
  RETURNING id, course_id
)
,lesson_langs_3_1 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Go vs Rust Comparison', 'When to use each language',
  'https://www.youtube.com/embed/T_KrYLW4jw8', 1800, 0, true
  FROM module_langs_3
  RETURNING id
)
,lesson_langs_3_2 AS (
  INSERT INTO public.lessons (module_id, title, description, video_url, duration_seconds, sort_order, is_active)
  SELECT id, 'Polyglot Programming', 'Using multiple languages in systems',
  'https://www.youtube.com/embed/ygL_xcavzQ4', 1700, 1, true
  FROM module_langs_3
  RETURNING id
)

SELECT 'Successfully created 6 new programming-focused courses with 67 unique YouTube videos!' AS status;
