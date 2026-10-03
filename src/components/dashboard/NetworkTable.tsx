import { useState, useMemo } from 'react';
import { Network, NetworkStatus } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Wifi, Search, X } from 'lucide-react';

interface NetworkTableProps {
  networks: Network[];
  selectedId?: string;
  onSelect?: (network: Network) => void;
  onBlock?: (network: Network) => void;
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

export function NetworkTable({ networks, selectedId, onSelect, onBlock, showChannel = false, isLoading = false }: NetworkTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNetworks = useMemo(() => {
    if (!searchQuery.trim()) return networks;
    const query = searchQuery.toLowerCase();
    return networks.filter(n =>
      (n.ssid || '').toLowerCase().includes(query) ||
      (n.bssid || '').toLowerCase().includes(query)
    );
  }, [networks, searchQuery]);

  return (
    <div className="card-stat overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold">Network Detection</h3>
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-status-info animate-pulse mt-1">
              <div className="h-2 w-2 rounded-full bg-status-info"></div>
              Searching for active networks...
            </div>
          )}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search SSID or BSSID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-muted/50 border border-border rounded-md pl-10 pr-10 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-status-info/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
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
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Dist (m)</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Encryption</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Security Details</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Risk Score</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[200px]">AI Insight</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <>
                <SkeletonRow showChannel={showChannel} />
                <SkeletonRow showChannel={showChannel} />
                <SkeletonRow showChannel={showChannel} />
              </>
            ) : filteredNetworks.length === 0 ? (
              <tr>
                <td colSpan={showChannel ? 9 : 8} className="py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Wifi className="h-8 w-8 opacity-20" />
                    <p>{searchQuery ? 'No matching networks found' : 'No active networks in range'}</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredNetworks.map((network) => (
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
                  <td className="py-3 px-4 text-sm font-medium">{network.rssi} dBm</td>
                  <td className="py-3 px-4 text-sm">{network.estimatedDistance || '---'}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{network.encryption}</td>
                  <td className="py-3 px-4 text-xs italic text-muted-foreground max-w-[200px] truncate">
                    {network.reasons?.join(', ') || 'None'}
                  </td>
                  <td className="py-3 px-4 text-sm">
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
                  <td className="py-4 px-4 text-right">
                    {onBlock && network.status !== 'Safe' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onBlock(network);
                        }}
                        className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 px-3 py-1.5 rounded-md font-medium transition-colors"
                      >
                        Block
                      </button>
                    )}
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
