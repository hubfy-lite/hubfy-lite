import type { Database } from "@/integrations/supabase/types";

export type CourseCategory = Database["public"]["Enums"]["course_category"];

export const CATEGORY_OPTIONS: { value: CourseCategory; label: string }[] = [
  { value: "business_entrepreneurship", label: "Negócios e Empreendedorismo" },
  { value: "marketing_sales", label: "Marketing e Vendas" },
  { value: "finance_investments", label: "Finanças e Investimentos" },
  { value: "technology_programming", label: "Tecnologia e Programação" },
  { value: "ai_automation", label: "IA e Automação" },
  { value: "design_creativity", label: "Design e Criatividade" },
  { value: "productivity_organization", label: "Produtividade e Organização" },
  { value: "career_professional", label: "Carreira e Profissional" },
  { value: "education_learning", label: "Educação e Aprendizagem" },
  { value: "health_wellbeing", label: "Saúde e Bem-estar" },
  { value: "fitness_performance", label: "Fitness e Performance" },
  { value: "nutrition_food", label: "Nutrição e Alimentação" },
  { value: "personal_development", label: "Desenvolvimento Pessoal" },
  { value: "relationships_social", label: "Relacionamentos e Social" },
  { value: "hobbies_lifestyle", label: "Hobbies e Estilo de Vida" },
];

export const CATEGORY_LABELS: Record<CourseCategory, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((opt) => [opt.value, opt.label])
) as Record<CourseCategory, string>;

export const CATEGORY_UNSPLASH_DEFAULT_QUERY: Record<CourseCategory, string> = {
  business_entrepreneurship: "business",
  marketing_sales: "marketing",
  finance_investments: "finance",
  technology_programming: "coding",
  ai_automation: "automation",
  design_creativity: "design",
  productivity_organization: "productivity",
  career_professional: "career",
  education_learning: "education",
  health_wellbeing: "wellness",
  fitness_performance: "fitness",
  nutrition_food: "nutrition",
  personal_development: "mindset",
  relationships_social: "relationship",
  hobbies_lifestyle: "lifestyle",
};

export function getCourseCategoryUnsplashQuery(
  category?: CourseCategory | null | "",
): string {
  if (!category) return "startup";
  return CATEGORY_UNSPLASH_DEFAULT_QUERY[category];
}
