import { useState, useEffect } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Search, Info, Radar, Power, Play, Pause, Activity, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWiFiEngine } from '@/hooks/useWiFiEngine';
import { cn } from '@/lib/utils';

export default function Scanning() {
  const { networks, isScanning, startScanning, stopScanning, scanError, scanType, lastUpdate } = useWiFiEngine();
  const [localProgress, setLocalProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'active' | 'saved'>('active');

  // Smooth progress bar representing the engine's 5s cycle
  useEffect(() => {
    if (!isScanning) {
      setLocalProgress(0);
      return;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const last = lastUpdate ? new Date(lastUpdate).getTime() : now;
      const elapsed = now - last;
      const progress = Math.min(100, (elapsed / 5000) * 100);
      setLocalProgress(progress);
    }, 100);

    return () => clearInterval(interval);
  }, [isScanning, lastUpdate]);

  const stats = {
    total: networks.length,
    active: networks.filter(n => n.isActive).length,
    saved: networks.filter(n => n.isSaved).length,
    rogue: networks.filter(n => n.status === 'Rogue').length
  };

  const displayNetworks = networks.filter(n =>
    activeTab === 'active' ? n.isActive : n.isSaved
  ).sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0) || b.rssi - a.rssi);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Network Scanning</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time hardware scanning status</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant={isScanning ? "destructive" : "default"}
            onClick={isScanning ? stopScanning : startScanning}
            className="gap-2"
          >
            {isScanning ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isScanning ? "Pause Monitoring" : "Resume Monitoring"}
          </Button>
        </div>
      </div>

      {scanError === 'ELEVATION_REQUIRED' && (
        <div className="p-4 rounded-lg bg-status-info-bg/20 border border-status-info/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <Info className="h-5 w-5 text-status-info" />
          <p className="text-sm text-foreground">
            <span className="font-semibold">Hardware Restricted:</span> Showing saved system profiles. Run as Administrator for live radio detection.
          </p>
        </div>
      )}

      {scanType === 'LIVE_HARDWARE' && (
        <div className="p-4 rounded-lg bg-status-safe-bg/20 border border-status-safe/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <Radar className="h-5 w-5 text-status-safe animate-pulse" />
          <p className="text-sm text-foreground">
            <span className="font-semibold">Active Monitoring:</span> Using high-fidelity BSSID analysis for rogue AP detection.
          </p>
        </div>
      )}

      <div className="card-stat space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-1000",
              isScanning ? "border-primary animate-spin-slow" : "border-muted"
            )}>
              {isScanning ? <Activity className="h-6 w-6 text-primary" /> : <Power className="h-6 w-6 text-muted-foreground" />}
            </div>
            <div>
              <p className="font-semibold text-lg">{isScanning ? "Monitoring in Progress..." : "Monitoring Paused"}</p>
              <p className="text-sm text-muted-foreground">
                {isScanning ? `Syncing with local engine... Detected ${stats.active} networks in range` : "Start the engine to resume scanning"}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${localProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">
            <span>Next engine sync...</span>
            <span>{Math.round(localProgress)}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-stat">
          <p className="text-xs text-muted-foreground uppercase font-bold">Total</p>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="card-stat text-status-safe">
          <p className="text-xs text-muted-foreground uppercase font-bold">In Range</p>
          <p className="text-2xl font-bold mt-1">{stats.active}</p>
        </div>
        <div className="card-stat text-status-suspicious">
          <p className="text-xs text-muted-foreground uppercase font-bold">Saved Profiles</p>
          <p className="text-2xl font-bold mt-1">{stats.saved}</p>
        </div>
        <div className="card-stat text-status-rogue">
          <p className="text-xs text-muted-foreground uppercase font-bold">Rogue Detected</p>
          <p className="text-2xl font-bold mt-1">{stats.rogue}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Detection Ingest</h3>
          <div className="flex bg-muted/30 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('active')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all",
                activeTab === 'active' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              In Range ({stats.active})
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all",
                activeTab === 'saved' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Saved ({stats.saved})
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {displayNetworks.map((network) => (
            <div key={network.id} className={cn(
              "flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-primary/20 transition-all",
              !network.isActive && "opacity-60"
            )}>
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-2.5 rounded-lg",
                  network.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {network.isActive ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{network.ssid}</p>
                    {network.isSaved && (
                      <span className="text-[9px] uppercase font-bold text-primary border border-primary/20 px-1 rounded">Saved</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{network.bssid}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Signal</p>
                  <p className={cn("font-bold", network.isActive ? "text-foreground" : "text-muted-foreground")}>
                    {network.isActive ? `${network.rssi} dBm` : 'Offline'}
                  </p>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold uppercase border",
                  network.status === 'Safe' ? "bg-status-safe-bg text-status-safe border-status-safe/20" :
                    network.status === 'Suspicious' ? "bg-status-suspicious-bg text-status-suspicious border-status-suspicious/20" :
                      "bg-status-rogue-bg text-status-rogue border-status-rogue/20"
                )}>
                  {network.status}
                </div>
              </div>
            </div>
          ))}
          {displayNetworks.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
              <Radar className="h-10 w-10 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No networks found in this category.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Square(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
    </svg>
  )
}
