import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN || process.env.SENTRY_AUTH_TOKEN;
  const sentryOrg = env.SENTRY_ORG || process.env.SENTRY_ORG;
  const sentryProject = env.SENTRY_PROJECT || process.env.SENTRY_PROJECT;
  const enableSentrySourcemaps =
    mode === "production" && Boolean(sentryAuthToken && sentryOrg && sentryProject);

  // Supabase project URL (for dev proxy)
  const supabaseUrl =
    env.VITE_SUPABASE_URL;

  return {
    server: {
      host: "::",
      port: Number(process.env.PORT) || 8784,
      strictPort: true,
      hmr: {
        overlay: false,
      },
      // Proxy /functions/v1/* → Supabase in dev to avoid CORS issues
      proxy: {
        "/functions/v1": {
          target: supabaseUrl,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    build: {
      // Required for readable stack traces in Sentry (only enabled when upload is configured).
      sourcemap: enableSentrySourcemaps,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-supabase": ["@supabase/supabase-js"],
            "vendor-query": ["@tanstack/react-query"],
            "vendor-sentry": ["@sentry/react"],
            "vendor-i18n": ["i18next", "react-i18next", "i18next-browser-languagedetector"],
          },
        },
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      // Run `ANALYZE=1 npm run build` to generate dist/bundle-report.html
      process.env.ANALYZE &&
        visualizer({
          filename: "dist/bundle-report.html",
          gzipSize: true,
          brotliSize: true,
          template: "treemap",
        }),
      ...(enableSentrySourcemaps
        ? sentryVitePlugin({
            org: sentryOrg,
            project: sentryProject,
            authToken: sentryAuthToken,
            telemetry: false,
          })
        : []),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query"],
    },
    optimizeDeps: {
      include: ["@tanstack/react-query"],
    },
  };
});
