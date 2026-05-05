import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLauncherStore } from "@/store/launcher-store";

export function SkinsPage() {
  const profiles = useLauncherStore((state) => state.data.profiles);

  const activeProfile =
    profiles.find((profile) => profile.authState === "signed_in") ??
    profiles.find((profile) => profile.provider === "offline") ??
    profiles[0] ??
    null;

  const playerName =
    activeProfile?.offlineUsername?.trim() ||
    activeProfile?.displayName?.trim() ||
    "Player";

  return (
    <div className="grid gap-4">
      <Card className="rounded-3xl border-white/8 bg-white/[0.03] shadow-panel">
        <CardHeader className="p-5">
          <CardTitle className="text-xl font-semibold text-text">Skins</CardTitle>
          <p className="text-sm text-textMuted">Profile context for the player that will receive skin changes.</p>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 pt-0 text-sm text-textMuted">
          <div className="rounded-3xl border border-white/8 bg-[#11161c] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.12em] text-textMuted">Active player</div>
            <div className="mt-2 text-lg font-semibold text-text">{playerName}</div>
            <p className="mt-2 leading-6">
              Skin management is routed through the active account. Configure authentication in Settings before wiring a skin provider.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
