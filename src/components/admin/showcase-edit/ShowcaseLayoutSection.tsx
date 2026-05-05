import { useTranslation } from "react-i18next";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ShowcasePreview, { type PreviewCourse } from "@/components/admin/showcase/ShowcasePreview";
import BrowserChrome from "@/components/admin/BrowserChrome";
import type { ShowcaseFormData } from "./ShowcaseGeneralSection";

interface ShowcaseLayoutSectionProps {
  form: ShowcaseFormData;
  onChange: (patch: Partial<ShowcaseFormData>) => void;
  courses?: PreviewCourse[];
}

export function ShowcaseLayoutSection({ form, onChange, courses }: ShowcaseLayoutSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="flex gap-6 h-full min-h-0 max-w-[1200px] 3xl:max-w-[1600px] mx-auto">
      {/* Left: Controls */}
      <div className="w-full max-w-[400px] overflow-y-auto space-y-6 px-1">
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>{t("showcaseEdit.layout.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tema */}
            <div className="flex gap-6">
              <div className="w-1/2">
                <p className="text-sm font-medium text-foreground">{t("showcaseEdit.layout.theme")}</p>
              </div>
              <div className="w-1/2">
                <RadioGroup
                  value={form.theme}
                  onValueChange={(v) => onChange({ theme: v })}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="theme-dark" />
                    <Label htmlFor="theme-dark" className="cursor-pointer font-normal">
                      {t("showcaseEdit.layout.themeDark")}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="theme-light" />
                    <Label htmlFor="theme-light" className="cursor-pointer font-normal">
                      {t("showcaseEdit.layout.themeLight")}
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Colunas do grid */}
            <div className="flex gap-6">
              <div className="w-1/2">
                <p className="text-sm font-medium text-foreground">{t("showcaseEdit.layout.gridColumns")}</p>
              </div>
              <div className="w-1/2">
                <RadioGroup
                  value={String(form.grid_columns)}
                  onValueChange={(v) => onChange({ grid_columns: Number(v) })}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="3" id="cols-3" />
                    <Label htmlFor="cols-3" className="cursor-pointer font-normal">
                      {t("showcaseEdit.layout.columns3")}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="4" id="cols-4" />
                    <Label htmlFor="cols-4" className="cursor-pointer font-normal">
                      {t("showcaseEdit.layout.columns4")}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="5" id="cols-5" />
                    <Label htmlFor="cols-5" className="cursor-pointer font-normal">
                      {t("showcaseEdit.layout.columns5")}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="6" id="cols-6" />
                    <Label htmlFor="cols-6" className="cursor-pointer font-normal">
                      {t("showcaseEdit.layout.columns6")}
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

          </CardContent>
        </Card>
      </div>

      {/* Right: Preview inside browser chrome */}
      <div className="flex-1 h-full min-h-[500px]">
        <BrowserChrome url="seusite.com/showcase/preview">
          <ShowcasePreview
            title={form.title}
            description={form.description}
            hero_url={form.bg_url}
            theme={form.theme}
            grid_columns={form.grid_columns}
            courses={courses}
          />
        </BrowserChrome>
      </div>
    </div>
  );
}
