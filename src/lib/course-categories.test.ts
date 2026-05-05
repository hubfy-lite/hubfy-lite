import { describe, expect, it } from "vitest";

import {
  CATEGORY_UNSPLASH_DEFAULT_QUERY,
  getCourseCategoryUnsplashQuery,
  type CourseCategory,
} from "@/lib/course-categories";

const expectedCategoryQueries: Record<CourseCategory, string> = {
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

describe("course category unsplash queries", () => {
  it("covers every current course category", () => {
    expect(CATEGORY_UNSPLASH_DEFAULT_QUERY).toEqual(expectedCategoryQueries);

    for (const [category, query] of Object.entries(expectedCategoryQueries)) {
      expect(getCourseCategoryUnsplashQuery(category as CourseCategory)).toBe(query);
    }
  });

  it("falls back to startup when category is empty", () => {
    expect(getCourseCategoryUnsplashQuery(null)).toBe("startup");
    expect(getCourseCategoryUnsplashQuery(undefined)).toBe("startup");
    expect(getCourseCategoryUnsplashQuery("")).toBe("startup");
  });
});
