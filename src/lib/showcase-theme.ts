/**
 * Shared CSS variable overrides for showcase theme isolation.
 *
 * The admin app always has <html class="dark">, so Tailwind v3 darkMode:["class"]
 * always finds a dark ancestor. We override CSS variables inline so both the
 * preview (ShowcasePreview) and the public page (ClubShowcasePage) can display
 * either theme independently of the admin's context.
 *
 * Values must be HSL channels (H S% L%) matching the format in index.css,
 * since Tailwind resolves colors as hsl(var(--xxx)).
 */

export const LIGHT_VARS: React.CSSProperties = {
  "--background": "223.8136 0.0005% 98.6829%",
  "--foreground": "223.8136 0.0000% 1.2920%",
  "--card": "223.8136 -172.5242% 100.0000%",
  "--card-foreground": "223.8136 0.0000% 1.2920%",
  "--popover": "223.8136 -172.5242% 100.0000%",
  "--popover-foreground": "0 0% 0%",
  "--primary": "223.8136 0.0000% 8.6104%",
  "--primary-foreground": "223.8136 0.0003% 97.3691%",
  "--secondary": "223.8136 0.0001% 92.1478%",
  "--secondary-foreground": "223.8136 0.0000% 17.9236%",
  "--muted": "223.8136 0.0002% 96.0587%",
  "--muted-foreground": "223.8136 0.0000% 32.3067%",
  "--accent": "248 98% 61%",
  "--accent-foreground": "0 0% 100%",
  "--destructive": "358.8683 74.6580% 50.3424%",
  "--destructive-foreground": "213.7504 96.4852% 96.7906%",
  "--border": "223.8136 0.0001% 89.5577%",
  "--input": "223.8136 0.0001% 92.1478%",
  "--ring": "223.8136 0.0000% 32.3067%",
} as React.CSSProperties;

export const DARK_VARS: React.CSSProperties = {
  "--background": "223.8136 0.0000% 1.2920%",
  "--foreground": "223.8136 0.0005% 98.6829%",
  "--card": "223.8136 0.0000% 4.3484%",
  "--card-foreground": "223.8136 0.0001% 92.1478%",
  "--popover": "223.8136 0.0000% 3.9225%",
  "--popover-foreground": "223.8136 -172.5242% 100.0000%",
  "--primary": "223.8136 0.0001% 92.1478%",
  "--primary-foreground": "223.8136 0.0000% 1.2920%",
  "--secondary": "223.8136 0.0000% 13.1499%",
  "--secondary-foreground": "223.8136 0.0001% 92.1478%",
  "--muted": "223.8136 0.0000% 11.3040%",
  "--muted-foreground": "223.8136 0.0000% 64.4710%",
  "--accent": "248 98% 61%",
  "--accent-foreground": "0 0% 100%",
  "--destructive": "358.7594 101.8439% 69.8357%",
  "--destructive-foreground": "213.7504 96.4852% 96.7906%",
  "--border": "223.8136 0.0000% 14.0871%",
  "--input": "223.8136 0.0000% 19.8916%",
  "--ring": "223.8136 0.0000% 50.2111%",
} as React.CSSProperties;
