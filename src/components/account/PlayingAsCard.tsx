import { LogOut } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLauncherStore } from "@/store/launcher-store";

type PlayingAsCardProps = {
  collapsed?: boolean;
  onLoginRequest?: () => void;
};

export function PlayingAsCard({ collapsed = false, onLoginRequest }: PlayingAsCardProps) {
  const profiles = useLauncherStore((s) => s.data.profiles);
  const logoutMicrosoft = useLauncherStore((s) => s.logoutMicrosoft);

  const isLoggingOut = useRef(false);

  const activeProfile =
    profiles.find((p) => p.provider === "microsoft" && p.authState === "signed_in") ??
    profiles.find((p) => p.authState === "signed_in") ??
    null;

  const isLoggedIn = Boolean(activeProfile);
  const playerFace = isLoggedIn ? activeProfile?.displayName?.trim() || "Player" : "X-Steve";
  const displayName = isLoggedIn ? playerFace : "Not Logged In";

  async function signOut() {
    isLoggingOut.current = true;
    try {
      await logoutMicrosoft();
    } finally {
      isLoggingOut.current = false;
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

  const expandedAction = !collapsed ? (
    isLoggedIn ? (
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Log out Microsoft account"
        title="Log out"
        onClick={() => void signOut()}
        className="ml-auto h-9 w-9 text-textMuted transition-[opacity,transform] duration-300 ease-in-out hover:bg-white/6 hover:text-text"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    ) : null
  ) : null;

  return (
    <div className={cn("relative motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:scale-[1.02]", collapsed && "justify-self-center")}>
      <div
        className={cardClassName}
        role={!isLoggedIn ? "button" : undefined}
        tabIndex={!isLoggedIn ? 0 : undefined}
        onClick={() => {
          if (!isLoggedIn) onLoginRequest?.();
        }}
        onKeyDown={(e) => {
          if (!isLoggedIn && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onLoginRequest?.();
          }
        }}
      >
        {cardContent}
        {expandedAction}
      </div>
    </div>
  );
}
