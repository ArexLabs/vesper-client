import { useMemo } from "react";
import { Link } from "react-router-dom";
import { DiscoverModsSection } from "@/components/discover/DiscoverModsSection";
import { InstanceCard } from "@/components/instances/InstanceCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLauncherStore } from "@/store/launcher-store";

export function HomePage() {
  const instances = useLauncherStore((state) => state.data.instances);
  const presets = useLauncherStore((state) => state.data.presets);

  const presetById = useMemo(
    () => Object.fromEntries(presets.map((preset) => [preset.id, preset.name])),
    [presets],
  );

  const lastPlayedInstances = useMemo(() => {
    return [...instances]
      .sort((left, right) => {
        const leftKey = left.lastPlayedAt ?? left.updatedAt ?? left.createdAt;
        const rightKey = right.lastPlayedAt ?? right.updatedAt ?? right.createdAt;
        return rightKey.localeCompare(leftKey);
      })
      .slice(0, 3);
  }, [instances]);

  return (
    <div className="grid gap-5 motion-preset-fade motion-duration-500">
      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-text">Last played</h2>
        </div>

        {lastPlayedInstances.length === 0 ? (
          <Card className="rounded-3xl border-white/8 bg-white/[0.03] shadow-panel">
            <CardContent className="grid gap-3 p-6 text-center">
              <p className="text-sm text-textMuted">
                No instances yet. Create one in your library to start launching Minecraft.
              </p>
              <div>
                <Button asChild className="rounded-2xl" type="button">
                  <Link to="/instances">Open Library</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {lastPlayedInstances.map((instance) => (
              <InstanceCard
                key={instance.id}
                instance={instance}
                presetName={
                  instance.presetId ? (presetById[instance.presetId] ?? instance.presetId) : null
                }
              />
            ))}
          </div>
        )}
      </section>

      <DiscoverModsSection compact />
    </div>
  );
}
