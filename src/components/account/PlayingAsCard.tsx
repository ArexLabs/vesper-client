import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLauncherStore } from "@/store/launcher-store";
import { ChevronUp, ExternalLink, LogOut, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

type LoginFlowState = {
  sessionId: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string | null;
  expiresAtMs: number;
  nextPollDelayMs: number;
  message: string;
  error: string | null;
};

type PlayingAsCardProps = {
  collapsed?: boolean;
};

export function PlayingAsCard({ collapsed = false }: PlayingAsCardProps) {
  const profiles = useLauncherStore((s) => s.data.profiles);
  const authRuntimeMessage = useLauncherStore((s) => s.authRuntimeMessage);
  const beginMicrosoftLogin = useLauncherStore((s) => s.beginMicrosoftLogin);
  const pollMicrosoftLogin = useLauncherStore((s) => s.pollMicrosoftLogin);
  const logoutMicrosoft = useLauncherStore((s) => s.logoutMicrosoft);

  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [loginFlow, setLoginFlow] = useState<LoginFlowState | null>(null);
  const [isStartingLogin, setIsStartingLogin] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const activeProfile =
    profiles.find((p) => p.provider === "microsoft" && p.authState === "signed_in") ??
    profiles.find((p) => p.authState === "signed_in") ??
    null;

  const isLoggedIn = Boolean(activeProfile);
  const playerFace = isLoggedIn ? activeProfile?.displayName?.trim() || "Player" : "X-Steve";
  const displayName = isLoggedIn ? playerFace : "Not Logged In";
  const panelTitle = loginFlow || !isLoggedIn ? "Microsoft Login" : "Player Account";

  useEffect(() => {
    if (!loginFlow) return;
    if (Date.now() >= loginFlow.expiresAtMs) {
      setLocalError("Login code expired. Start again.");
      setLoginFlow(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await pollMicrosoftLogin(loginFlow.sessionId);
          if (result.status === "pending") {
            setLoginFlow((prev) =>
              prev
                ? {
                    ...prev,
                    nextPollDelayMs: Math.max(1000, (result.retryAfterSeconds ?? 5) * 1000),
                    error: null,
                  }
                : prev,
            );
            return;
          }
          if (result.status === "complete") {
            setLoginFlow(null);
            setLocalError(null);
            setShowLoginPanel(false);
            return;
          }
          setLocalError(result.message ?? "Login failed.");
          setLoginFlow(null);
        } catch (error) {
          setLocalError(error instanceof Error ? error.message : "Login polling failed.");
          setLoginFlow(null);
        }
      })();
    }, loginFlow.nextPollDelayMs);

    return () => window.clearTimeout(timer);
  }, [loginFlow, pollMicrosoftLogin]);

  async function startLogin() {
    setIsStartingLogin(true);
    setLocalError(null);
    try {
      const start = await beginMicrosoftLogin();
      setShowLoginPanel(true);
      setLoginFlow({
        sessionId: start.sessionId,
        userCode: start.userCode,
        verificationUri: start.verificationUri,
        verificationUriComplete: start.verificationUriComplete,
        expiresAtMs: Date.now() + start.expiresInSeconds * 1000,
        nextPollDelayMs: Math.max(1000, start.intervalSeconds * 1000),
        message: start.message,
        error: null,
      });
      const url = start.verificationUriComplete ?? start.verificationUri;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Microsoft login unavailable.");
      setShowLoginPanel(true);
    } finally {
      setIsStartingLogin(false);
    }
  }

  async function signOut() {
    setIsLoggingOut(true);
    setLocalError(null);
    try {
      await logoutMicrosoft();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Failed to sign out.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  const cardClassName = cn(
    "relative overflow-hidden border border-white/8 bg-white/[0.03] shadow-panel transition-[width,height,padding,border-radius,gap] duration-300 ease-in-out",
    collapsed
      ? "flex h-24 w-12 flex-col items-center justify-center gap-1 justify-self-center rounded-2xl p-1.5"
      : "flex h-14 w-full items-center gap-2.5 rounded-2xl px-2.5 py-2.5",
  );

  const cardContent = (
    <>
      <img
        src={`https://vzge.me/face/512/${encodeURIComponent(playerFace)}.png`}
        alt={`${displayName} player head`}
        className={cn(
          "block shrink-0 object-cover transition-[width,height] duration-300 ease-in-out",
          collapsed ? "h-9 w-9" : "h-10 w-10",
        )}
        style={{ imageRendering: "pixelated" }}
        loading="lazy"
        decoding="async"
      />
      <div
        className={cn(
          "min-w-0 overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out",
          collapsed ? "max-w-0 opacity-0" : "flex-1 max-w-[10rem] opacity-100",
        )}
      >
        <div
          className="text-[13px] font-semibold leading-4 text-text"
          style={{
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            display: "-webkit-box",
            overflow: "hidden",
            wordBreak: "break-word",
          }}
        >
          {displayName}
        </div>
      </div>
    </>
  );

  const collapsedToggle = (
    <button
      type="button"
      className={cn(
        "grid place-items-center rounded-xl text-textMuted transition-[width,height,opacity,transform,margin] duration-300 ease-in-out hover:bg-white/6 hover:text-text",
        collapsed
          ? "mb-0 h-9 w-9 opacity-100"
          : "pointer-events-none -mb-2 h-0 w-0 opacity-0 scale-90",
      )}
      onClick={() => setShowLoginPanel((current) => !current)}
      aria-label={
        isLoggedIn ? `Open player switcher for ${displayName}` : "Open player login panel"
      }
      tabIndex={collapsed ? 0 : -1}
    >
      <ChevronUp
        className={cn(
          "h-5 w-5 transition-transform duration-200 ease-in-out",
          showLoginPanel && "rotate-180",
        )}
      />
    </button>
  );

  const expandedAction = !collapsed ? (
    isLoggedIn ? (
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Log out Microsoft account"
        title="Log out"
        onClick={() => void signOut()}
        disabled={isLoggingOut}
        className="ml-auto h-9 w-9 text-textMuted transition-[opacity,transform] duration-300 ease-in-out hover:bg-white/6 hover:text-text"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    ) : (
      <Button
        type="button"
        size="icon"
        variant="outline"
        aria-label="Log in with Microsoft"
        title="Log in with Microsoft"
        onClick={() => void startLogin()}
        disabled={isStartingLogin}
        className="ml-auto h-9 w-9 border-white/10 bg-[#11161c] transition-[opacity,transform] duration-300 ease-in-out hover:bg-white/6"
      >
        <Plus className="h-4 w-4" />
      </Button>
    )
  ) : null;

  return (
    <div className={cn("relative", collapsed && "justify-self-center")}>
      <div className={cardClassName}>
        {collapsedToggle}
        {cardContent}
        {expandedAction}
      </div>

      {showLoginPanel ? (
        <div
          className={cn(
            "z-50 w-[320px] rounded-3xl border border-white/10 bg-[#11161c]/95 p-3 shadow-lift backdrop-blur sm:w-[360px]",
            collapsed
              ? "absolute bottom-0 left-[calc(100%+12px)]"
              : "absolute bottom-[calc(100%+8px)] left-0",
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-text">{panelTitle}</div>
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-md text-textMuted transition hover:bg-white/5 hover:text-text"
              onClick={() => setShowLoginPanel(false)}
              aria-label="Close login panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {loginFlow ? (
            <div className="grid gap-3">
              <div className="text-xs leading-5 text-textMuted">
                Open Microsoft and enter this code to continue. The launcher will finish sign-in
                automatically after authorization.
              </div>
              <div className="rounded-md border border-border bg-bg px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-textMuted">Code</div>
                <div className="font-mono text-lg font-semibold tracking-[0.15em] text-text">
                  {loginFlow.userCode}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    window.open(
                      loginFlow.verificationUriComplete ?? loginFlow.verificationUri,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Microsoft
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void navigator.clipboard.writeText(loginFlow.userCode)}
                >
                  Copy Code
                </Button>
              </div>
              <div className="text-[11px] leading-5 text-textMuted">
                {loginFlow.error ? loginFlow.error : loginFlow.message}
              </div>
            </div>
          ) : isLoggedIn ? (
            <div className="grid gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <img
                  src={`https://vzge.me/face/512/${encodeURIComponent(playerFace)}.png`}
                  alt={`${displayName} player head`}
                  className="h-10 w-10 shrink-0 object-cover"
                  style={{ imageRendering: "pixelated" }}
                  loading="lazy"
                  decoding="async"
                />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-textMuted">
                    Playing As
                  </div>
                  <div className="truncate text-sm font-semibold text-text">{displayName}</div>
                  <div className="truncate text-[11px] text-textMuted">Microsoft connected</div>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void signOut()}
                disabled={isLoggingOut}
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="grid gap-2">
              <div className="text-xs text-textMuted">
                Start a Microsoft device login flow to sign into Minecraft securely.
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => void startLogin()}
                disabled={isStartingLogin}
              >
                <Plus className="h-3.5 w-3.5" />
                Start Login
              </Button>
            </div>
          )}

          {localError ? (
            <div className="mt-3 rounded-md border border-danger/25 bg-danger/10 px-2 py-1.5 text-xs text-danger">
              {localError}
            </div>
          ) : null}
          {!localError && authRuntimeMessage ? (
            <div className="mt-3 rounded-md border border-borderSoft bg-surface1 px-2 py-1.5 text-xs text-textMuted">
              {authRuntimeMessage}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
