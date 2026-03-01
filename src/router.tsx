import { AppShell } from "@/components/layout/AppShell";
import { ConfigStudioPage } from "@/routes/config-studio-page";
import { DiagnosticsPage } from "@/routes/diagnostics-page";
import { DiscoverPage } from "@/routes/discover-page";
import { HomePage } from "@/routes/home-page";
import { InstanceDetailsPage } from "@/routes/instance-details-page";
import { InstancesPage } from "@/routes/instances/InstancesPage";
import { SettingsPage } from "@/routes/settings-page";
import { SkinsPage } from "@/routes/skins-page";
import { createHashRouter } from "react-router-dom";

export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "instances", element: <InstancesPage /> },
      { path: "instances/:instanceId", element: <InstanceDetailsPage /> },
      { path: "discover", element: <DiscoverPage /> },
      { path: "skins", element: <SkinsPage /> },
      { path: "config-studio", element: <ConfigStudioPage /> },
      { path: "diagnostics", element: <DiagnosticsPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
