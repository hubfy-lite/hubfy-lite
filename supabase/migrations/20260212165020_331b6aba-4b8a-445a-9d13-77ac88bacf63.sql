-- Índices compostos para queries de ordenação frequentes
CREATE INDEX IF NOT EXISTS idx_modules_course_sort ON public.modules(course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lessons_module_sort ON public.lessons(module_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_showcases_tenant_sort ON public.showcases(tenant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_showcase_courses_showcase_sort ON public.showcase_courses(showcase_id, sort_order);