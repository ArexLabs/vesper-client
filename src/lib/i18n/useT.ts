import { useTranslation } from "react-i18next";
import type en from "./locales/en.json";

export type I18nKey = keyof typeof en;

export function useT() {
  return useTranslation();
}
