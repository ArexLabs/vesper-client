import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "@/router";
import "@/styles/globals.css";
import { TooltipProvider } from "./components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";

// Disable right-click context menu
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </I18nProvider>
  </React.StrictMode>,
);
