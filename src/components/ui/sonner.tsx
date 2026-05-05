import { Check, X } from "lucide-react";
import { Toaster as Sonner, toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: (
          <div className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="size-3" strokeWidth={3} />
          </div>
        ),
        error: (
          <div className="flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
            <X className="size-3" strokeWidth={3} />
          </div>
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-2xl",
          icon: "mr-2 mt-0.5 !size-5",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
