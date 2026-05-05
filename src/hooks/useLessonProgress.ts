import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Intervalo de salvamento automático (em segundos)
const SAVE_THROTTLE_SECONDS = 15;

// Considera aula concluída quando o aluno assistiu 90% do vídeo
const COMPLETION_THRESHOLD = 0.9;

/**
 * Formato real do postMessage do Gumlet (protocolo Player.js / embedly):
 *
 *   {
 *     context: "player.js",
 *     version: "0.0.11",
 *     event: "timeupdate",
 *     value: { seconds: 142.5, duration: 3600 }
 *   }
 *
 * Eventos relevantes:
 *   - timeupdate → value: { seconds, duration }
 *   - pause      → sem value (usa último timeupdate)
 *   - ended      → sem value (usa último timeupdate)
 *   - seeked     → value: { seconds, duration } (extensão Gumlet)
 */
interface PlayerJsMessage {
  context?: string;
  event?: string;
  value?: {
    seconds?: number;
    duration?: number;
  };
}

interface UseLessonProgressOptions {
  lessonId: string | undefined;
  userId: string | undefined;
  enabled: boolean;
}

/**
 * Rastreia o progresso do vídeo de uma aula escutando os eventos
 * postMessage do player Gumlet (iframe, protocolo Player.js) e
 * salvando no banco de dados.
 *
 * Estratégia de salvamento:
 *   - timeupdate: salva a cada 15 segundos (throttle)
 *   - pause / ended: salva imediatamente (forçado)
 *   - Marca como concluída automaticamente se seconds/duration >= 90%
 */
export function useLessonProgress({
  lessonId,
  userId,
  enabled,
}: UseLessonProgressOptions): void {
  // Último progresso salvo (em segundos) para calcular o throttle
  const lastSavedSecondsRef = useRef<number>(-SAVE_THROTTLE_SECONDS);
  // Flag para evitar duplo-salvamento em sequência rápida
  const isSavingRef = useRef(false);
  // Último tempo/duração conhecido (para pause/ended que não enviam value)
  const lastTimeRef = useRef<number>(0);
  const lastDurationRef = useRef<number>(0);

  const saveProgress = useCallback(
    async (currentTime: number, duration: number, force = false) => {
      if (!lessonId || !userId) return;
      if (isSavingRef.current) return;

      const secondsElapsed = currentTime - lastSavedSecondsRef.current;
      if (!force && secondsElapsed < SAVE_THROTTLE_SECONDS) return;

      isSavingRef.current = true;
      lastSavedSecondsRef.current = currentTime;

      const isCompleted =
        duration > 0 && currentTime / duration >= COMPLETION_THRESHOLD;

      try {
        const { error } = await supabase.from("lesson_progress").upsert(
          {
            lesson_id: lessonId,
            user_id: userId,
            progress_seconds: Math.floor(currentTime),
            ...(isCompleted && {
              completed: true,
              completed_at: new Date().toISOString(),
            }),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "lesson_id,user_id" },
        );

        if (error) {
          console.warn("[useLessonProgress] Erro ao salvar progresso:", error.message);
        }
      } catch (err) {
        console.warn("[useLessonProgress] Falha ao salvar progresso:", err);
      } finally {
        isSavingRef.current = false;
      }
    },
    [lessonId, userId],
  );

  // Reset throttle when switching lessons (avoid stale ref from previous lesson)
  useEffect(() => {
    lastSavedSecondsRef.current = -SAVE_THROTTLE_SECONDS;
    lastTimeRef.current = 0;
    lastDurationRef.current = 0;
  }, [lessonId]);

  useEffect(() => {
    if (!enabled || !lessonId || !userId) return;

    const handleMessage = (event: MessageEvent) => {
      // Aceita apenas objetos (evita strings e outros tipos)
      if (!event.data || typeof event.data !== "object") return;

      const msg = event.data as PlayerJsMessage;

      // Filtra apenas mensagens do protocolo Player.js (Gumlet)
      if (msg.context !== "player.js" || !msg.event) return;

      const evt = msg.event;

      if (evt === "timeupdate" || evt === "seeked") {
        const seconds = msg.value?.seconds;
        const duration = msg.value?.duration;
        if (typeof seconds !== "number" || seconds < 0) return;
        const safeDuration = typeof duration === "number" ? duration : 0;

        // Salva último tempo conhecido (para pause/ended que não enviam value)
        lastTimeRef.current = seconds;
        lastDurationRef.current = safeDuration;

        saveProgress(seconds, safeDuration);
      } else if (evt === "pause" || evt === "ended") {
        // pause/ended podem não enviar value — usa último tempo do timeupdate
        const seconds = msg.value?.seconds ?? lastTimeRef.current;
        const duration = msg.value?.duration ?? lastDurationRef.current;

        if (seconds >= 0) {
          saveProgress(seconds, duration, true);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [enabled, lessonId, userId, saveProgress]);
}
