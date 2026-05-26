import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n";
import type { Instance } from "@/lib/schemas";
import { cn, formatDateTime } from "@/lib/utils";
import { useLauncherStore } from "@/store/launcher-store";
import {
  MoreHorizontal,
  Package2,
  Play,
  FolderOpen,
  Copy,
  Trash2,
  Clock,
  Layers,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type InstanceCardProps = {
  instance: Instance;
  presetName: string | null;
  className?: string;
};

const DELETE_CONFIRM_TIMEOUT_MS = 3000;

export function InstanceCard({
  instance,
  presetName,
  className,
}: InstanceCardProps) {
  const { t, i18n } = useT();
  const navigate = useNavigate();
  const deleteInstance = useLauncherStore((state) => state.deleteInstance);
  const duplicateInstance = useLauncherStore(
    (state) => state.duplicateInstance,
  );
  const launchInstance = useLauncherStore((state) => state.launchInstance);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  function handleDeleteClick() {
    if (confirmingDelete) {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setConfirmingDelete(false);
      void deleteInstance(instance.id);
      return;
    }
    setConfirmingDelete(true);
    deleteTimerRef.current = setTimeout(
      () => setConfirmingDelete(false),
      DELETE_CONFIRM_TIMEOUT_MS,
    );
  }

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[32px] border border-white/5 bg-surface1/40 p-5 shadow-panel transition-all hover:border-primary/20 hover:bg-surface2/40 hover:shadow-glow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-glow-sm transition-transform group-hover:scale-105">
            <Package2 className="h-6 w-6" />
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold tracking-tight text-white">
              {instance.name}
            </h3>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-primary/80">
                {instance.loader}
              </span>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span className="text-xs font-medium text-textMuted">
                {instance.mcVersion}
              </span>
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                className="h-9 w-9 rounded-xl border-white/5 bg-white/5 text-textMuted hover:bg-white/10 hover:text-text"
                size="icon"
                variant="ghost"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent
            align="end"
            className="w-48 rounded-2xl border-border bg-surface2 shadow-lift"
          >
            <DropdownMenuItem
              className="rounded-xl"
              onClick={() => navigate(`/instances/${instance.id}`)}
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              Open Instance
            </DropdownMenuItem>
            <DropdownMenuItem
              className="rounded-xl"
              onClick={() => navigate(`/config-studio?instance=${instance.id}`)}
            >
              <Layers className="mr-2 h-4 w-4" />
              Config Studio
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem
              className="rounded-xl"
              onClick={() => void duplicateInstance(instance.id)}
            >
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              className={cn(
                "rounded-xl",
                confirmingDelete
                  ? "bg-danger text-white hover:bg-danger/90"
                  : "text-danger hover:bg-danger/10 hover:text-danger",
              )}
              onClick={handleDeleteClick}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {confirmingDelete ? "Click again to confirm" : "Delete Instance"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-textMuted">
            <Layers className="h-3 w-3" />
            Preset
          </div>
          <div className="mt-1 truncate text-[13px] font-semibold text-text">
            {presetName ?? "Normal"}
          </div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-textMuted">
            <Clock className="h-3 w-3" />
            Last played
          </div>
          <div className="mt-1 truncate text-[13px] font-semibold text-text">
            {formatDateTime(instance.lastPlayedAt, i18n.language) === "Never"
              ? "Never"
              : formatDateTime(instance.lastPlayedAt, i18n.language)}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button
          className="h-11 flex-1 rounded-2xl bg-primary text-black font-bold shadow-glow-sm hover:scale-[1.02] active:scale-[0.98] transition-transform"
          onClick={() => void launchInstance(instance.id)}
        >
          <Play className="mr-2 h-4 w-4 fill-current" />
          Play
        </Button>
        <Button
          variant="outline"
          className="h-11 rounded-2xl border-white/5 bg-white/5 font-semibold text-white hover:bg-white/10"
          onClick={() => navigate(`/instances/${instance.id}`)}
        >
          Open
        </Button>
      </div>
    </article>
  );
}
