import i18next from "./i18n/setup";
export type { I18nKey } from "./i18n/useT";

export function t(key: string): string {
  return i18next.t(key);
}

export { I18nProvider } from "./i18n/I18nProvider";
export { useT } from "./i18n/useT";
export type { Locale } from "./i18n/setup";
