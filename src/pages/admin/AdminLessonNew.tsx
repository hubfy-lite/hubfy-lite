import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { NO_AUTOFILL_PROPS } from "@/lib/no-autofill";

export default function AdminLessonNew() {
  const navigate = useNavigate();
  const { courseId, moduleId } = useParams(); // both are public_ids now
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!moduleId) {
      setError(t("lessonNew.invalidModule"));
      return;
    }

    if (!title.trim()) {
      setError(t("lessonNew.titleRequired"));
      return;
    }

    setLoading(true);
    setError(null);

    // Resolve module UUID from public_id
    const { data: mod, error: modError } = await supabase
      .from("modules")
      .select("id")
      .eq("public_id", moduleId)
      .single();

    if (modError || !mod) {
      setError(t("lessonNew.invalidModule"));
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("lessons").insert({
      module_id: mod.id,
      title: title.trim(),
      description: description.trim() || null,
      sort_order: 0,
      is_active: isPublished,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    navigate(`/admin/content`);
  };

  return (
    <div className="h-full min-w-0 overflow-hidden p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex h-full min-w-0 max-w-[1200px] 3xl:max-w-[1600px] flex-col space-y-6">
        <h1 className="text-title">{t("lessonNew.title")}</h1>

        <Card className="card-container space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">{t("lessonNew.labelTitle")}</label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("lessonNew.titlePlaceholder")}
              className="mt-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">{t("lessonNew.labelDescription")}</label>
            <Textarea
              {...NO_AUTOFILL_PROPS}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("lessonNew.descriptionPlaceholder")}
              className="mt-2"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">{t("lessonNew.publishNow")}</p>
              <p className="text-xs text-muted-foreground">{t("lessonNew.publishHint")}</p>
            </div>
            <Switch checked={isPublished} onCheckedChange={setIsPublished} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate(`/admin/courses/${courseId}/modules/new`)}>
              {t("lessonNew.createAnotherModule")}
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? t("lessonNew.saving") : t("lessonNew.createLesson")}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
