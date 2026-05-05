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
    textClassName: "text-[#f4c57f]",
  },
  {
    icon: "/assets/svg/maximize.svg",
    key: "maximize",
    label: "Toggle maximize window",
    textClassName: "text-[#78c8ff]",
  },
  {
    icon: "/assets/svg/close.svg",
    key: "close",
    label: "Close window",
    textClassName: "text-[#ff7388]",
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
    <header className="flex h-14 items-center bg-[#0d0f12]/95 pl-4 pr-3">
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
                  aria-label={control.key === "maximize" ? (isMaximized ? "Restore window" : control.label) : control.label}
                  className={`h-8 w-8 rounded-xl hover:bg-white/6 ${control.textClassName}`}
                  onClick={() => void runWindowAction(control.key)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <AssetIcon className="h-[18px] w-[18px]" src={control.icon} />
                </Button>
              }
            />
            <TooltipContent>
              {control.key === "maximize" ? (isMaximized ? "Restore window" : "Maximize window") : control.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </header>
  );
}
