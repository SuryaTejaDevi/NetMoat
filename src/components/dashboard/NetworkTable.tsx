import { Network, NetworkStatus } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Wifi } from 'lucide-react';

interface NetworkTableProps {
  networks: Network[];
  selectedId?: string;
  onSelect?: (network: Network) => void;
  showChannel?: boolean;
  isLoading?: boolean;
}

function StatusBadge({ status }: { status: NetworkStatus }) {
  return (
    <span className={cn(
      'status-badge',
      status === 'Safe' && 'status-safe',
      status === 'Suspicious' && 'status-suspicious',
      status === 'Rogue' && 'status-rogue',
    )}>
      {status}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence?: 'Low' | 'Medium' | 'High' }) {
  if (!confidence) return null;
  return (
    <span className={cn(
      'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight',
      confidence === 'High' ? 'bg-status-rogue/20 text-status-rogue' :
        confidence === 'Medium' ? 'bg-status-suspicious/20 text-status-suspicious' :
          'bg-status-info/20 text-status-info'
    )}>
      AI: {confidence}
    </span>
  );
}

function SkeletonRow({ showChannel }: { showChannel: boolean }) {
  return (
    <tr className="animate-pulse border-b border-border/50">
      <td className="py-4 px-4"><div className="h-4 w-24 bg-muted rounded"></div></td>
      <td className="py-4 px-4"><div className="h-4 w-32 bg-muted rounded"></div></td>
      {showChannel && <td className="py-4 px-4"><div className="h-4 w-8 bg-muted rounded"></div></td>}
      <td className="py-4 px-4"><div className="h-4 w-12 bg-muted rounded"></div></td>
      <td className="py-4 px-4"><div className="h-4 w-16 bg-muted rounded"></div></td>
      <td className="py-4 px-4"><div className="h-6 w-16 bg-muted/60 rounded-full"></div></td>
      <td className="py-4 px-4"><div className="h-4 w-40 bg-muted/40 rounded"></div></td>
    </tr>
  );
}

export function NetworkTable({ networks, selectedId, onSelect, showChannel = false, isLoading = false }: NetworkTableProps) {
  return (
    <div className="card-stat overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Network Detection</h3>
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-status-info animate-pulse">
            <div className="h-2 w-2 rounded-full bg-status-info"></div>
            Searching for active networks...
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">SSID</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">BSSID</th>
              {showChannel && (
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Channel</th>
              )}
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">RSSI</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Distance</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Encryption</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Risk Score</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[200px]">AI Insight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <>
                <SkeletonRow showChannel={showChannel} />
                <SkeletonRow showChannel={showChannel} />
                <SkeletonRow showChannel={showChannel} />
              </>
            ) : networks.length === 0 ? (
              <tr>
                <td colSpan={showChannel ? 9 : 8} className="py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Wifi className="h-8 w-8 opacity-20" />
                    <p>No active networks in range</p>
                  </div>
                </td>
              </tr>
            ) : (
              networks.map((network) => (
                <tr
                  key={network.id}
                  onClick={() => onSelect?.(network)}
                  className={cn(
                    'transition-colors cursor-pointer',
                    selectedId === network.id
                      ? 'bg-muted'
                      : 'hover:bg-muted/50'
                  )}
                >
                  <td className="py-4 px-4 text-sm font-medium">{network.ssid}</td>
                  <td className="py-4 px-4 text-sm text-muted-foreground font-mono">{network.bssid}</td>
                  {showChannel && (
                    <td className="py-4 px-4 text-sm text-muted-foreground">{network.channel}</td>
                  )}
                  <td className="py-4 px-4 text-sm text-muted-foreground">{network.rssi} dBm</td>
                  <td className="py-4 px-4 text-sm font-mono text-status-info">
                    {network.estimatedDistance ? `${network.estimatedDistance}m` : '--'}
                  </td>
                  <td className="py-4 px-4 text-sm text-muted-foreground">{network.encryption}</td>
                  <td className="py-4 px-4 text-sm">
                    <StatusBadge status={network.status} />
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-mono font-bold text-sm",
                        (network.riskScore || 0) >= 70 ? "text-status-rogue" :
                          (network.riskScore || 0) >= 40 ? "text-status-suspicious" :
                            "text-status-safe"
                      )}>
                        {network.riskScore && network.riskScore > 0 ? `${network.riskScore}%` : '-'}
                      </span>
                      <ConfidenceBadge confidence={network.confidence} />
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-col gap-1">
                      {network.explanation ? (
                        <p className="text-xs text-foreground font-medium italic opacity-90">"{network.explanation}"</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(network.reasons || []).map((reason, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                              {reason}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
