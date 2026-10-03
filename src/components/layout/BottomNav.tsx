import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Bell, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: FileText, label: 'Reports', path: '/reports' },
  { icon: Bell, label: 'Alerts', path: '/alerts' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border lg:hidden z-50">
      <div className="flex items-center justify-around py-2">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path;
          
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 text-xs transition-colors',
                isActive 
                  ? 'text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
              {isActive && (
                <div className="absolute bottom-0 w-1 h-1 rounded-full bg-foreground" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
