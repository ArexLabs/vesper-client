import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  Compass,
  Home,
  LibraryBig,
  LogOut,
  Settings2,
  Shirt,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useLauncherStore } from "@/store/launcher-store";
import { cn } from "@/lib/utils";

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onLoginRequest?: () => void;
};

const PRIMARY_ITEMS = [
  { icon: Home, label: "Home", to: "/" },
  { icon: Compass, label: "Explore", to: "/discover" },
  { icon: LibraryBig, label: "Library", to: "/instances" },
  { icon: Shirt, label: "Skins", to: "/skins" },
] as const;

const FOOTER_ITEMS = [{ icon: Settings2, label: "Settings", to: "/settings" }] as const;

const navItemVariants = {
  expanded: {
    width: "100%",
    paddingLeft: 16,
    paddingRight: 16,
  },
  collapsed: {
    width: 48,
    paddingLeft: 0,
    paddingRight: 0,
  },
};

const labelVariants = {
  expanded: {
    opacity: 1,
    maxWidth: 200,
    marginLeft: 12,
  },
  collapsed: {
    opacity: 0,
    maxWidth: 0,
    marginLeft: 0,
  },
};

const spring = { type: "spring" as const, stiffness: 400, damping: 28 };
const labelSpring = { type: "spring" as const, stiffness: 300, damping: 26, mass: 0.8 };

export function Sidebar({ collapsed, onToggleCollapsed, onLoginRequest }: SidebarProps) {
  const profiles = useLauncherStore((s) => s.data.profiles);
  const logoutMicrosoft = useLauncherStore((s) => s.logoutMicrosoft);

  const activeProfile =
    profiles.find((p) => p.provider === "microsoft" && p.authState === "signed_in") ??
    profiles.find((p) => p.authState === "signed_in") ??
    null;
  const isLoggedIn = Boolean(activeProfile);
  const displayName = isLoggedIn ? activeProfile?.displayName?.trim() || "Player" : null;
  const minecraftUsername = isLoggedIn
    ? (activeProfile as { minecraftUsername?: string | null })?.minecraftUsername ?? null
    : null;

  return (
    <aside className="flex h-full w-full px-3 py-4 select-none">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[28px] border border-white/[0.04] bg-gradient-to-b from-[#121212] to-[#0e0e0e] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        {/* Logo + collapse toggle */}
        <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-3">
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ type: "spring", stiffness: 350, damping: 26 }}
                className="text-sm font-bold tracking-tight text-white/90"
              >
                Vesper
              </motion.span>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/70"
            onClick={onToggleCollapsed}
            type="button"
          >
            <motion.span
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <ChevronLeft className="h-4 w-4" />
            </motion.span>
          </motion.button>
        </div>

        {/* Navigation */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <nav className="flex flex-col gap-1.5">
            {PRIMARY_ITEMS.map((item) => (
              <SidebarNavItem
                key={item.to}
                collapsed={collapsed}
                icon={item.icon}
                label={item.label}
                to={item.to}
              />
            ))}
          </nav>
        </div>

        {/* Footer: settings + account */}
        <div className="mt-2 shrink-0 border-t border-white/[0.04] px-3 pt-3 pb-4">
          <div className="flex flex-col gap-1.5">
            {FOOTER_ITEMS.map((item) => (
              <SidebarNavItem
                key={item.to}
                collapsed={collapsed}
                icon={item.icon}
                label={item.label}
                to={item.to}
              />
            ))}
          </div>

          {/* Playing As / Login card */}
          <div className="mt-3">
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className={cn(
                "relative overflow-hidden rounded-2xl border transition-colors",
                isLoggedIn
                  ? "border-white/[0.06] bg-white/[0.02]"
                  : "border-white/[0.04] bg-white/[0.01] hover:border-white/[0.08] hover:bg-white/[0.03]",
              )}
            >
              {isLoggedIn ? (
                <div className="flex items-center gap-2.5 px-2.5 py-2.5">
                  <MinecraftAvatar name={minecraftUsername ?? displayName} />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ type: "spring", stiffness: 350, damping: 26 }}
                        className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden"
                      >
                        <span className="truncate text-[13px] font-semibold leading-4 text-white/85">
                          {displayName}
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => void logoutMicrosoft()}
                          className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white/60"
                          aria-label="Sign out"
                          type="button"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onLoginRequest?.()}
                  className="flex w-full items-center gap-2.5 px-2.5 py-2.5"
                  type="button"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.04]">
                    <svg
                      className="h-4 w-4 text-white/30"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                    </svg>
                  </div>
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ type: "spring", stiffness: 350, damping: 26 }}
                        className="overflow-hidden truncate text-[13px] font-medium text-white/40"
                      >
                        Sign in
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Minecraft Avatar
// ---------------------------------------------------------------------------

type MinecraftAvatarProps = {
  name: string | null;
};

function MinecraftAvatar({ name }: MinecraftAvatarProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const initial = (name ?? "?")[0]?.toUpperCase() ?? "?";

  const skinUrl = name
    ? `https://minotar.net/avatar/${encodeURIComponent(name)}/100`
    : null;

  return (
    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]">
      {/* Loading skeleton */}
      {!loaded && !errored && (
        <div className="absolute inset-0 animate-pulse bg-white/[0.04]" />
      )}

      {/* Skin image */}
      {skinUrl && !errored && (
        <img
          src={skinUrl}
          alt=""
          className="h-full w-full object-cover"
          style={{ imageRendering: "pixelated" }}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      )}

      {/* Fallback initial */}
      {errored || !skinUrl ? (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#ffcea7]/20 to-[#ffcea7]/5 text-xs font-bold text-[#ffcea7]">
          {initial}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nav item
// ---------------------------------------------------------------------------

type SidebarNavItemProps = {
  collapsed: boolean;
  icon: typeof Home;
  label: string;
  to: string;
};

function SidebarNavItem({ collapsed, icon: Icon, label, to }: SidebarNavItemProps) {
  return (
    <NavLink to={to} end={to === "/"}>
      {({ isActive }) => (
        <motion.div
          layout
          variants={navItemVariants}
          animate={collapsed ? "collapsed" : "expanded"}
          transition={spring}
          className={cn(
            "relative flex h-11 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border text-sm font-semibold transition-colors",
            isActive
              ? "border-[#ffcea7]/15 bg-[#f8d4b5]/8 text-white"
              : "border-transparent text-white/35 hover:border-white/[0.06] hover:bg-white/[0.03] hover:text-white/70",
          )}
        >
          {/* Active glow */}
          {isActive && (
            <motion.span
              layoutId="nav-active-glow"
              className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#ffcea7]/5 to-transparent"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}

          <span className="relative z-10 grid h-5 w-5 shrink-0 place-items-center">
            <Icon className="h-[18px] w-[18px]" />
          </span>

          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.span
                key="label"
                variants={labelVariants}
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
                transition={labelSpring}
                className="relative z-10 overflow-hidden whitespace-nowrap"
              >
                <span className="block truncate">{label}</span>
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </NavLink>
  );
}
