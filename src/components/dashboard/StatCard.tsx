import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon?: LucideIcon;
  variant?: 'default' | 'safe' | 'suspicious' | 'rogue';
}

export function StatCard({ title, value, subtitle, icon: Icon, variant = 'default' }: StatCardProps) {
  return (
    <div className="card-stat">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={cn(
            'text-3xl font-bold mt-1',
            variant === 'safe' && 'text-status-safe',
            variant === 'suspicious' && 'text-status-suspicious',
            variant === 'rogue' && 'text-status-rogue',
          )}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
        {Icon && (
          <div className={cn(
            'p-2 rounded-lg',
            variant === 'default' && 'text-muted-foreground',
            variant === 'safe' && 'text-status-safe',
            variant === 'suspicious' && 'text-status-suspicious',
            variant === 'rogue' && 'text-status-rogue',
          )}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
