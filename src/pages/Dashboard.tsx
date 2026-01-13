import { useNavigate } from 'react-router-dom';
import { Play, Square, Power, Wifi, CheckCircle, AlertTriangle, XCircle, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/StatCard';
import { NetworkTable } from '@/components/dashboard/NetworkTable';
import { NetworkCharts } from '@/components/dashboard/NetworkCharts';
import { Network } from '@/data/mockData';
import { useWiFiEngine } from '@/hooks/useWiFiEngine';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // networks is now provided globally via the hook (from Context)
  // networks is now GLOBALLY filtered to show Active-First by default
  const { networks, isScanning, startScanning, stopScanning, lastUpdate, scanError, scanType, unreadThreatCount, connectedNetwork, disconnectNetwork } = useWiFiEngine();

  // Previously we filtered here, now Context handles it for "All Pages".


  const safeCount = networks.filter(n => n.status === 'Safe').length;
  const suspiciousCount = networks.filter(n => n.status === 'Suspicious').length;
  const rogueCount = networks.filter(n => n.status === 'Rogue').length;

  // const criticalAlertCount = mockAlerts.filter(a => a.severity === 'Critical').length;

  const triggerElevation = async () => {
    try {
      const resp = await fetch('http://localhost:3001/api/elevate', { method: 'POST' });
      const data = await resp.json();
      if (data.success) {
        toast.info('Elevation Requested', { description: 'Please accept the Windows UAC prompt in your taskbar.' });
      }
    } catch (err) {
      toast.error('Bridge Failed', { description: 'Engine must be running on port 3001' });
    }
  };



  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Scanner Diagnostic Banner */}
      {isScanning && scanType === 'PROFILE_DISCOVERY' && (
        <div className="p-4 rounded-lg bg-status-info-bg/30 border border-status-info/20 flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-status-info">
              <CheckCircle className="h-5 w-5" />
              <h3 className="font-semibold text-foreground">Limited Hardware Visibility</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-7">
              Automatic scan active. Currently discovering known system profiles. To detect live "Evil Twin" attacks and signal variance, please enable hardware access.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={triggerElevation}
            className="shrink-0 border-status-info/30 hover:bg-status-info/10 text-status-info"
          >
            Enable Live Scan (UAC)
          </Button>
        </div>
      )}

      {/* Critical System Error (e.g. Engine Offline) */}
      {scanError && !scanType && (
        <div className="p-4 rounded-lg bg-status-rogue/10 border border-status-rogue/20 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-status-rogue" />
          <p className="text-sm font-medium text-status-rogue">{scanError}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">NetMoat – Rogue Wi-Fi Detection</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">Monitoring:</span>
            <span className="text-xs text-muted-foreground ml-1">
              Nearby
            </span>
            <span className={cn(
              'text-sm font-medium px-2 py-0.5 rounded',
              isScanning
                ? 'bg-status-info-bg text-status-info animate-pulse-slow'
                : 'bg-muted text-muted-foreground'
            )}>
              {isScanning ? 'Active' : 'Paused'}
            </span>
            {lastUpdate && (
              <span className="text-xs text-muted-foreground/60 ml-2">
                Last Ingest: {new Date(lastUpdate).toLocaleTimeString()}
              </span>
            )}
            {user && <span className="text-xs text-muted-foreground/40 ml-2">UID: {user.uid.slice(0, 6)}...</span>}
          </div>
        </div>



        <div className="flex items-center gap-2">
          {/* Alert Bell */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/alerts')}
            className="relative"
          >
            <Bell className="h-4 w-4" />
            {unreadThreatCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-status-rogue text-[10px] font-bold text-white flex items-center justify-center">
                {unreadThreatCount}
              </span>
            )}
          </Button>

          <Button
            onClick={startScanning}
            disabled={isScanning}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            Start Monitor
          </Button>
          <Button
            variant="outline"
            onClick={stopScanning}
            disabled={!isScanning}
            className="gap-2"
          >
            <Square className="h-4 w-4" />
            Pause
          </Button>
        </div>
      </div>

      {/* Connected Network Banner (Mandatory) */}
      <div className="p-4 rounded-lg bg-background border border-border shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-full", connectedNetwork ? "bg-status-safe-bg text-status-safe" : "bg-muted text-muted-foreground")}>
            <Wifi className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Connected Network</h3>
            <p className="text-lg font-bold text-foreground">
              {connectedNetwork ? connectedNetwork.ssid : "Not Connected"}
            </p>
            {connectedNetwork && (
              <span className="text-xs text-muted-foreground">{connectedNetwork.bssid} • {connectedNetwork.signal}% Signal</span>
            )}
          </div>
        </div>

        {connectedNetwork && (
          <Button
            variant="destructive"
            size="sm"
            onClick={disconnectNetwork}
            className="gap-2"
          >
            <Power className="h-4 w-4" />
            Disconnect
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Networks"
          value={networks.length}
          subtitle="Detected networks"
          icon={Wifi}
        />
        <StatCard
          title="Safe"
          value={safeCount}
          subtitle="Verified secure"
          icon={CheckCircle}
          variant="safe"
        />
        <StatCard
          title="Suspicious"
          value={suspiciousCount}
          subtitle="Requires attention"
          icon={AlertTriangle}
          variant="suspicious"
        />
        <StatCard
          title="Rogue"
          value={rogueCount}
          subtitle="Critical threat"
          icon={XCircle}
          variant="rogue"
        />
      </div>

      {/* Charts first, then table */}
      {networks.length > 0 && <NetworkCharts networks={networks} />}

      {/* Network Table with Loading State */}
      <NetworkTable
        networks={networks}
        isLoading={isScanning && networks.length === 0}
      />
    </div >
  );
}
