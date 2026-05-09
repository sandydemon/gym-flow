import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole, canAccess } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Dumbbell, LayoutDashboard, Users, Receipt, LogOut, UserCircle, ClipboardCheck, Crown, Menu, X, ChevronLeft, Wallet, UsersRound, BarChart3, Sparkles, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

const allNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/members', label: 'Members', icon: Users },
  { href: '/fees', label: 'Fees', icon: Receipt },
  { href: '/attendance', label: 'Attendance', icon: ClipboardCheck },
  { href: '/paid-training', label: 'Training', icon: Crown },
  { href: '/expenses', label: 'Expenses', icon: Wallet },
  { href: '/staff', label: 'Staff', icon: UsersRound },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/activity-logs', label: 'Activity Logs', icon: Activity },
  { href: '/profile', label: 'Profile', icon: UserCircle },
];

function SidebarContent({ collapsed, onNavClick }: { collapsed: boolean; onNavClick?: () => void }) {
  const location = useLocation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { data: roleInfo } = useUserRole();
  const role = roleInfo?.role;
  const navItems = allNavItems.filter(item => canAccess(role, item.href));

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("flex items-center gap-2.5 px-4 py-5 border-b border-border/20", collapsed && "justify-center px-2")}>
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(166,76%,58%)] to-[hsl(270,60%,65%)] shadow-lg shadow-primary/25">
          <Dumbbell className="h-5 w-5 text-primary-foreground" />
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[hsl(166,76%,58%)] to-[hsl(270,60%,65%)] opacity-40 blur-md -z-10" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-xl font-extrabold gradient-text leading-tight">GymFlow</span>
            <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wider uppercase">Management</span>
          </div>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onNavClick}
              className={cn(
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-gradient-to-r from-primary/20 to-primary/5 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-primary shadow-[0_0_8px_hsl(166,76%,58%,0.5)]" />
              )}
              <item.icon className={cn("h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110", isActive && "drop-shadow-[0_0_6px_hsl(166,76%,58%,0.4)]")} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Sign Out */}
      <div className="p-3 border-t border-border/20">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className={cn(
            "w-full rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200",
            collapsed ? "px-2 justify-center" : "justify-start gap-3"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        {/* Mobile Header */}
        <header className="sticky top-0 z-50 border-b border-border/30 bg-card/80 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between px-4">
            <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(166,76%,58%)] to-[hsl(270,60%,65%)]">
                <Dumbbell className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-extrabold gradient-text">GymFlow</span>
            </Link>
            <div className="w-9" />
          </div>
        </header>

        {/* Mobile Sidebar Sheet */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[260px] p-0 bg-card border-border/20">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SidebarContent collapsed={false} onNavClick={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <main className="px-4 py-6">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Background Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[hsl(166,76%,58%)] opacity-[0.03] blur-[120px]" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 rounded-full bg-[hsl(270,60%,65%)] opacity-[0.03] blur-[120px]" />
        <div className="absolute -bottom-40 right-1/3 w-96 h-96 rounded-full bg-[hsl(200,80%,60%)] opacity-[0.02] blur-[120px]" />
      </div>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "sticky top-0 h-screen border-r border-border/20 bg-card/40 backdrop-blur-2xl transition-all duration-300 shrink-0",
          collapsed ? "w-[68px]" : "w-[230px]"
        )}
      >
        <SidebarContent collapsed={collapsed} />
        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border/40 bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 shadow-md transition-all duration-200"
        >
          <ChevronLeft className={cn("h-3.5 w-3.5 transition-transform duration-300", collapsed && "rotate-180")} />
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 px-8 py-6">
        {children}
      </main>
    </div>
  );
}
