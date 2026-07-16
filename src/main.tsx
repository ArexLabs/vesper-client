import { router } from "@/router";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "@/styles/globals.css";
import { I18nProvider } from "@/lib/i18n";
import { TooltipProvider } from "./components/ui/tooltip";

// Disable right-click context menu
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <I18nProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </I18nProvider>
  </React.StrictMode>,
);
