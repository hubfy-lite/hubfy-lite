import { getSocialPlatform } from "@/components/icons/SocialIcons";
import { cn } from "@/lib/utils";

interface TenantPublicFooterProps {
  tenantName: string;
  socialLinks?: Record<string, string> | null;
  className?: string;
  textClassName?: string;
  iconClassName?: string;
}

export function TenantPublicFooter({
  tenantName,
  socialLinks,
  className,
  textClassName,
  iconClassName,
}: TenantPublicFooterProps) {
  const activeSocials = Object.entries(socialLinks ?? {}).filter(
    ([, handle]) => !!handle
  );

  return (
    <footer className={cn("border-t border-border/40 bg-muted/30 px-4 md:px-8", className)}>
      <div className="mx-auto flex max-w-[1200px] 3xl:max-w-[1600px] items-center justify-between py-6">
        <span className={cn("text-sm text-muted-foreground", textClassName)}>
          &copy; {new Date().getFullYear()} {tenantName}
        </span>

        {activeSocials.length > 0 ? (
          <div className="flex items-center gap-1">
            {activeSocials.map(([key, handle]) => {
              const platform = getSocialPlatform(key);
              if (!platform) return null;

              const { Icon, label, baseUrl } = platform;

              return (
                <a
                  key={key}
                  href={`https://${baseUrl}${handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    iconClassName
                  )}
                >
                  <Icon className="size-4" />
                </a>
              );
            })}
          </div>
        ) : null}
      </div>
    </footer>
  );
}
