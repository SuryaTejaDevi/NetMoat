import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Bell,
  Settings,
  Wifi,
  Search,
  Radio,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const mainNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Wifi, label: 'Networks', path: '/networks' },
  { icon: Radio, label: 'Scanning', path: '/scanning' },
];

const monitoringNavItems = [
  { icon: Bell, label: 'Alerts', path: '/alerts' },
  { icon: FileText, label: 'Reports', path: '/reports' },
  { icon: History, label: 'History', path: '/history' },
];

const systemNavItems = [
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function Sidebar() {
  const location = useLocation();

  const NavItem = ({ icon: Icon, label, path }: { icon: React.ElementType; label: string; path: string }) => {
    const isActive = location.pathname === path;

    return (
      <Link
        to={path}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
        )}
      >
        <Icon className="h-5 w-5" />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <aside className="hidden lg:flex flex-col w-56 bg-sidebar text-sidebar-foreground h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border">
        <span className="text-lg font-semibold">NetMoat</span>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-sidebar-accent/50 rounded-lg text-sidebar-muted text-sm">
          <Search className="h-4 w-4" />
          <span>Search</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-6 overflow-y-auto scrollbar-thin">
        {/* Main */}
        <div>
          <p className="px-3 mb-2 text-xs font-medium uppercase tracking-wider text-sidebar-muted">
            Main
          </p>
          <div className="space-y-1">
            {mainNavItems.map((item) => (
              <NavItem key={item.path} {...item} />
            ))}
          </div>
        </div>

        {/* Monitoring */}
        <div>
          <p className="px-3 mb-2 text-xs font-medium uppercase tracking-wider text-sidebar-muted">
            Monitoring
          </p>
          <div className="space-y-1">
            {monitoringNavItems.map((item) => (
              <NavItem key={item.path} {...item} />
            ))}
          </div>
        </div>

        {/* System */}
        <div>
          <p className="px-3 mb-2 text-xs font-medium uppercase tracking-wider text-sidebar-muted">
            System
          </p>
          <div className="space-y-1">
            {systemNavItems.map((item) => (
              <NavItem key={item.path} {...item} />
            ))}
          </div>
        </div>
      </nav>

    </aside>
  );
}
