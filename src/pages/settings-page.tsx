import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLauncherStore } from "@/store/launcher-store";
import { useCallback, useEffect, useRef, useState } from "react";

export function AccountSettings() {
  const profiles = useLauncherStore((s) => s.data.profiles);
  const authRuntimeMessage = useLauncherStore((s) => s.authRuntimeMessage);
  const beginMicrosoftLogin = useLauncherStore((s) => s.beginMicrosoftLogin);
  const pollMicrosoftLogin = useLauncherStore((s) => s.pollMicrosoftLogin);
  const cancelMicrosoftLogin = useLauncherStore((s) => s.cancelMicrosoftLogin);
  const logoutMicrosoft = useLauncherStore((s) => s.logoutMicrosoft);

  const microsoftProfile = profiles.find((p) => p.provider === "microsoft");
  const isLoggedIn = microsoftProfile?.authState === "signed_in";
  const displayName = isLoggedIn ? microsoftProfile?.displayName : null;

  const [flow, setFlow] = useState<{
    sessionId: string;
    userCode: string;
    verificationUriComplete: string | null;
    expiresAtMs: number;
    intervalMs: number;
  } | null>(null);

  const pollingRef = useRef(false);

  // Polling loop
  useEffect(() => {
    if (!flow) return;
    if (Date.now() >= flow.expiresAtMs) {
      setFlow(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      try {
        const result = await pollMicrosoftLogin(flow.sessionId);
        if (result.status === "complete") {
          setFlow(null);
        } else if (result.status === "error") {
          setFlow(null);
        }
      } catch {
        setFlow(null);
      } finally {
        pollingRef.current = false;
      }
    }, flow.intervalMs);
    return () => window.clearTimeout(timer);
  }, [flow, pollMicrosoftLogin]);

  const startLogin = useCallback(async () => {
    try {
      const start = await beginMicrosoftLogin();
      setFlow({
        sessionId: start.sessionId,
        userCode: start.userCode,
        verificationUriComplete: start.verificationUriComplete ?? start.verificationUri,
        expiresAtMs: Date.now() + start.expiresInSeconds * 1000,
        intervalMs: Math.max(1000, start.intervalSeconds * 1000),
      });
    } catch {
      // handled by store
    }
  }, [beginMicrosoftLogin]);

  const cancelFlow = useCallback(async () => {
    if (!flow) return;
    await cancelMicrosoftLogin(flow.sessionId);
    setFlow(null);
  }, [flow, cancelMicrosoftLogin]);

  const handleLogout = useCallback(async () => {
    await logoutMicrosoft();
  }, [logoutMicrosoft]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Account</h2>
        <p className="text-sm text-textMuted">Manage your Microsoft account sign-in.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Microsoft Account</CardTitle>
          <CardDescription>
            Signed in with your Microsoft account to play Minecraft.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoggedIn ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ffcea7] text-sm font-medium">
                  {(displayName ?? "?")[0]?.toUpperCase() ?? "?"}
                </div>
                <div>
                  <p className="font-medium text-sm">{displayName}</p>
                  <p className="text-xs text-textMuted">Microsoft Account</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={handleLogout}>
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-textMuted">Not signed in.</p>
              <Button size="sm" onClick={startLogin} disabled={!!flow}>
                {flow ? "Waiting..." : "Sign In"}
              </Button>
            </div>
          )}

          {flow ? (
            <div className="rounded-md border border-border bg-[#0a0a0a] p-4 space-y-3">
              <p className="text-xs text-textMuted">
                Go to{" "}
                <a
                  href={flow.verificationUriComplete ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  microsoft.com/link
                </a>{" "}
                and enter the code below:
              </p>
              <div className="font-mono text-lg font-semibold tracking-[0.15em] text-center select-all">
                {flow.userCode}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigator.clipboard.writeText(flow.userCode)}
                >
                  Copy Code
                </Button>
                <Button size="sm" variant="ghost" className="flex-1" onClick={cancelFlow}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {authRuntimeMessage ? (
            <p className="text-xs text-textMuted">{authRuntimeMessage}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
