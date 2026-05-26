import { useLauncherStore } from "@/store/launcher-store";
import { type ReactNode, useEffect } from "react";
import i18next from "./setup";

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useLauncherStore((s) => s.data.ui.language);

  useEffect(() => {
    if (i18next.language !== lang) {
      i18next.changeLanguage(lang);
    }
  }, [lang]);

  return children;
}
