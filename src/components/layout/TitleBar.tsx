import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AssetIcon } from "@/components/layout/AssetIcon";

const WINDOW_CONTROLS = [
  {
    icon: "/assets/svg/minimize.svg",
    key: "minimize",
    label: "Minimize window",
    textClassName: "text-white/40 hover:text-[#ffcea7]",
  },
  {
    icon: "/assets/svg/maximize.svg",
    key: "maximize",
    label: "Toggle maximize window",
    textClassName: "text-white/40 hover:text-[#ffcea7]",
  },
  {
    icon: "/assets/svg/close.svg",
    key: "close",
    label: "Close window",
    textClassName: "text-white/40 hover:text-[#ff7388]",
  },
] as const;

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const currentWindow = getCurrentWindow();
        const maximized = await currentWindow.isMaximized();
        if (!active) return;
        setIsMaximized(maximized);
      } catch {
        if (!active) return;
        setIsMaximized(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function runWindowAction(action: "minimize" | "maximize" | "close") {
    try {
      const currentWindow = getCurrentWindow();
      if (action === "minimize") {
        await currentWindow.minimize();
        return;
      }
      if (action === "close") {
        await currentWindow.close();
        return;
      }
      await currentWindow.toggleMaximize();
      setIsMaximized(await currentWindow.isMaximized());
    } catch {
      // Tauri window APIs are unavailable in the browser preview.
    }
  }

  return (
    <header
      className="flex h-14 items-center bg-[#0a0a0a]/95 pl-4 pr-3 select-none border-b border-white/[0.04]"
      data-tauri-drag-region
    >
      <div
        className="flex min-w-0 flex-1 items-center"
        data-tauri-drag-region
        onDoubleClick={() => void runWindowAction("maximize")}
      >
        <div className="flex min-w-0 items-center gap-0" data-tauri-drag-region>
          <img
            alt=""
            className="h-3.5 w-auto shrink-0 object-contain translate-y-[-0.3px] translate-x-[0.5px]"
            draggable={false}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = "/assets/icon.png";
            }}
            src="/assets/icon-header.png"
          />
          <span className="truncate text-[0.95rem] font-bold tracking-tight">
            <span className="text-[#ffcea7]">esper </span>
            <span className="text-white">Client</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        {WINDOW_CONTROLS.map((control) => (
          <Tooltip key={control.key}>
            <TooltipTrigger
              render={
                <Button
                  aria-label={
                    control.key === "maximize"
                      ? isMaximized
                        ? "Restore window"
                        : control.label
                      : control.label
                  }
                  className={`h-8 w-8 rounded-lg hover:bg-white/5 transition-colors ${control.textClassName}`}
                  onClick={() => void runWindowAction(control.key)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <AssetIcon className="h-4 w-4" src={control.icon} />
                </Button>
              }
            />
            <TooltipContent>
              {control.key === "maximize"
                ? isMaximized
                  ? "Restore window"
                  : "Maximize window"
                : control.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </header>
  );
}
