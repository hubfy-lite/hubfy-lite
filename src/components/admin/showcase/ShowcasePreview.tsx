import { LIGHT_VARS, DARK_VARS } from "@/lib/showcase-theme";

export interface PreviewCourse {
  id: string;
  title: string;
  cover_url: string | null;
}

interface ShowcasePreviewProps {
  title: string;
  description: string;
  hero_url: string | null;
  theme: string;
  grid_columns: number;
  courses?: PreviewCourse[];
}

const PLACEHOLDER_COURSES: PreviewCourse[] = Array.from({ length: 6 }, (_, i) => ({
  id: `placeholder-${i}`,
  title: `Curso ${i + 1}`,
  cover_url: null,
}));

export default function ShowcasePreview({
  title,
  description,
  hero_url,
  theme,
  grid_columns,
  courses,
}: ShowcasePreviewProps) {
  const isDark = theme === "dark";
  const displayCourses = courses && courses.length > 0 ? courses : PLACEHOLDER_COURSES;

  return (
    <div
      className="h-full w-full overflow-y-auto rounded-xl border border-border bg-background text-foreground"
      style={isDark ? DARK_VARS : LIGHT_VARS}
    >
      {/* Hero */}
      <div className="relative w-full aspect-[3/1] overflow-hidden">
        {hero_url ? (
          <img
            src={hero_url}
            alt="Hero preview"
            className="size-full object-cover"
          />
        ) : (
          <div className="size-full flex items-center justify-center bg-muted">
            <span className="text-sm opacity-40">Imagem de capa</span>
          </div>
        )}
        {/* Overlay title — text-white intencional (sobre gradient escuro) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-6">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {title || "Título da Área"}
            </h2>
            {description && (
              <p className="text-sm text-white/70 mt-1 line-clamp-2">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Course Grid */}
      <div className="p-6">
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${grid_columns}, minmax(0, 1fr))`,
          }}
        >
          {displayCourses.map((course) => {
            const coverUrl = course.cover_url;
            return (
              <div
                key={course.id}
                className="rounded-lg overflow-hidden border border-border bg-card"
              >
                <div
                  className="aspect-[16/10] bg-muted overflow-hidden"
                >
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={course.title}
                      className="size-full object-cover"
                    />
                  ) : (
                    <img
                      src="/images/placeholder.svg"
                      alt=""
                      className="size-full object-cover opacity-70"
                    />
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium truncate">{course.title}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
