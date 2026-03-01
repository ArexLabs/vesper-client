import { useEffect, useRef, useState } from "react";
import { Compass, Home, LibraryBig, Settings2, Shirt } from "lucide-react";
import { NavLink } from "react-router-dom";
import { PlayingAsCard } from "@/components/account/PlayingAsCard";
import { AssetIcon } from "@/components/layout/AssetIcon";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

const PRIMARY_ITEMS = [
  { icon: Home, label: "Home", to: "/" },
  { icon: Compass, label: "Explore", to: "/discover" },
  { icon: LibraryBig, label: "Library", to: "/instances" },
  { icon: Shirt, label: "Skins", to: "/skins" },
] as const;

const FOOTER_ITEMS = [{ icon: Settings2, label: "Settings", to: "/settings" }] as const;

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const [tooltipsEnabled, setTooltipsEnabled] = useState(collapsed);
  const previousCollapsedRef = useRef(collapsed);

  useEffect(() => {
    if (collapsed && previousCollapsedRef.current === collapsed) {
      setTooltipsEnabled(true);
    } else if (!collapsed) {
      setTooltipsEnabled(false);
    } else {
      setTooltipsEnabled(false);
    }

    previousCollapsedRef.current = collapsed;
  }, [collapsed]);

  const toggleButton = (
    <Button
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="text-textMuted hover:bg-white/5 hover:text-text"
      onClick={onToggleCollapsed}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      <AssetIcon
        className={cn(
          "h-4 w-4 transition-transform duration-200 ease-linear",
          collapsed ? "rotate-180" : "",
        )}
        src="/assets/svg/sidebar-collapse.svg"
      />
    </Button>
  );

  return (
    <aside
      className="flex h-full w-full px-3 py-4"
      onPointerLeave={() => {
        if (collapsed) {
          setTooltipsEnabled(true);
        }
      }}
    >
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-visible rounded-[28px] bg-[#101317]/95 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="flex items-center">
          <div className={cn("flex w-full", collapsed ? "justify-center" : "justify-end pr-1")}>
            {!collapsed || tooltipsEnabled ? (
              <Tooltip>
                <TooltipTrigger render={toggleButton} />
                <TooltipContent>{collapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
              </Tooltip>
            ) : (
              toggleButton
            )}
          </div>
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <nav className="grid grid-cols-1 gap-2">
            {PRIMARY_ITEMS.map((item) => (
              <SidebarNavLink
                key={item.to}
                collapsed={collapsed}
                icon={item.icon}
                label={item.label}
                showTooltip={tooltipsEnabled}
                to={item.to}
              />
            ))}
          </nav>
        </div>

        <div className="mt-3 grid shrink-0 grid-cols-1 gap-3">
          {FOOTER_ITEMS.map((item) => (
            <SidebarNavLink
              key={item.to}
              collapsed={collapsed}
              icon={item.icon}
              label={item.label}
              showTooltip={tooltipsEnabled}
              to={item.to}
            />
          ))}

          <PlayingAsCard collapsed={collapsed} />
        </div>
      </div>
    </aside>
  );
}

type SidebarNavLinkProps = {
  collapsed: boolean;
  icon: typeof Home;
  label: string;
  secondary?: boolean;
  showTooltip: boolean;
  to: string;
};

function SidebarNavLink({
  collapsed,
  icon: Icon,
  label,
  secondary = false,
  showTooltip,
  to,
}: SidebarNavLinkProps) {
  const labelWidth = "9rem";
  const link = (
    <NavLink
      aria-label={label}
      className={({ isActive }) =>
        cn(
          "flex h-12 items-center overflow-hidden rounded-2xl border text-sm font-semibold transition-[width,padding,color,background-color,border-color] duration-200 ease-linear",
          "justify-self-start w-full justify-start px-4",
          secondary
            ? isActive
              ? "border-white/10 bg-white/[0.06] text-text"
              : "border-transparent text-textMuted hover:border-white/8 hover:bg-white/[0.03] hover:text-text"
            : isActive
              ? "border-[#ffcea7]/20 bg-[#f8d4b5]/10 text-white"
              : "border-white/6 bg-white/[0.02] text-textMuted hover:border-white/10 hover:bg-white/[0.05] hover:text-text",
        )
      }
      end={to === "/"}
      to={to}
    >
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center transition-transform duration-300 ease-in-out",
          collapsed ? "-translate-x-1" : "translate-x-0",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span
        className="pointer-events-none block min-w-0 flex-none origin-left overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-200 ease-linear"
        style={{
          marginLeft: collapsed ? "0px" : "12px",
          opacity: collapsed ? 0 : 1,
          maxWidth: collapsed ? "0px" : labelWidth,
        }}
      >
        <span className="block truncate">{label}</span>
      </span>
    </NavLink>
  );

  if (!collapsed || !showTooltip) {
    return link;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
