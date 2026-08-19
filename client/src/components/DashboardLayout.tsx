import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { AuthPanel } from "./AuthPanel";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, ShieldCheck } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [{ icon: LayoutDashboard, label: "Leads workspace", path: "/" }];
const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 264;
const MIN_WIDTH = 220;
const MAX_WIDTH = 400;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) return <AuthPanel />;

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const activeMenuItem = menuItems.find(item => item.path === location);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const nextWidth = event.clientX - sidebarLeft;
      if (nextWidth >= MIN_WIDTH && nextWidth <= MAX_WIDTH) setSidebarWidth(nextWidth);
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div ref={sidebarRef} className="relative">
        <Sidebar collapsible="icon" className="border-r border-slate-200 bg-[#fbfcfd]" disableTransition={isResizing}>
          <SidebarHeader className="h-[5.25rem] justify-center border-b border-slate-100 px-4">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSidebar}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm transition-transform hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 active:scale-95"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold tracking-tight text-slate-950">Devign Lead Forge</p>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Agent workspace</p>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="px-3 py-5">
            {!isCollapsed && <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Workspace</p>}
            <SidebarMenu>
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-11 rounded-xl px-3 text-sm font-semibold data-[active=true]:bg-slate-950 data-[active=true]:text-white data-[active=true]:shadow-sm"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {!isCollapsed && (
              <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-xs font-bold">Secure team access</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-emerald-800/70">Every claim is tied to a verified agent identity.</p>
              </div>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-100 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-9 w-9 shrink-0 border border-slate-200 bg-slate-100">
                    <AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-700">{user?.name?.charAt(0).toUpperCase() || "A"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-sm font-semibold leading-none text-slate-800">{user?.name || "Agent"}</p>
                    <p className="mt-1.5 truncate text-xs text-slate-400">{user?.email || "Signed in agent"}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl">
                <DropdownMenuItem onClick={logout} className="cursor-pointer rounded-lg text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-slate-300 ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => setIsResizing(true)}
        />
      </div>

      <SidebarInset className="bg-[#f6f7f9]">
        {isMobile && (
          <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-200 bg-[#f6f7f9]/95 px-4 backdrop-blur">
            <SidebarTrigger className="h-9 w-9 rounded-xl border border-slate-200 bg-white" />
            <span className="text-sm font-semibold text-slate-800">{activeMenuItem?.label ?? "Workspace"}</span>
          </div>
        )}
        <main className="min-h-screen flex-1">{children}</main>
      </SidebarInset>
    </>
  );
}
