import i18next from "i18next";
import Backend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import yaml from "js-yaml";

export const LANGUAGES = ["en", "de", "fr", "es", "ja", "zh-CN", "pt-BR"] as const;
export type Locale = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  ja: "日本語",
  "zh-CN": "简体中文",
  "pt-BR": "Português (Brasil)",
};

i18next
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    backend: {
      loadPath: "/language/{{lng}}.yaml",
      parse: (data: string) => yaml.load(data) as Record<string, string>,
    },
    fallbackLng: "en",
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  });

export default i18next;
