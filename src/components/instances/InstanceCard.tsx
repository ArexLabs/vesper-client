import { MoreHorizontal, Package2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n";
import type { Instance } from "@/lib/schemas";
import { cn, formatDateTime } from "@/lib/utils";
import { useLauncherStore } from "@/store/launcher-store";

type InstanceCardProps = {
  instance: Instance;
  presetName: string | null;
  className?: string;
};

export function InstanceCard({ instance, presetName, className }: InstanceCardProps) {
  const { t, i18n } = useT();
  const navigate = useNavigate();
  const deleteInstance = useLauncherStore((state) => state.deleteInstance);
  const duplicateInstance = useLauncherStore((state) => state.duplicateInstance);
  const launchInstance = useLauncherStore((state) => state.launchInstance);

  async function handleDelete() {
    const confirmed = window.confirm(`Delete "${instance.name}"?`);
    if (!confirmed) return;
    await deleteInstance(instance.id);
  }

  return (
    <article
      className={cn(
        "rounded-3xl border border-white/8 bg-white/[0.03] p-4 shadow-panel motion-safe:transition-transform motion-safe:transition-shadow motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:shadow-soft motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.01]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/8 bg-[#0d0d0d] text-textMuted">
          <Package2 className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-text">{instance.name}</h3>
          <p className="truncate text-sm text-textMuted">
            {instance.mcVersion} · {instance.loader}
            {instance.modpackName ? ` · ${instance.modpackName}` : ""}
          </p>
        </div>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-label={`More actions for ${instance.name}`}
                      className="text-textMuted hover:bg-white/5 hover:text-text"
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  }
                />
              }
            />
            <TooltipContent>More actions</TooltipContent>
          </Tooltip>

          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => navigate(`/instances/${instance.id}`)}>
              Open
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/config-studio?instance=${instance.id}`)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void duplicateInstance(instance.id)}>
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void handleDelete()} variant="destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 grid gap-3 rounded-3xl border border-white/8 bg-[#0d0d0d] p-4 text-sm">
        <InfoCell label={t("preset")} value={presetName ?? "None"} />
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoCell
            label={t("lastPlayed")}
            value={formatDateTime(instance.lastPlayedAt, i18n.language)}
          />
          <InfoCell label="Updated" value={formatDateTime(instance.updatedAt, i18n.language)} />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          className="flex-1 rounded-2xl"
          onClick={() => void launchInstance(instance.id)}
          type="button"
        >
          Play
        </Button>
        <Button
          className="rounded-2xl"
          onClick={() => navigate(`/instances/${instance.id}`)}
          type="button"
          variant="outline"
        >
          {t("open")}
        </Button>
      </div>
    </article>
  );
}

type InfoCellProps = {
  label: string;
  value: string;
};

function InfoCell({ label, value }: InfoCellProps) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-textMuted">
        {label}
      </div>
      <div className="truncate text-sm text-text">{value}</div>
    </div>
  );
}
