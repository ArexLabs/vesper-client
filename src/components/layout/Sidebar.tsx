import { cn } from "@/lib/utils";
import { useLauncherStore } from "@/store/launcher-store";
import {
  Compass,
  Home,
  LibraryBig,
  LogOut,
  Settings2,
  Shirt,
  User,
  ChevronRight,
  Sparkles,
  Command,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarTrigger,
  useSidebar,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type SidebarProps = {
  onLoginRequest?: () => void;
};

const PRIMARY_ITEMS = [
  { icon: Home, label: "Home", to: "/" },
  { icon: Compass, label: "Explore", to: "/discover" },
  { icon: LibraryBig, label: "Library", to: "/instances" },
  { icon: Shirt, label: "Skins", to: "/skins" },
] as const;

export function Sidebar({ onLoginRequest }: SidebarProps) {
  const profiles = useLauncherStore((s) => s.data.profiles);
  const logoutMicrosoft = useLauncherStore((s) => s.logoutMicrosoft);
  const { state } = useSidebar();

  const activeProfile =
    profiles.find(
      (p) => p.provider === "microsoft" && p.authState === "signed_in",
    ) ??
    profiles.find((p) => p.authState === "signed_in") ??
    null;

  const isLoggedIn = Boolean(activeProfile);
  const displayName = isLoggedIn
    ? activeProfile?.displayName?.trim() || "Player"
    : null;
  const minecraftUsername = isLoggedIn
    ? ((activeProfile as { minecraftUsername?: string | null })
        ?.minecraftUsername ?? null)
    : null;

  const primaryName = minecraftUsername || displayName || "Player";
  const subtitleName = minecraftUsername ? displayName || "Authenticated" : "Authenticated";

  return (
    <SidebarPrimitive
      collapsible="icon"
      className="border-r-0 bg-[#0a0a0a] transition-all duration-300"
    >
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3 px-2 py-3 transition-all">
          <div className="flex aspect-square size-10 items-center justify-center rounded-2xl bg-primary shadow-glow group-data-[collapsible=icon]:size-8 transition-all">
            <Command className="size-5 text-black group-data-[collapsible=icon]:size-4" />
          </div>
          <div className="flex flex-col gap-0.5 group-data-[collapsible=icon]:hidden motion-preset-fade">
            <span className="text-sm font-black uppercase tracking-widest text-white">
              Vesper
            </span>
            <span className="text-[10px] font-bold text-primary/70">
              ALPHA v0.4.2
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-textMuted/40 group-data-[collapsible=icon]:hidden">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2 pt-2">
              {PRIMARY_ITEMS.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    render={
                      <NavLink
                        to={item.to}
                        end={item.to === "/"}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 transition-colors",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-textMuted group-hover:text-white",
                          )
                        }
                      >
                        <item.icon className="size-5" />
                        <span className="font-bold tracking-tight">
                          {item.label}
                        </span>
                      </NavLink>
                    }
                    tooltip={item.label}
                    className="h-11 rounded-xl transition-all hover:bg-white/5 active:scale-95"
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-white/5 mx-4 my-2" />

        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-textMuted/40 group-data-[collapsible=icon]:hidden">
            Management
          </SidebarGroupLabel>
          <SidebarMenu className="gap-2 pt-2">
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-textMuted group-hover:text-white",
                      )
                    }
                  >
                    <Settings2 className="size-5" />
                    <span className="font-bold tracking-tight">Settings</span>
                  </NavLink>
                }
                tooltip="Settings"
                className="h-11 rounded-xl hover:bg-white/5"
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 mt-auto">
        {isLoggedIn ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  className="h-14 rounded-2xl bg-white/5 border border-white/5 p-2 transition-all hover:bg-white/10 data-[state=open]:bg-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="size-10 rounded-xl border border-white/10">
                        <AvatarImage
                          src={`https://minotar.net/avatar/${encodeURIComponent(minecraftUsername ?? displayName ?? "Steve")}/100`}
                          className="image-pixelated"
                        />
                        <AvatarFallback className="bg-primary/20 text-primary font-bold">
                          {(primaryName ?? "?")[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 size-3.5 rounded-full border-2 border-[#0a0a0a] bg-green-500 shadow-glow-sm" />
                    </div>
                    <div className="flex flex-col items-start gap-0.5 group-data-[collapsible=icon]:hidden overflow-hidden">
                      <span className="truncate text-xs font-black uppercase tracking-wide text-white">
                        {primaryName}
                      </span>
                      <span className="text-[10px] font-bold text-textMuted uppercase opacity-50">
                        {subtitleName}
                      </span>
                    </div>
                    <ChevronRight className="ml-auto size-4 text-textMuted group-data-[collapsible=icon]:hidden opacity-50" />
                  </div>
                </SidebarMenuButton>
              }
            />
            <DropdownMenuContent
              side="right"
              align="end"
              sideOffset={8}
              className="w-56 rounded-2xl border-border bg-surface2 shadow-lift motion-preset-slide-right motion-duration-200"
            >
              <DropdownMenuLabel className="flex flex-col gap-1 p-3">
                <p className="text-xs font-black uppercase tracking-widest text-white">
                  {primaryName}
                </p>
                {minecraftUsername && displayName && minecraftUsername !== displayName ? (
                  <p className="text-[10px] font-bold text-textMuted">
                    {displayName}
                  </p>
                ) : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem className="rounded-lg m-1 gap-2 focus:bg-white/5">
                <User className="size-4 text-primary" />
                <span className="font-bold text-xs">Profile Details</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg m-1 gap-2 focus:bg-white/5">
                <Sparkles className="size-4 text-secondary" />
                <span className="font-bold text-xs">Manage Skins</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem
                onClick={() => void logoutMicrosoft()}
                className="rounded-lg m-1 gap-2 text-danger focus:bg-danger/10 focus:text-danger"
              >
                <LogOut className="size-4" />
                <span className="font-bold text-xs">Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <SidebarMenuButton
            size="lg"
            onClick={() => onLoginRequest?.()}
            className="h-14 rounded-2xl bg-primary/10 border border-primary/20 p-2 transition-all hover:bg-primary/20 hover:border-primary/40 group-data-[collapsible=icon]:p-0!"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary shadow-glow group-data-[collapsible=icon]:size-8">
                <User className="size-5 text-black group-data-[collapsible=icon]:size-4" />
              </div>
              <div className="flex flex-col items-start gap-0.5 group-data-[collapsible=icon]:hidden">
                <span className="text-xs font-black uppercase tracking-wide text-primary">
                  Anonymous
                </span>
                <span className="text-[10px] font-bold text-primary/70">
                  Tap to Sign In
                </span>
              </div>
            </div>
          </SidebarMenuButton>
        )}
      </SidebarFooter>
    </SidebarPrimitive>
  );
}
