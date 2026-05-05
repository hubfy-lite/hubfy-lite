import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { FRONTEND_NAME_MAX_LENGTH, limitNameLength } from "@/lib/name-limits";
import { NO_AUTOFILL_PROPS } from "@/lib/no-autofill";

export default function AdminModuleNew() {
  const navigate = useNavigate();
  const { courseId } = useParams(); // courseId is now public_id (e.g. crse_xxxx)
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!courseId) {
      setError(t("moduleNew.invalidCourse"));
      return;
    }

    if (!title.trim()) {
      setError(t("moduleNew.titleRequired"));
      return;
    }

    setLoading(true);
    setError(null);

    // Resolve course UUID from public_id
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("public_id", courseId)
      .single();

    if (courseError || !course) {
      setError(t("moduleNew.invalidCourse"));
      setLoading(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("modules")
      .insert({
        course_id: course.id,
        title: limitNameLength(title.trim()),
        description: description.trim() || null,
        sort_order: 0,
        is_default: false,
      })
      .select("public_id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    navigate(`/admin/courses/${courseId}/modules/${data.public_id}/lessons/new`);
  };

  return (
    <div className="h-full min-w-0 overflow-hidden p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex h-full min-w-0 max-w-[1200px] 3xl:max-w-[1600px] flex-col space-y-6">
        <h1 className="text-title">{t("moduleNew.title")}</h1>

        <Card className="card-container space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">{t("moduleNew.labelTitle")}</label>
            <Input
              value={title}
              onChange={(event) => setTitle(limitNameLength(event.target.value))}
              placeholder={t("moduleNew.titlePlaceholder")}
              className="mt-2"
              maxLength={FRONTEND_NAME_MAX_LENGTH}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">{t("moduleNew.labelDescription")}</label>
            <Textarea
              {...NO_AUTOFILL_PROPS}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("moduleNew.descriptionPlaceholder")}
              className="mt-2"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? t("moduleNew.saving") : t("moduleNew.createModule")}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
