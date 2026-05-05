import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import ptBR from "./locales/pt-BR.json";
import en from "./locales/en.json";
import es from "./locales/es.json";

// Edge function error translations — kept in a separate file per locale to
// avoid bloating the main locale files. Merged here under the `edgeErrors`
// top-level key so callers use `t("edgeErrors.<code>")` just like any other.
import edgeErrorsPtBR from "./locales/edgeErrors/pt-BR.json";
import edgeErrorsEn from "./locales/edgeErrors/en.json";
import edgeErrorsEs from "./locales/edgeErrors/es.json";

// PostgREST / Storage error translations (v2 — see translateAppError).
// Kept separate for the same reason: avoid bloating main locale files.
import dbErrorsPtBR from "./locales/dbErrors/pt-BR.json";
import dbErrorsEn from "./locales/dbErrors/en.json";
import dbErrorsEs from "./locales/dbErrors/es.json";

// Generic app-level fallback used by translateAppError when the error
// shape is unknown and no custom fallback was provided.
import appErrorsPtBR from "./locales/appErrors/pt-BR.json";
import appErrorsEn from "./locales/appErrors/en.json";
import appErrorsEs from "./locales/appErrors/es.json";

const STORAGE_KEY = "hubfy.language";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "pt-BR": {
        translation: {
          ...ptBR,
          edgeErrors: edgeErrorsPtBR,
          dbErrors: dbErrorsPtBR,
          appErrors: appErrorsPtBR,
        },
      },
      en: {
        translation: {
          ...en,
          edgeErrors: edgeErrorsEn,
          dbErrors: dbErrorsEn,
          appErrors: appErrorsEn,
        },
      },
      es: {
        translation: {
          ...es,
          edgeErrors: edgeErrorsEs,
          dbErrors: dbErrorsEs,
          appErrors: appErrorsEs,
        },
      },
    },
    fallbackLng: "pt-BR",
    supportedLngs: ["pt-BR", "en", "es"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: STORAGE_KEY,
      caches: ["localStorage"],
    },
  });

i18n.on("languageChanged", (lng) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
  }
});

export default i18n;
export { STORAGE_KEY };
