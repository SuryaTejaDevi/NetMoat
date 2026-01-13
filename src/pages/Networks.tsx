import { useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Search, Info, Wifi, WifiOff } from 'lucide-react';
import { Network } from '@/data/mockData';
import { useWiFiEngine } from '@/hooks/useWiFiEngine';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

type FilterType = 'All' | 'Safe' | 'Suspicious' | 'Rogue' | 'Active' | 'Saved';

export default function Networks() {
  const { networks, scanError, scanType, isScanning } = useWiFiEngine();
  const [filter, setFilter] = useState<FilterType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);

  const filteredNetworks = networks.filter(network => {
    const matchesSearch = network.ssid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      network.bssid.toLowerCase().includes(searchQuery.toLowerCase());

    if (filter === 'All') return matchesSearch;
    if (filter === 'Active') return network.isActive && matchesSearch;
    if (filter === 'Saved') return network.isSaved && matchesSearch;
    return network.status === filter && matchesSearch;
  });

  const stats = {
    total: networks.length,
    active: networks.filter(n => n.isActive).length,
    safe: networks.filter(n => n.status === 'Safe').length,
    suspicious: networks.filter(n => n.status === 'Suspicious').length,
    rogue: networks.filter(n => n.status === 'Rogue').length,
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Networks</h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage detected networks</p>
        </div>
      </div>

      {scanError === 'ELEVATION_REQUIRED' && (
        <div className="p-4 rounded-lg bg-status-suspicious-bg/20 border border-status-suspicious/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <Info className="h-5 w-5 text-status-suspicious" />
          <p className="text-sm text-foreground">
            <span className="font-semibold">Hardware Restricted:</span> Showing saved system profiles. Run as Administrator for live radio detection.
          </p>
        </div>
      )}

      {scanType === 'LIVE_HARDWARE' && (
        <div className="p-4 rounded-lg bg-status-safe-bg/20 border border-status-safe/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <ShieldCheck className="h-5 w-5 text-status-safe" />
          <p className="text-sm text-foreground">
            <span className="font-semibold">Live Mode Active:</span> Real-time hardware scanning enabled (BSSID level forensics).
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-stat">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Networks</p>
              <p className="text-3xl font-bold mt-1">{stats.total}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted">
              <Wifi className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>
        <div className="card-stat">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">In Range (Active)</p>
              <p className="text-3xl font-bold text-status-safe mt-1">{stats.active}</p>
            </div>
            <div className="p-2 rounded-lg text-status-safe">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="card-stat text-status-suspicious">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Suspicious</p>
              <p className="text-3xl font-bold mt-1">{stats.suspicious}</p>
            </div>
            <div className="p-2 rounded-lg">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="card-stat text-status-rogue">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Rogue APs</p>
              <p className="text-3xl font-bold mt-1">{stats.rogue}</p>
            </div>
            <div className="p-2 rounded-lg">
              <Shield className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {(['All', 'Active', 'Saved', 'Safe', 'Suspicious', 'Rogue'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'filter-button',
                filter === f ? 'filter-button-active' : 'filter-button-inactive'
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search networks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
      </div>

      <div className="card-stat overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">SSID</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">BSSID</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Signal</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredNetworks.map((network) => (
                <tr
                  key={network.id}
                  onClick={() => setSelectedNetwork(network)}
                  className={cn(
                    "hover:bg-muted/30 transition-colors cursor-pointer",
                    selectedNetwork?.id === network.id && "bg-muted/50"
                  )}
                >
                  <td className="py-4 px-4 text-sm font-medium">{network.ssid}</td>
                  <td className="py-4 px-4 text-sm text-muted-foreground font-mono">{network.bssid}</td>
                  <td className="py-4 px-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            network.isActive ? "bg-primary" : "bg-muted-foreground/30"
                          )}
                          style={{ width: `${Math.max(0, 100 + network.rssi)}%` }}
                        />
                      </div>
                      <span className="text-xs">{network.isActive ? `${network.rssi} dBm` : '---'}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={cn(
                      'status-badge',
                      network.status === 'Safe' && 'status-safe',
                      network.status === 'Suspicious' && 'status-suspicious',
                      network.status === 'Rogue' && 'status-rogue'
                    )}>
                      {network.status}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      {network.isActive ? (
                        <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-status-safe bg-status-safe-bg px-2 py-0.5 rounded">
                          <Wifi className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          <WifiOff className="h-3 w-3" /> Offline
                        </span>
                      )}
                      {network.isSaved && (
                        <span className="text-[10px] uppercase font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          Saved
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredNetworks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {isScanning ? 'Synchronizing with engine...' : 'No networks found'}
          </div>
        )}
      </div>
    </div>
  );
}
