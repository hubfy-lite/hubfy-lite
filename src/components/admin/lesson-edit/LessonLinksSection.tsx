import { useTranslation } from "react-i18next";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface LessonLink {
  label: string;
  url: string;
  displayUrl: string;
}

const MAX_LINKS = 10;

interface LessonLinksSectionProps {
  links: LessonLink[];
  onLinksChange: (links: LessonLink[]) => void;
}

export function LessonLinksSection({
  links,
  onLinksChange,
}: LessonLinksSectionProps) {
  const { t } = useTranslation();

  const handleAdd = () => {
    if (links.length >= MAX_LINKS) return;
    onLinksChange([...links, { label: "", url: "", displayUrl: "" }]);
  };

  const handleRemove = (index: number) => {
    onLinksChange(links.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof LessonLink, value: string) => {
    const updated = links.map((link, i) =>
      i === index ? { ...link, [field]: value } : link
    );
    onLinksChange(updated);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-section mb-2">{t("lessonEdit.links.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("lessonEdit.links.subtitle")}
        </p>
      </div>

      {/* Link list */}
      {links.length > 0 && (
        <div className="space-y-5">
          {links.map((link, index) => (
            <div
              key={index}
              className="p-5 bg-muted/40 rounded-lg border border-border space-y-4"
            >
              {/* Nome */}
              <div className="flex gap-6">
                <div className="w-2/5 shrink-0">
                  <p className="text-sm font-medium">{t("lessonEdit.links.nameLabel")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("lessonEdit.links.nameDescription")}
                  </p>
                </div>
                <div className="w-3/5">
                  <Input
                    value={link.label}
                    onChange={(e) => handleChange(index, "label", e.target.value)}
                    placeholder={t("lessonEdit.links.labelPlaceholder")}
                  />
                </div>
              </div>

              {/* URL destino */}
              <div className="flex gap-6">
                <div className="w-2/5 shrink-0">
                  <p className="text-sm font-medium">{t("lessonEdit.links.urlLabel")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("lessonEdit.links.urlDescription")}
                  </p>
                </div>
                <div className="w-3/5">
                  <Input
                    value={link.url}
                    onChange={(e) => handleChange(index, "url", e.target.value)}
                    placeholder={t("lessonEdit.links.urlPlaceholder")}
                    type="url"
                  />
                </div>
              </div>

              {/* URL visível */}
              <div className="flex gap-6">
                <div className="w-2/5 shrink-0">
                  <p className="text-sm font-medium">{t("lessonEdit.links.displayUrlLabel")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("lessonEdit.links.displayUrlDescription")}
                  </p>
                </div>
                <div className="w-3/5">
                  <Input
                    value={link.displayUrl}
                    onChange={(e) => handleChange(index, "displayUrl", e.target.value)}
                    placeholder={t("lessonEdit.links.displayUrlPlaceholder")}
                  />
                </div>
              </div>

              {/* Remove */}
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(index)}
                >
                  <Trash2 className="size-3.5 mr-1.5" />
                  {t("common.remove")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {links.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-lg">
          <ExternalLink className="size-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            {t("lessonEdit.links.empty")}
          </p>
          <Button variant="outline" onClick={handleAdd}>
            <Plus className="size-4 mr-1.5" />
            {t("lessonEdit.links.add")}
          </Button>
        </div>
      )}

      {/* Add button — left-aligned, normal width */}
      {links.length > 0 && links.length < MAX_LINKS && (
        <Button variant="outline" onClick={handleAdd}>
          <Plus className="size-4 mr-1.5" />
          {t("lessonEdit.links.add")}
        </Button>
      )}

      {/* Limit hint */}
      {links.length >= MAX_LINKS && (
        <p className="text-xs text-muted-foreground">
          {t("lessonEdit.links.limitReached")}
        </p>
      )}
    </div>
  );
}
