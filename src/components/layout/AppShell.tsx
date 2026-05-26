import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";

import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLauncherStore } from "@/store/launcher-store";

import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export function AppShell() {
  const boot = useLauncherStore((state) => state.boot);
  const status = useLauncherStore((state) => state.status);
  const error = useLauncherStore((state) => state.error);
  const shouldPromptLogin = useLauncherStore(
    (state) => state.shouldPromptLogin,
  );
  const beginMicrosoftLogin = useLauncherStore(
    (state) => state.beginMicrosoftLogin,
  );
  const pollMicrosoftLogin = useLauncherStore(
    (state) => state.pollMicrosoftLogin,
  );
  const cancelMicrosoftLogin = useLauncherStore(
    (state) => state.cancelMicrosoftLogin,
  );

  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginFlow, setLoginFlow] = useState<{
    sessionId: string;
    userCode: string;
    verificationUri: string;
    verificationUriComplete: string | null;
    expiresAtMs: number;
    nextPollDelayMs: number;
  } | null>(null);

  const pollingRef = useRef(false);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    if (status === "ready" && shouldPromptLogin()) {
      setShowLoginPrompt(true);
    }
  }, [status, shouldPromptLogin]);

  useEffect(() => {
    if (!loginFlow) return;
    if (Date.now() >= loginFlow.expiresAtMs) {
      setLoginFlow(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      try {
        const result = await pollMicrosoftLogin(loginFlow.sessionId);
        if (result.status === "pending") {
          setLoginFlow((prev) =>
            prev
              ? {
                  ...prev,
                  nextPollDelayMs: Math.max(
                    1000,
                    (result.retryAfterSeconds ?? 5) * 1000,
                  ),
                }
              : prev,
          );
          return;
        }
        if (result.status === "complete") {
          setLoginFlow(null);
          setShowLoginPrompt(false);
          return;
        }
        setLoginFlow(null);
      } catch {
        setLoginFlow(null);
      } finally {
        pollingRef.current = false;
      }
    }, loginFlow.nextPollDelayMs);

    return () => window.clearTimeout(timer);
  }, [loginFlow, pollMicrosoftLogin]);

  const handleCancel = useCallback(async () => {
    if (!loginFlow) return;
    await cancelMicrosoftLogin(loginFlow.sessionId);
    setLoginFlow(null);
  }, [loginFlow, cancelMicrosoftLogin]);

  async function startLogin() {
    try {
      const start = await beginMicrosoftLogin();
      setLoginFlow({
        sessionId: start.sessionId,
        userCode: start.userCode,
        verificationUri: start.verificationUri,
        verificationUriComplete: start.verificationUriComplete ?? null,
        expiresAtMs: Date.now() + start.expiresInSeconds * 1000,
        nextPollDelayMs: Math.max(1000, start.intervalSeconds * 1000),
      });
    } catch {
      // Login failure is non-fatal — the user can retry via the prompt.
    }
  }

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-svh w-full bg-[#0a0a0a] text-text">
          <Sidebar onLoginRequest={() => setShowLoginPrompt(true)} />
          <SidebarInset className="flex min-w-0 flex-1 flex-col bg-transparent">
            {/* Mobile Header */}
            <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-white/5 bg-[#0a0a0a]/80 px-4 backdrop-blur-md md:hidden">
              <SidebarTrigger />
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <div className="size-4 rounded-xs border-2 border-primary rotate-45" />
              </div>
              <span className="text-sm font-black uppercase tracking-widest text-white">
                Vesper
              </span>
            </header>

            {error ? (
              <div className="bg-danger/10 px-6 py-3 text-sm text-danger">
                {error}
              </div>
            ) : null}

            <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 [scrollbar-gutter:stable_both-edges] md:px-6 motion-preset-fade motion-duration-500">
              {status === "loading" ? (
                <LoadingShell />
              ) : (
                <div className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col">
                  <Outlet />
                </div>
              )}
            </main>
          </SidebarInset>
        </div>

        {showLoginPrompt && !loginFlow ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm motion-preset-fade motion-duration-200">
            <div className="w-[400px] rounded-3xl border border-white/10 bg-[#0d0d0d] p-6 shadow-lift motion-preset-slide-up motion-duration-300 motion-ease-spring-smooth">
              <h2 className="mb-2 text-lg font-semibold text-white">
                Welcome to Vesper
              </h2>
              <p className="mb-4 text-sm leading-5 text-textMuted">
                Sign in with your Microsoft account to access Minecraft and
                manage your profiles.
              </p>
              <div className="flex gap-3">
                <Button
                  size="sm"
                  onClick={() => void startLogin()}
                  className="flex-1"
                >
                  Sign in with Microsoft
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowLoginPrompt(false)}
                >
                  Skip for now
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {loginFlow ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm motion-preset-fade motion-duration-200">
            <div className="w-[400px] rounded-3xl border border-white/10 bg-[#0d0d0d] p-6 shadow-lift motion-preset-slide-up motion-duration-300 motion-ease-spring-smooth">
              <h2 className="mb-2 text-lg font-semibold text-white">
                Microsoft Login
              </h2>
              <p className="mb-4 text-xs leading-5 text-textMuted">
                Enter this code at the Microsoft login page to complete sign in.
              </p>
              <div className="mb-4 rounded-md border border-border bg-[#0a0a0a] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-textMuted font-bold">
                  Code
                </div>
                <div className="font-mono text-lg font-semibold tracking-[0.15em] text-text">
                  {loginFlow.userCode}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    window.open(
                      loginFlow.verificationUriComplete ??
                        loginFlow.verificationUri,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  Open Microsoft
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigator.clipboard.writeText(loginFlow.userCode)
                  }
                >
                  Copy Code
                </Button>
              </div>
              <div className="mt-4 border-t border-white/10 pt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-textMuted hover:text-danger"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </SidebarProvider>
    </TooltipProvider>
  );
}

function LoadingShell() {
  return (
    <div className="mx-auto grid w-full max-w-[1180px] gap-4">
      <Skeleton className="h-28 rounded-3xl" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    </div>
  );
}
