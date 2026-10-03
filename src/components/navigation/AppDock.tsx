import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    FileText,
    Bell,
    Settings,
    Wifi,
    Radio,
    History,
    LogOut,
} from 'lucide-react';
import { Dock, DockIcon, DockItem, DockLabel } from '@/components/ui/dock';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';

const data = [
    {
        title: 'Dashboard',
        icon: <LayoutDashboard className='h-full w-full' />,
        href: '/',
    },
    {
        title: 'Networks',
        icon: <Wifi className='h-full w-full' />,
        href: '/networks',
    },
    {
        title: 'Scanning',
        icon: <Radio className='h-full w-full' />,
        href: '/scanning',
    },
    {
        title: 'Alerts',
        icon: <Bell className='h-full w-full' />,
        href: '/alerts',
    },
    {
        title: 'Reports',
        icon: <FileText className='h-full w-full' />,
        href: '/reports',
    },
    {
        title: 'History',
        icon: <History className='h-full w-full' />,
        href: '/history',
    },
    {
        title: 'Settings',
        icon: <Settings className='h-full w-full' />,
        href: '/settings',
    },
];

export function AppDock() {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useAuth();

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    return (
        <div className='fixed bottom-4 left-1/2 max-w-full -translate-x-1/2 z-50 pointer-events-none'>
            <div className="pointer-events-auto">
                <Dock className='items-end pb-3 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border border-border shadow-2xl'>
                    {data.map((item, idx) => {
                        const isActive = location.pathname === item.href;

                        return (
                            <DockItem
                                key={idx}
                                className={cn(
                                    'aspect-square rounded-full transition-colors relative',
                                    isActive
                                        ? 'bg-primary text-primary-foreground shadow-lg'
                                        : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                                )}
                                onClick={() => navigate(item.href)}
                            >
                                <DockLabel className={cn(isActive && "font-bold text-primary dark:text-primary")}>{item.title}</DockLabel>
                                <DockIcon className="p-2.5">{item.icon}</DockIcon>
                                {isActive && (
                                    <motion.div
                                        layoutId="dock-active"
                                        className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-primary"
                                    />
                                )}
                            </DockItem>
                        );
                    })}

                    <DockItem
                        className="aspect-square rounded-full bg-muted/50 hover:bg-destructive hover:text-destructive-foreground transition-colors relative"
                        onClick={handleLogout}
                    >
                        <DockLabel>Logout</DockLabel>
                        <DockIcon className="p-2.5">
                            <LogOut className="h-full w-full" />
                        </DockIcon>
                    </DockItem>
                </Dock>
            </div>
        </div>
    );
}
