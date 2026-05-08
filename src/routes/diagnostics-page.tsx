import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { appStateSchema } from "@/lib/schemas";
import { isTauriRuntime, listInstancesNative, secureStorageProbe } from "@/lib/ipc";
import { useLauncherStore } from "@/store/launcher-store";

export function DiagnosticsPage() {
  const data = useLauncherStore((s) => s.data);
  const { t } = useT();
  const validation = appStateSchema.safeParse(data);
  const [nativeList, setNativeList] = useState<string>("Not queried");
  const [secureProbe, setSecureProbe] = useState<string>("Not queried");

  return (
    <div className="grid gap-4 motion-preset-fade motion-duration-500">
      <Card>
        <CardHeader>
          <CardTitle>{t("diagnostics")}</CardTitle>
          <CardDescription>Runtime checks, schema validation and backend probes.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="panel-soft p-3">
              <div className="label mb-1">Runtime</div>
              <div>{isTauriRuntime() ? "Tauri Desktop Runtime" : "Web Dev Runtime (Fallback)"}</div>
            </div>
            <div className="panel-soft p-3">
              <div className="label mb-1">Schema State</div>
              <div>{validation.success ? "AppState valid (Zod)" : "AppState invalid"}</div>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <Button
              variant="outline"
              onClick={async () =>
                setNativeList(JSON.stringify(await listInstancesNative(), null, 2))
              }
            >
              Probe `list_instances`
            </Button>
            <Button
              variant="outline"
              onClick={async () =>
                setSecureProbe(JSON.stringify(await secureStorageProbe(), null, 2))
              }
            >
              Probe secure storage placeholder
            </Button>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            <div>
              <div className="label mb-2">Native Instances Response</div>
              <pre className="field-mono min-h-[180px] whitespace-pre-wrap">{nativeList}</pre>
            </div>
            <div>
              <div className="label mb-2">Secure Storage Probe Response</div>
              <pre className="field-mono min-h-[180px] whitespace-pre-wrap">{secureProbe}</pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
