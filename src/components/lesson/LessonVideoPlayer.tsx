import { useState, useMemo } from "react";
import { PlayCircle, Loader2 } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useLessonProgress } from "@/hooks/useLessonProgress";

interface LessonVideoPlayerProps {
  embedUrl: string | null;
  title: string;
  isLoading?: boolean;
  // Progress tracking (Pro feature)
  lessonId?: string;
  userId?: string;
  trackingEnabled?: boolean;
  /** Seconds to resume from (captured once on mount via key={lessonId}) */
  startTimeSeconds?: number;
}

export function LessonVideoPlayer({
  embedUrl,
  title,
  isLoading = false,
  lessonId,
  userId,
  trackingEnabled = false,
  startTimeSeconds = 0,
}: LessonVideoPlayerProps) {
  // Escuta eventos postMessage do Gumlet e salva progresso no banco
  useLessonProgress({
    lessonId,
    userId,
    enabled: trackingEnabled && !!embedUrl,
  });

  // Capture start time once on mount (won't change during playback even if
  // progress updates arrive via realtime). Component remounts via key={lessonId}.
  const [initialStartTime] = useState(startTimeSeconds);

  // Append t= to embed URL for resuming where the student left off
  const videoSrc = useMemo(() => {
    if (!embedUrl) return null;
    if (initialStartTime <= 0) return embedUrl;
    const sep = embedUrl.includes("?") ? "&" : "?";
    return `${embedUrl}${sep}t=${Math.floor(initialStartTime)}`;
  }, [embedUrl, initialStartTime]);

  if (isLoading) {
    return (
      <AspectRatio ratio={16 / 9}>
        <div className="size-full flex items-center justify-center rounded-xl bg-muted">
          <Loader2 className="size-8 animate-spin text-muted-foreground/50" />
        </div>
      </AspectRatio>
    );
  }

  if (!videoSrc) {
    return (
      <AspectRatio ratio={16 / 9}>
        <div className="size-full flex items-center justify-center rounded-xl bg-muted">
          <PlayCircle className="size-12 text-muted-foreground/30" />
        </div>
      </AspectRatio>
    );
  }

  return (
    <AspectRatio ratio={16 / 9}>
      <iframe
        src={videoSrc}
        title={title}
        className="size-full rounded-xl"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </AspectRatio>
  );
}
