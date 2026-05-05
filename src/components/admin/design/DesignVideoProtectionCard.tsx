import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction, translateEdgeError } from "@/lib/edge-function-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DesignVideoProtectionCardProps {
  tenantId: string;
  plan: string;
  videoProtectionEnabled: boolean;
  onRefetch: () => void;
}

export default function DesignVideoProtectionCard({
  tenantId,
  plan,
  videoProtectionEnabled,
  onRefetch,
}: DesignVideoProtectionCardProps) {
  const [isToggling, setIsToggling] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(videoProtectionEnabled);

  const isPro = plan === "pro" || plan === "business";

  const handleToggle = async (checked: boolean) => {
    if (!isPro) return;

    setIsToggling(true);
    setLocalEnabled(checked); // optimistic update

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      await invokeEdgeFunction("hosting-enable-video-protection", {
        body: { tenant_id: tenantId, enable: checked },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      toast.success(
        checked
          ? "Proteção de vídeo ativada com sucesso"
          : "Proteção de vídeo desativada"
      );

      onRefetch();
    } catch (err) {
      setLocalEnabled(!checked); // reverter em caso de erro
      toast.error(translateEdgeError(err));
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Card variant="bordered" className="mt-6">
      <CardHeader>
        <CardTitle>Proteção de vídeo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Label className={cn("text-sm font-medium", !isPro && "text-muted-foreground")}>
                Bloqueio anti-pirataria
              </Label>
              <Badge variant="blue" className="text-xs">Pro</Badge>
            </div>
            <p className={cn("text-xs text-muted-foreground", !isPro && "opacity-60")}>
              Gera URLs únicas por usuário com token de validação que expira a cada 12h, impedindo o compartilhamento dos vídeos.
            </p>
          </div>
          <Switch
            checked={isPro ? localEnabled : false}
            onCheckedChange={handleToggle}
            disabled={!isPro || isToggling}
          />
        </div>
      </CardContent>
    </Card>
  );
}
