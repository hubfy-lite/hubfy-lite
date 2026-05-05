import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LessonProgressEntry {
  completed: boolean;
  progress_seconds: number;
}

export interface LessonProgressMap {
  [lessonId: string]: LessonProgressEntry;
}

/**
 * Busca o progresso de todas as aulas de um curso para o usuário logado.
 * Retorna um mapa { lessonId → { completed, progress_seconds } }.
 *
 * Escuta realtime para atualizar quando o player marca progresso.
 */
export function useCourseProgress(
  courseId: string | undefined,
  userId: string | undefined,
  lessonIds: string[],
) {
  const queryClient = useQueryClient();
  const queryKey = ["course-progress", courseId, userId];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<LessonProgressMap> => {
      if (!userId || lessonIds.length === 0) return {};

      const { data, error } = await supabase
        .from("lesson_progress")
        .select("lesson_id, completed, progress_seconds")
        .eq("user_id", userId)
        .in("lesson_id", lessonIds);

      if (error) {
        console.warn("[useCourseProgress] Erro:", error.message);
        return {};
      }

      const map: LessonProgressMap = {};
      for (const row of data ?? []) {
        map[row.lesson_id] = {
          completed: row.completed,
          progress_seconds: row.progress_seconds,
        };
      }
      return map;
    },
    enabled: !!courseId && !!userId && lessonIds.length > 0,
    staleTime: 30_000,
  });

  // Realtime: invalida cache quando o progresso muda
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`course-progress-${courseId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lesson_progress",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [courseId, userId, queryClient, queryKey]);

  return query;
}
