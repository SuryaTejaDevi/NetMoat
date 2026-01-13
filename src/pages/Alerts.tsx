import { useState, useEffect } from 'react';
import { Download, Info, AlertTriangle, XCircle, Wifi, TrendingUp, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mockAlerts, mockRogueAPHistory, Alert, AlertSeverity, AlertStatus } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useWiFiEngine } from '@/hooks/useWiFiEngine';

type FilterType = 'All' | AlertSeverity;

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <span className={cn(
      'status-badge',
      severity === 'Info' && 'status-info',
      severity === 'Warning' && 'status-suspicious',
      severity === 'Critical' && 'status-rogue',
    )}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: AlertStatus }) {
  return (
    <span className={cn(
      'px-2 py-1 text-xs font-medium rounded border',
      status === 'Investigating' && 'bg-status-suspicious-bg text-status-suspicious border-status-suspicious/20',
      status === 'Resolved' && 'bg-status-safe-bg text-status-safe border-status-safe/20',
      status === 'Blocked' && 'bg-status-rogue-bg text-status-rogue border-status-rogue/20',
      status === 'Monitoring' && 'bg-status-info-bg text-status-info border-status-info/20',
      status === 'Pending' && 'bg-muted text-muted-foreground border-border',
      status === 'Completed' && 'bg-status-safe-bg text-status-safe border-status-safe/20',
    )}>
      {status}
    </span>
  );
}

export default function Alerts() {
  const { networks, isScanning, markAllThreatsAsViewed } = useWiFiEngine();
  const [filter, setFilter] = useState<FilterType>('All');

  // Mark alerts as view when page opens
  useEffect(() => {
    markAllThreatsAsViewed();
  }, [markAllThreatsAsViewed]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);

  // Derive alerts from real-time networks
  // In a real app, we'd query an 'events' collection. For now, we show active threats.
  const activeAlerts: Alert[] = networks
    .filter(n => n.status !== 'Safe')
    .flatMap((n, idx) => {
      // Create an alert for each reason, or one per network
      const reasons = n.reasons || ['Unknown anomalies detected'];
      return reasons.map((reason, rIdx) => ({
        id: `alert-${n.bssid}-${idx}-${rIdx}`,
        timestamp: new Date().toLocaleTimeString(), // In a real event system, this would be the detection time
        alertType: n.status === 'Rogue' ? 'Security Breach' : 'Policy Violation',
        severity: n.status === 'Rogue' ? 'Critical' : 'Warning',
        description: `${n.ssid} (${n.bssid}): ${reason}`,
        status: 'Investigating', // Default status for new live alerts
        location: 'Unknown' // Scanner doesn't provide location yet
      } as Alert));
    });

  // If scanning is active but no threats, we can show info logs? 
  // Or just mix in some system logs if we had them. 
  // For now let's just use the active threats as the "Alerts".

  const displayAlerts = activeAlerts.length > 0 ? activeAlerts : [];

  const filteredAlerts = displayAlerts.filter(alert => {
    const matchesFilter = filter === 'All' || alert.severity === filter;
    const matchesSearch = alert.alertType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const infoCount = displayAlerts.filter(a => a.severity === 'Info').length;
  const warningCount = displayAlerts.filter(a => a.severity === 'Warning').length;
  const criticalCount = displayAlerts.filter(a => a.severity === 'Critical').length;

  const exportLogs = () => {
    const logContent = filteredAlerts.map(a =>
      `[${a.timestamp}] ${a.severity.toUpperCase()}: ${a.alertType} - ${a.description} (Status: ${a.status})`
    ).join('\n');

    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `security_alerts_${new Date().getTime()}.log`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('Security logs downloaded successfully');
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Alerts & Logs</h1>
          {isScanning && <p className="text-xs text-green-600 animate-pulse mt-1">● Live Monitoring Active</p>}
        </div>

        <Button onClick={exportLogs} className="gap-2" disabled={filteredAlerts.length === 0}>
          <Download className="h-4 w-4" />
          Export Logs
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-stat">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Info Alerts</p>
              <p className="text-3xl font-bold mt-1">{infoCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Active Session</p>
            </div>
            <div className="p-2 rounded-lg text-muted-foreground">
              <Info className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="card-stat">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Warning Alerts</p>
              <p className="text-3xl font-bold text-status-suspicious mt-1">{warningCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Active Session</p>
            </div>
            <div className="p-2 rounded-lg text-status-suspicious">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="card-stat">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Critical Alerts</p>
              <p className="text-3xl font-bold text-status-rogue mt-1">{criticalCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Active Session</p>
            </div>
            <div className="p-2 rounded-lg text-status-rogue">
              <XCircle className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts Table */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex gap-2">
              {(['All', 'Info', 'Warning', 'Critical'] as FilterType[]).map((f) => (
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
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Table */}
          <div className="card-stat overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Timestamp</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Alert Type</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Severity</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAlerts.length > 0 ? (
                    filteredAlerts.map((alert) => (
                      <tr
                        key={alert.id}
                        onClick={() => setSelectedAlert(alert.id)}
                        className={cn(
                          'transition-colors cursor-pointer',
                          selectedAlert === alert.id
                            ? 'bg-muted'
                            : 'hover:bg-muted/50'
                        )}
                      >
                        <td className="py-4 px-4 text-sm font-mono text-muted-foreground whitespace-nowrap">{alert.timestamp}</td>
                        <td className="py-4 px-4 text-sm font-medium">{alert.alertType}</td>
                        <td className="py-4 px-4">
                          <SeverityBadge severity={alert.severity} />
                        </td>
                        <td className="py-4 px-4 text-sm text-muted-foreground max-w-xs">{alert.description}</td>
                        <td className="py-4 px-4">
                          <StatusBadge status={alert.status} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-muted-foreground">
                        {networks.length > 0 ? "No active threats detected in current session" : "Scanning for threats..."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Helper Info */}
          <div className="card-stat bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/50">
            <h3 className="text-base font-semibold mb-2 text-blue-700 dark:text-blue-400">Live Monitor</h3>
            <p className="text-sm text-muted-foreground">
              Alerts are generated in real-time from the active Wi-Fi scan session.
              Any network classified as <strong>Rogue</strong> or <strong>Suspicious</strong> will appear here immediately.
            </p>
          </div>

          {/* Rogue AP History */}
          <div className="card-stat">
            <h3 className="text-base font-semibold mb-4">Detected Threats</h3>
            <div className="space-y-4">
              {filteredAlerts.filter(a => a.severity === 'Critical').slice(0, 5).map((alert) => (
                <div key={alert.id} className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-status-rogue-bg text-status-rogue">
                    <Wifi className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Critical Threat</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{alert.description}</p>
                    <p className="text-xs text-muted-foreground">{alert.timestamp}</p>
                  </div>
                </div>
              ))}
              {filteredAlerts.filter(a => a.severity === 'Critical').length === 0 && (
                <p className="text-sm text-muted-foreground">No critical threats currently active.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
