-- =============================================
-- Rename products -> courses
-- Add lesson blocks/assets/videos and showcases
-- =============================================

-- 1) Rename products table to courses
ALTER TABLE public.products RENAME TO courses;

-- 2) Rename FK columns to course_id
ALTER TABLE public.modules RENAME COLUMN product_id TO course_id;
ALTER TABLE public.enrollments RENAME COLUMN product_id TO course_id;

-- 3) Rename constraints (best effort)
ALTER TABLE public.modules RENAME CONSTRAINT modules_product_id_fkey TO modules_course_id_fkey;
ALTER TABLE public.enrollments RENAME CONSTRAINT enrollments_product_id_fkey TO enrollments_course_id_fkey;
ALTER TABLE public.enrollments RENAME CONSTRAINT enrollments_user_id_product_id_key TO enrollments_user_id_course_id_key;
ALTER TABLE public.courses RENAME CONSTRAINT products_tenant_id_slug_key TO courses_tenant_id_slug_key;
ALTER TABLE public.courses RENAME CONSTRAINT products_tenant_id_fkey TO courses_tenant_id_fkey;

-- 4) Rename indexes
ALTER INDEX idx_products_tenant_id RENAME TO idx_courses_tenant_id;
ALTER INDEX idx_products_slug RENAME TO idx_courses_slug;
ALTER INDEX idx_modules_product_id RENAME TO idx_modules_course_id;
ALTER INDEX idx_modules_sort_order RENAME TO idx_modules_course_id_sort_order;
ALTER INDEX idx_enrollments_product_id RENAME TO idx_enrollments_course_id;

-- 5) Rename updated_at trigger on courses
ALTER TRIGGER set_products_updated_at ON public.courses RENAME TO set_courses_updated_at;

-- =============================================
-- Helper functions (courses)
-- =============================================

CREATE OR REPLACE FUNCTION public.is_enrolled_in_course(_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE course_id = _course_id
      AND user_id = auth.uid()
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

CREATE OR REPLACE FUNCTION public.get_course_tenant(_course_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.courses WHERE id = _course_id
$$;

CREATE OR REPLACE FUNCTION public.get_module_course(_module_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT course_id FROM public.modules WHERE id = _module_id
$$;

CREATE OR REPLACE FUNCTION public.get_lesson_course(_lesson_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.course_id FROM public.lessons l
  JOIN public.modules m ON l.module_id = m.id
  WHERE l.id = _lesson_id
$$;

-- =============================================
-- RLS policies for courses/modules/lessons/enrollments/progress
-- =============================================

-- Courses
DROP POLICY IF EXISTS "Published products are public" ON public.courses;
DROP POLICY IF EXISTS "Editors can create products" ON public.courses;
DROP POLICY IF EXISTS "Editors can update products" ON public.courses;
DROP POLICY IF EXISTS "Owners can delete products" ON public.courses;

CREATE POLICY "Published courses are public"
  ON public.courses FOR SELECT
  USING (
    is_published = true
    OR public.is_tenant_editor(tenant_id)
    OR public.is_admin()
  );

CREATE POLICY "Editors can create courses"
  ON public.courses FOR INSERT
  WITH CHECK (public.is_tenant_editor(tenant_id));

CREATE POLICY "Editors can update courses"
  ON public.courses FOR UPDATE
  USING (public.is_tenant_editor(tenant_id) OR public.is_admin());

CREATE POLICY "Owners can delete courses"
  ON public.courses FOR DELETE
  USING (public.is_tenant_owner(tenant_id) OR public.is_admin());

-- Modules
DROP POLICY IF EXISTS "Enrolled users can view modules" ON public.modules;
DROP POLICY IF EXISTS "Editors can create modules" ON public.modules;
DROP POLICY IF EXISTS "Editors can update modules" ON public.modules;
DROP POLICY IF EXISTS "Owners can delete modules" ON public.modules;

CREATE POLICY "Enrolled users can view modules"
  ON public.modules FOR SELECT
  USING (
    public.is_enrolled_in_course(course_id)
    OR public.is_tenant_editor(public.get_course_tenant(course_id))
    OR public.is_admin()
  );

CREATE POLICY "Editors can create modules"
  ON public.modules FOR INSERT
  WITH CHECK (public.is_tenant_editor(public.get_course_tenant(course_id)));

CREATE POLICY "Editors can update modules"
  ON public.modules FOR UPDATE
  USING (public.is_tenant_editor(public.get_course_tenant(course_id)) OR public.is_admin());

CREATE POLICY "Owners can delete modules"
  ON public.modules FOR DELETE
  USING (public.is_tenant_owner(public.get_course_tenant(course_id)) OR public.is_admin());

-- Lessons
DROP POLICY IF EXISTS "Enrolled users can view lessons" ON public.lessons;
DROP POLICY IF EXISTS "Editors can create lessons" ON public.lessons;
DROP POLICY IF EXISTS "Editors can update lessons" ON public.lessons;
DROP POLICY IF EXISTS "Owners can delete lessons" ON public.lessons;

CREATE POLICY "Enrolled users can view lessons"
  ON public.lessons FOR SELECT
  USING (
    public.is_enrolled_in_course(public.get_module_course(module_id))
    OR public.is_tenant_editor(public.get_course_tenant(public.get_module_course(module_id)))
    OR public.is_admin()
  );

CREATE POLICY "Editors can create lessons"
  ON public.lessons FOR INSERT
  WITH CHECK (public.is_tenant_editor(public.get_course_tenant(public.get_module_course(module_id))));

CREATE POLICY "Editors can update lessons"
  ON public.lessons FOR UPDATE
  USING (
    public.is_tenant_editor(public.get_course_tenant(public.get_module_course(module_id)))
    OR public.is_admin()
  );

CREATE POLICY "Owners can delete lessons"
  ON public.lessons FOR DELETE
  USING (
    public.is_tenant_owner(public.get_course_tenant(public.get_module_course(module_id)))
    OR public.is_admin()
  );

-- Enrollments
DROP POLICY IF EXISTS "Users can view own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Editors can create enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Editors can update enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Editors can delete enrollments" ON public.enrollments;

CREATE POLICY "Users can view own enrollments"
  ON public.enrollments FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_tenant_editor(public.get_course_tenant(course_id))
    OR public.is_admin()
  );

CREATE POLICY "Editors can create enrollments"
  ON public.enrollments FOR INSERT
  WITH CHECK (
    public.is_tenant_editor(public.get_course_tenant(course_id))
    OR public.is_admin()
  );

CREATE POLICY "Editors can update enrollments"
  ON public.enrollments FOR UPDATE
  USING (
    public.is_tenant_editor(public.get_course_tenant(course_id))
    OR public.is_admin()
  );

CREATE POLICY "Editors can delete enrollments"
  ON public.enrollments FOR DELETE
  USING (
    public.is_tenant_editor(public.get_course_tenant(course_id))
    OR public.is_admin()
  );

-- Lesson progress
DROP POLICY IF EXISTS "Users can track own progress" ON public.lesson_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON public.lesson_progress;

-- Drop old function names (products) after dependent policies are removed
DROP FUNCTION IF EXISTS public.is_enrolled(UUID);
DROP FUNCTION IF EXISTS public.get_product_tenant(UUID);
DROP FUNCTION IF EXISTS public.get_module_product(UUID);
DROP FUNCTION IF EXISTS public.get_lesson_product(UUID);

CREATE POLICY "Users can track own progress"
  ON public.lesson_progress FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_enrolled_in_course(public.get_lesson_course(lesson_id))
  );

CREATE POLICY "Users can update own progress"
  ON public.lesson_progress FOR UPDATE
  USING (user_id = auth.uid());

-- =============================================
-- Default module per course
-- =============================================

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- Ensure only one default module per course
CREATE UNIQUE INDEX IF NOT EXISTS idx_modules_one_default
  ON public.modules(course_id)
  WHERE is_default = true;

CREATE OR REPLACE FUNCTION public.handle_new_course()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.modules (course_id, title, description, sort_order, is_default)
  VALUES (NEW.id, 'Modulo inicial', NULL, 0, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_course_created ON public.courses;
CREATE TRIGGER on_course_created
  AFTER INSERT ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_course();

-- =============================================
-- Lesson blocks (Notion-style)
-- =============================================

CREATE TABLE IF NOT EXISTS public.lesson_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_blocks_lesson_id ON public.lesson_blocks(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_blocks_sort_order ON public.lesson_blocks(lesson_id, sort_order);

CREATE TRIGGER set_lesson_blocks_updated_at BEFORE UPDATE ON public.lesson_blocks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.lesson_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View lesson blocks"
  ON public.lesson_blocks FOR SELECT
  USING (
    public.is_enrolled_in_course(public.get_lesson_course(lesson_id))
    OR public.is_tenant_editor(public.get_course_tenant(public.get_lesson_course(lesson_id)))
    OR public.is_admin()
  );

CREATE POLICY "Editors can manage lesson blocks"
  ON public.lesson_blocks FOR ALL
  USING (
    public.is_tenant_editor(public.get_course_tenant(public.get_lesson_course(lesson_id)))
    OR public.is_admin()
  );

-- =============================================
-- Lesson assets (Supabase Storage)
-- =============================================

CREATE TABLE IF NOT EXISTS public.lesson_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_assets_lesson_id ON public.lesson_assets(lesson_id);

CREATE TRIGGER set_lesson_assets_updated_at BEFORE UPDATE ON public.lesson_assets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.lesson_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View lesson assets"
  ON public.lesson_assets FOR SELECT
  USING (
    public.is_enrolled_in_course(public.get_lesson_course(lesson_id))
    OR public.is_tenant_editor(public.get_course_tenant(public.get_lesson_course(lesson_id)))
    OR public.is_admin()
  );

CREATE POLICY "Editors can manage lesson assets"
  ON public.lesson_assets FOR ALL
  USING (
    public.is_tenant_editor(public.get_course_tenant(public.get_lesson_course(lesson_id)))
    OR public.is_admin()
  );

-- =============================================
-- Lesson videos (Gumlet)
-- =============================================

CREATE TABLE IF NOT EXISTS public.lesson_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'gumlet',
  gumlet_asset_id TEXT NOT NULL,
  gumlet_collection_id TEXT,
  playback_url TEXT,
  thumbnail_url TEXT,
  status TEXT,
  duration_seconds INTEGER,
  is_public BOOLEAN NOT NULL DEFAULT true,
  provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lesson_videos_provider_check CHECK (provider IN ('gumlet'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lesson_videos_gumlet_asset_id ON public.lesson_videos(gumlet_asset_id);

CREATE TRIGGER set_lesson_videos_updated_at BEFORE UPDATE ON public.lesson_videos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.lesson_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View lesson videos"
  ON public.lesson_videos FOR SELECT
  USING (
    public.is_enrolled_in_course(public.get_lesson_course(lesson_id))
    OR public.is_tenant_editor(public.get_course_tenant(public.get_lesson_course(lesson_id)))
    OR public.is_admin()
  );

CREATE POLICY "Editors can manage lesson videos"
  ON public.lesson_videos FOR ALL
  USING (
    public.is_tenant_editor(public.get_course_tenant(public.get_lesson_course(lesson_id)))
    OR public.is_admin()
  );

-- =============================================
-- Showcases (vitrines)
-- =============================================

CREATE TABLE IF NOT EXISTS public.showcases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS public.showcase_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  showcase_id UUID REFERENCES public.showcases(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(showcase_id, course_id)
);

CREATE TABLE IF NOT EXISTS public.showcase_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  showcase_id UUID REFERENCES public.showcases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(showcase_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_showcases_tenant_id ON public.showcases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_showcases_sort_order ON public.showcases(tenant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_showcase_courses_showcase_id ON public.showcase_courses(showcase_id);
CREATE INDEX IF NOT EXISTS idx_showcase_courses_course_id ON public.showcase_courses(course_id);
CREATE INDEX IF NOT EXISTS idx_showcase_members_showcase_id ON public.showcase_members(showcase_id);

CREATE TRIGGER set_showcases_updated_at BEFORE UPDATE ON public.showcases
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.showcases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showcase_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showcase_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_showcase(_showcase_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.showcases s
    WHERE s.id = _showcase_id
      AND (
        public.is_tenant_editor(s.tenant_id)
        OR public.is_admin()
        OR (
          public.is_tenant_member(s.tenant_id)
          AND (
            s.is_public = true
            OR EXISTS (
              SELECT 1 FROM public.showcase_members sm
              WHERE sm.showcase_id = s.id
                AND sm.user_id = auth.uid()
            )
          )
        )
      )
  )
$$;

CREATE POLICY "Members can view showcases"
  ON public.showcases FOR SELECT
  USING (public.can_view_showcase(id));

CREATE POLICY "Editors can manage showcases"
  ON public.showcases FOR ALL
  USING (public.is_tenant_editor(tenant_id) OR public.is_admin());

CREATE POLICY "View showcase courses"
  ON public.showcase_courses FOR SELECT
  USING (public.can_view_showcase(showcase_id));

CREATE POLICY "Editors can manage showcase courses"
  ON public.showcase_courses FOR ALL
  USING (public.is_tenant_editor(public.get_course_tenant(course_id)) OR public.is_admin());

CREATE POLICY "Editors can manage showcase members"
  ON public.showcase_members FOR ALL
  USING (public.is_tenant_editor((SELECT tenant_id FROM public.showcases s WHERE s.id = showcase_id)) OR public.is_admin());
