import { Navigate, useParams, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface CourseShowcaseRouteProps {
  children: React.ReactNode;
}

export function CourseShowcaseRoute({ children }: CourseShowcaseRouteProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to={`/${tenantSlug}/login`}
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  return <>{children}</>;
}
