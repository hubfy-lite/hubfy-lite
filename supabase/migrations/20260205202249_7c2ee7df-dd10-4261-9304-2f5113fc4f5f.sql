-- =============================================
-- HUBFY - MVP V1 DATABASE SCHEMA
-- =============================================

-- 1. CREATE ENUM FOR ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'seller', 'customer');
CREATE TYPE public.tenant_role AS ENUM ('owner', 'editor', 'member');

-- 2. PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. USER ROLES TABLE (separada de profiles por segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- 4. TENANTS TABLE (cada infoprodutor tem um tenant)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. TENANT MEMBERS TABLE (quem pertence a cada tenant)
CREATE TABLE public.tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role tenant_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- 6. PRODUCTS TABLE (cursos/produtos digitais)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- 7. MODULES TABLE (módulos do produto)
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. LESSONS TABLE (aulas do módulo)
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  video_url TEXT,
  duration_seconds INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. ENROLLMENTS TABLE (matrículas de alunos em produtos)
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- 10. LESSON PROGRESS TABLE (progresso do aluno)
CREATE TABLE public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  progress_seconds INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- =============================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- =============================================

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

-- Check if user has a specific app role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check if user is tenant owner
CREATE OR REPLACE FUNCTION public.is_tenant_owner(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = _tenant_id 
      AND user_id = auth.uid() 
      AND role = 'owner'
  )
$$;

-- Check if user is tenant editor (owner OR editor)
CREATE OR REPLACE FUNCTION public.is_tenant_editor(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = _tenant_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'editor')
  )
$$;

-- Check if user is tenant member (any role)
CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = _tenant_id AND user_id = auth.uid()
  )
$$;

-- Check if user is enrolled in product
CREATE OR REPLACE FUNCTION public.is_enrolled(_product_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE product_id = _product_id 
      AND user_id = auth.uid()
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Get tenant_id from product_id
CREATE OR REPLACE FUNCTION public.get_product_tenant(_product_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.products WHERE id = _product_id
$$;

-- Get product_id from module_id
CREATE OR REPLACE FUNCTION public.get_module_product(_module_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT product_id FROM public.modules WHERE id = _module_id
$$;

-- Get product_id from lesson_id
CREATE OR REPLACE FUNCTION public.get_lesson_product(_lesson_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.product_id FROM public.lessons l
  JOIN public.modules m ON l.module_id = m.id
  WHERE l.id = _lesson_id
$$;

-- =============================================
-- TRIGGERS FOR updated_at
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_modules_updated_at BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_lessons_updated_at BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_lesson_progress_updated_at BEFORE UPDATE ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- TRIGGER: Auto-create profile on signup
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  
  -- Default role is customer
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- TRIGGER: Auto-add owner as tenant_member
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_tenant()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_tenant_created
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_tenant();

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES: PROFILES
-- =============================================

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System creates profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- =============================================
-- RLS POLICIES: USER_ROLES
-- =============================================

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Only admins manage roles"
  ON public.user_roles FOR ALL
  USING (public.is_admin());

-- =============================================
-- RLS POLICIES: TENANTS
-- =============================================

CREATE POLICY "Anyone can view tenants by slug"
  ON public.tenants FOR SELECT
  USING (true);

CREATE POLICY "Sellers can create tenants"
  ON public.tenants FOR INSERT
  WITH CHECK (
    owner_id = auth.uid() 
    AND public.has_role(auth.uid(), 'seller')
  );

CREATE POLICY "Owners can update tenant"
  ON public.tenants FOR UPDATE
  USING (public.is_tenant_owner(id) OR public.is_admin());

CREATE POLICY "Only admins delete tenants"
  ON public.tenants FOR DELETE
  USING (public.is_admin());

-- =============================================
-- RLS POLICIES: TENANT_MEMBERS
-- =============================================

CREATE POLICY "Members can view tenant members"
  ON public.tenant_members FOR SELECT
  USING (public.is_tenant_member(tenant_id) OR public.is_admin());

CREATE POLICY "Owners can add members"
  ON public.tenant_members FOR INSERT
  WITH CHECK (
    public.is_tenant_owner(tenant_id) 
    AND role != 'owner'
    AND user_id != auth.uid()
  );

CREATE POLICY "Owners can update members"
  ON public.tenant_members FOR UPDATE
  USING (public.is_tenant_owner(tenant_id) AND role != 'owner');

CREATE POLICY "Owners can remove members"
  ON public.tenant_members FOR DELETE
  USING (public.is_tenant_owner(tenant_id) AND role != 'owner');

-- =============================================
-- RLS POLICIES: PRODUCTS
-- =============================================

CREATE POLICY "Published products are public"
  ON public.products FOR SELECT
  USING (
    is_published = true 
    OR public.is_tenant_editor(tenant_id) 
    OR public.is_admin()
  );

CREATE POLICY "Editors can create products"
  ON public.products FOR INSERT
  WITH CHECK (public.is_tenant_editor(tenant_id));

CREATE POLICY "Editors can update products"
  ON public.products FOR UPDATE
  USING (public.is_tenant_editor(tenant_id) OR public.is_admin());

CREATE POLICY "Owners can delete products"
  ON public.products FOR DELETE
  USING (public.is_tenant_owner(tenant_id) OR public.is_admin());

-- =============================================
-- RLS POLICIES: MODULES
-- =============================================

CREATE POLICY "Enrolled users can view modules"
  ON public.modules FOR SELECT
  USING (
    public.is_enrolled(product_id) 
    OR public.is_tenant_editor(public.get_product_tenant(product_id))
    OR public.is_admin()
  );

CREATE POLICY "Editors can create modules"
  ON public.modules FOR INSERT
  WITH CHECK (public.is_tenant_editor(public.get_product_tenant(product_id)));

CREATE POLICY "Editors can update modules"
  ON public.modules FOR UPDATE
  USING (public.is_tenant_editor(public.get_product_tenant(product_id)) OR public.is_admin());

CREATE POLICY "Owners can delete modules"
  ON public.modules FOR DELETE
  USING (public.is_tenant_owner(public.get_product_tenant(product_id)) OR public.is_admin());

-- =============================================
-- RLS POLICIES: LESSONS
-- =============================================

CREATE POLICY "Enrolled users can view lessons"
  ON public.lessons FOR SELECT
  USING (
    public.is_enrolled(public.get_module_product(module_id))
    OR public.is_tenant_editor(public.get_product_tenant(public.get_module_product(module_id)))
    OR public.is_admin()
  );

CREATE POLICY "Editors can create lessons"
  ON public.lessons FOR INSERT
  WITH CHECK (public.is_tenant_editor(public.get_product_tenant(public.get_module_product(module_id))));

CREATE POLICY "Editors can update lessons"
  ON public.lessons FOR UPDATE
  USING (
    public.is_tenant_editor(public.get_product_tenant(public.get_module_product(module_id)))
    OR public.is_admin()
  );

CREATE POLICY "Owners can delete lessons"
  ON public.lessons FOR DELETE
  USING (
    public.is_tenant_owner(public.get_product_tenant(public.get_module_product(module_id)))
    OR public.is_admin()
  );

-- =============================================
-- RLS POLICIES: ENROLLMENTS
-- =============================================

CREATE POLICY "Users can view own enrollments"
  ON public.enrollments FOR SELECT
  USING (
    user_id = auth.uid() 
    OR public.is_tenant_editor(public.get_product_tenant(product_id))
    OR public.is_admin()
  );

CREATE POLICY "Editors can create enrollments"
  ON public.enrollments FOR INSERT
  WITH CHECK (
    public.is_tenant_editor(public.get_product_tenant(product_id))
    OR public.is_admin()
  );

CREATE POLICY "Editors can update enrollments"
  ON public.enrollments FOR UPDATE
  USING (
    public.is_tenant_editor(public.get_product_tenant(product_id))
    OR public.is_admin()
  );

CREATE POLICY "Editors can delete enrollments"
  ON public.enrollments FOR DELETE
  USING (
    public.is_tenant_editor(public.get_product_tenant(product_id))
    OR public.is_admin()
  );

-- =============================================
-- RLS POLICIES: LESSON_PROGRESS
-- =============================================

CREATE POLICY "Users can view own progress"
  ON public.lesson_progress FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can track own progress"
  ON public.lesson_progress FOR INSERT
  WITH CHECK (
    user_id = auth.uid() 
    AND public.is_enrolled(public.get_lesson_product(lesson_id))
  );

CREATE POLICY "Users can update own progress"
  ON public.lesson_progress FOR UPDATE
  USING (user_id = auth.uid());

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_tenants_slug ON public.tenants(slug);
CREATE INDEX idx_tenants_owner_id ON public.tenants(owner_id);
CREATE INDEX idx_tenant_members_tenant_id ON public.tenant_members(tenant_id);
CREATE INDEX idx_tenant_members_user_id ON public.tenant_members(user_id);
CREATE INDEX idx_products_tenant_id ON public.products(tenant_id);
CREATE INDEX idx_products_slug ON public.products(slug);
CREATE INDEX idx_modules_product_id ON public.modules(product_id);
CREATE INDEX idx_modules_sort_order ON public.modules(product_id, sort_order);
CREATE INDEX idx_lessons_module_id ON public.lessons(module_id);
CREATE INDEX idx_lessons_sort_order ON public.lessons(module_id, sort_order);
CREATE INDEX idx_enrollments_user_id ON public.enrollments(user_id);
CREATE INDEX idx_enrollments_product_id ON public.enrollments(product_id);
CREATE INDEX idx_lesson_progress_user_id ON public.lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_lesson_id ON public.lesson_progress(lesson_id);