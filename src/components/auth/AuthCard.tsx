import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AuthCardProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold">
            <span className="gradient-text">Smart</span>
            <span className="text-foreground">Members</span>
          </h1>
        </div>

        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
            {description && (
              <p className="text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}
