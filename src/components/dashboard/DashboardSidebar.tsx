import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Radio, 
  LayoutDashboard, 
  Home, 
  AlertTriangle, 
  Users, 
  ClipboardList,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  FileStack,
  Calendar,
  Bell,
  HelpCircle,
  ShieldCheck,
  Activity,
  UserCog,
  Receipt,
  DollarSign,
  BarChart3
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

const operationsItems = [
  { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
  { icon: Home, label: 'Properties', href: '/dashboard/properties' },
  { icon: AlertTriangle, label: 'Violations', href: '/dashboard/violations' },
  { icon: ClipboardList, label: 'Work Orders', href: '/dashboard/work-orders' },
  { icon: Users, label: 'Vendors', href: '/dashboard/vendors' },
  { icon: FileStack, label: 'Applications', href: '/dashboard/applications' },
  { icon: Bell, label: 'Notifications', href: '/dashboard/notifications' },
  { icon: Calendar, label: 'Calendar', href: '/dashboard/calendar' },
  { icon: HelpCircle, label: 'Help Center', href: '/dashboard/help' },
];

const financeItems = [
  { icon: Receipt, label: 'CAM Charges', href: '/dashboard/cam' },
  { icon: DollarSign, label: 'Owner Statements', href: '/dashboard/owner-statements' },
  { icon: BarChart3, label: 'Reports', href: '/dashboard/reports' },
];

const adminItems = [
  { icon: ShieldCheck, label: 'Admin', href: '/dashboard/admin' },
  { icon: Activity, label: 'API Logs', href: '/dashboard/admin/api-logs' },
  { icon: UserCog, label: 'Users', href: '/dashboard/admin/users' },
];

const DashboardSidebar = ({ onNavigate }: { onNavigate?: () => void }) => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isAdmin } = useAdminRole();
  const [collapsed, setCollapsed] = useState(false);

  const NavItem = ({ item }: { item: typeof operationsItems[0] }) => {
    const isActive = location.pathname === item.href || 
      (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
    
    const linkContent = (
      <Link
        to={item.href}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
          isActive 
            ? "bg-primary text-primary-foreground" 
            : "text-muted-foreground hover:text-foreground hover:bg-secondary",
          collapsed && "justify-center px-2"
        )}
      >
        <item.icon className="w-5 h-5 shrink-0" />
        {!collapsed && item.label}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <span className="block">{linkContent}</span>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  return (
    <aside 
      className={cn(
        "min-h-screen bg-card border-r border-border flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "p-4 border-b border-border flex items-center",
        collapsed ? "justify-center" : "justify-between"
      )}>
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-display font-bold text-xl text-foreground">
              CitiSignal
            </span>
          )}
        </Link>
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={() => setCollapsed(true)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="p-2 flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCollapsed(false)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {operationsItems.map((item) => (
            <li key={item.href}>
              <NavItem item={item} />
            </li>
          ))}
        </ul>

        <Separator className="my-3" />

        <ul className="space-y-1">
          {financeItems.map((item) => (
            <li key={item.href}>
              <NavItem item={item} />
            </li>
          ))}
        </ul>

        {isAdmin && (
          <>
            <div className="pt-3 pb-1">
              {!collapsed && (
                <span className="px-4 text-xs font-semibold uppercase text-muted-foreground tracking-wider">Admin</span>
              )}
            </div>
            <ul className="space-y-1">
              {adminItems.map((item) => (
                <li key={item.href}>
                  <NavItem item={item} />
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>

      {/* Avatar Popover */}
      <div className={cn(
        "p-2 border-t border-border",
        collapsed && "flex justify-center"
      )}>
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              "w-9 h-9 rounded-full bg-secondary flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all",
              !collapsed && "ml-2"
            )}>
              <span className="text-sm font-medium text-foreground">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent 
            side={collapsed ? "right" : "top"} 
            sideOffset={10} 
            align="start"
            className="w-56 p-3"
          >
            <div className="space-y-1 mb-2">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.email}
              </p>
              <p className="text-xs text-muted-foreground">Property Owner</p>
            </div>
            <Separator className="my-2" />
            <div className="space-y-1">
              <Link
                to="/dashboard/settings"
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors w-full"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
