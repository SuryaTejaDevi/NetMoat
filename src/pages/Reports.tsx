import { useState, useMemo, useEffect } from 'react';
import { Download, FileText, File, X, Search, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { Network } from '@/data/mockData';
import { useWiFiEngine } from '@/hooks/useWiFiEngine';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type FilterStatus = 'All' | 'Secure' | 'At Risk';

function StatusBadge({ status }: { status: 'Secure' | 'At Risk' }) {
  return (
    <span className={cn(
      'px-3 py-1 text-xs font-medium rounded-full',
      status === 'Secure'
        ? 'bg-status-safe-bg text-status-safe border border-status-safe/20'
        : 'bg-status-rogue-bg text-status-rogue border border-status-rogue/20'
    )}>
      {status}
    </span>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const { networks: liveNetworks } = useWiFiEngine();
  const [historicalNetworks, setHistoricalNetworks] = useState<Network[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'json'>('pdf');

  // 1. Fetch Historical Data from Firestore
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, `users/${user.uid}/discovered_networks`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Handle serverTimestamp conversion
          lastSeen: data.lastSeen?.toDate?.()?.toISOString() || data.lastSeen || new Date().toISOString()
        } as Network;
      });
      setHistoricalNetworks(docs);
      setLoading(false);
    }, (err) => {
      console.error("Failed to fetch reports:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 2. Fetch Security Events from Firestore
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, `users/${user.uid}/security_events`), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().timestamp?.toDate?.() || new Date()
      }));
      setSecurityEvents(docs);
    });

    return () => unsubscribe();
  }, [user]);

  // Merge Live and Historical (Historical is source of truth for all known, Live updates RSSI/Active status)
  const allNetworks = useMemo(() => {
    const liveMap = new Map(liveNetworks.map(n => [n.bssid, n]));
    const merged = [...historicalNetworks];

    // Update historical items with live data if currently active
    const final = merged.map(h => {
      const live = liveMap.get(h.bssid);
      if (live) {
        liveMap.delete(h.bssid); // Track that we used this live entry
        return { ...h, ...live, isActive: true };
      }
      return { ...h, isActive: false };
    });

    // Add any purely new live ones not yet in history
    liveMap.forEach(l => final.push({ ...l, isActive: true }));

    return final;
  }, [liveNetworks, historicalNetworks]);

  const filteredNetworks = allNetworks.filter(network => {
    const matchesFilter = filter === 'All' ||
      (filter === 'Secure' && network.status === 'Safe') ||
      (filter === 'At Risk' && network.status !== 'Safe');
    const matchesSearch = network.ssid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      network.bssid.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const secureCount = allNetworks.filter(n => n.status === 'Safe').length;
  const atRiskCount = allNetworks.filter(n => n.status !== 'Safe').length;

  const statusData = [
    { name: 'Secure', value: secureCount, color: 'hsl(142, 71%, 45%)' },
    { name: 'At Risk', value: atRiskCount, color: 'hsl(0, 84%, 60%)' },
  ];

  // Dynamically calculate RSSI distribution from live data
  const rssiDistribution = useMemo(() => {
    const ranges = [
      { range: '-30 to -40', count: 0, min: -40, max: -30 },
      { range: '-41 to -50', count: 0, min: -50, max: -41 },
      { range: '-51 to -60', count: 0, min: -60, max: -51 },
      { range: '-61 to -70', count: 0, min: -70, max: -61 },
      { range: '-71+', count: 0, min: -100, max: -71 },
    ];

    allNetworks.forEach(n => {
      const match = ranges.find(r => n.rssi >= r.min && n.rssi <= r.max);
      if (match) match.count++;
    });

    return ranges;
  }, [allNetworks]);

  // Dynamically calculate Threat History from real events
  const threatHistoryData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        label: days[d.getDay()],
        fullDate: d.toLocaleDateString(),
        threats: 0
      };
    });

    securityEvents.forEach(event => {
      const eventDate = event.date.toLocaleDateString();
      const match = last7Days.find(d => d.fullDate === eventDate);
      if (match) match.threats++;
    });

    return last7Days;
  }, [securityEvents]);

  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const generatePDFMock = (title: string, data: any[]) => {
    // PDF generation would usually use a library like jsPDF. 
    // Emulating the experience by generating a styled TXT summary as requested.
    let content = `${title.toUpperCase()}\n`;
    content += `=".=".=".=".=".=".=".=".=".=".=".=".=".=".=".=".=".="\n`;
    content += `Date: ${new Date().toLocaleString()}\n\n`;

    data.forEach((item, i) => {
      content += `[${i + 1}] ${item.ssid || 'Unknown'} (${item.bssid})\n`;
      content += `    Classification: ${item.status}\n`;
      content += `    Signal: ${item.rssi} dBm\n`;
      content += `    Encryption: ${item.encryption || 'WPA2'}\n`;
      if (item.reasons?.length) content += `    Analysis: ${item.reasons.join('; ')}\n`;
      content += `--------------------------------------------------\n`;
    });

    return content;
  }

  // Helper to strip sensitive fields and attach owner email
  const sanitizeNetwork = (network: any, ownerEmail: string) => {
    const {
      ssid,
      bssid,
      rssi,
      status,
      encryption,
      firstSeen,
      lastSeen,
      reasons,
      riskScore,
      confidence,
      explanation,
    } = network;
    return {
      ssid,
      bssid,
      rssi,
      status,
      encryption,
      firstSeen,
      lastSeen,
      reasons,
      riskScore,
      confidence,
      explanation,
      ownerEmail,
    };
  }

  const exportData = (data: Network[], filename: string) => {
    // Sanitize data before exporting
    const sanitized = data.map((n) => sanitizeNetwork(n, user?.email || 'unknown'));
    if (exportFormat === 'csv') {
      const headers = ['SSID', 'BSSID', 'RSSI', 'Status', 'Encryption', 'First Seen', 'Last Seen', 'Security Assessment', 'Owner Email'].join(',');
      const rows = sanitized.map(n => [
        `"${n.ssid}"`,
        `"${n.bssid}"`,
        `"${n.rssi || 'N/A'} dBm"`,
        `"${n.status}"`,
        `"${n.encryption || 'WPA2'}"`,
        `"${n.firstSeen || 'N/A'}"`,
        `"${n.lastSeen || 'N/A'}"`,
        `"${(n.reasons || []).join('; ')}"`,
        `"${n.ownerEmail}"`
      ].join(','));

      const csvContent = [headers, ...rows].join('\n');
      downloadFile(csvContent, `${filename}.csv`, 'text/csv');
      toast.success(`Generated CSV: ${filename}`);
    } else if (exportFormat === 'json') {
      const jsonContent = JSON.stringify(sanitized, null, 2);
      downloadFile(jsonContent, `${filename}.json`, 'application/json');
      toast.success(`Generated JSON: ${filename}`);
    } else if (exportFormat === 'pdf') {
      const pdfContent = generatePDFMock(filename, data);
      downloadFile(pdfContent, `${filename}.pdf.txt`, 'text/plain');
      toast.success(`Generated PDF Summary: ${filename}`);
    }
  };

  const handleExportAll = () => {
    exportData(allNetworks, `NetMoat_Global_Audit_${new Date().getTime()}`);
  };

  const handleExportSingle = () => {
    if (selectedNetwork) {
      exportData([selectedNetwork], `NetMoat_Forensics_${selectedNetwork.ssid}_${new Date().getTime()}`);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h1 className="text-2xl font-bold">Reports</h1>

        <div className="flex items-center gap-3">
          <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50">
            {(['pdf', 'csv', 'json'] as const).map(fmt => (
              <button
                key={fmt}
                onClick={() => setExportFormat(fmt)}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all",
                  exportFormat === fmt
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {fmt}
              </button>
            ))}
          </div>
          <Button onClick={handleExportAll} className="gap-2">
            <Download className="h-4 w-4" />
            Export Dataset
          </Button>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Network Status */}
        <div className="card-stat">
          <h3 className="text-base font-semibold mb-4">Network Status</h3>
          <div className="flex flex-col items-center">
            <div className="relative w-36 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={55}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold">{allNetworks.length}</span>
                <span className="text-xs text-muted-foreground">Networks</span>
              </div>
            </div>
            <div className="mt-4 space-y-2 w-full">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-status-safe" />
                  <span>Secure</span>
                </div>
                <span className="font-medium">{secureCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-status-rogue" />
                  <span>At Risk</span>
                </div>
                <span className="font-medium">{atRiskCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RSSI Distribution */}
        <div className="card-stat">
          <h3 className="text-base font-semibold mb-4">RSSI Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rssiDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis
                  dataKey="range"
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {rssiDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 ? '#10b981' : index === 1 ? '#34d399' : index === 2 ? '#fbbf24' : index === 3 ? '#f87171' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground text-center mt-1">Signal Strength (dBm)</p>
          </div>
        </div>

        {/* Threat Level Timeline */}
        <div className="card-stat">
          <h3 className="text-base font-semibold mb-4">Threat Level History</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={threatHistoryData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="threats"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ fill: '#ef4444', r: 4 }}
                  activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-1">7-Day Incident Velocity</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          {(['All', 'Secure', 'At Risk'] as FilterStatus[]).map((f) => (
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
            className="pl-10"
          />
        </div>
      </div>

      {/* Networks Table */}
      <div className="card-stat overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Discovery Audit</h3>
          <div className="flex gap-2">
            <Button
              onClick={handleExportAll}
              className="gap-2 bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
              variant="outline"
              size="sm"
            >
              <Download className="h-3 w-3" />
              <span className="text-[10px] font-bold uppercase">Export {exportFormat}</span>
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">SSID</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">BSSID</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">RSSI</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredNetworks.map((network) => (
                <tr
                  key={network.id}
                  onClick={() => setSelectedNetwork(network)}
                  className={cn(
                    'transition-colors cursor-pointer',
                    selectedNetwork?.id === network.id
                      ? 'bg-muted'
                      : 'hover:bg-muted/50'
                  )}
                >
                  <td className="py-4 px-4 text-sm font-medium">{network.ssid}</td>
                  <td className="py-4 px-4 text-sm text-muted-foreground font-mono">{network.bssid}</td>
                  <td className="py-4 px-4 text-sm text-muted-foreground">{network.rssi} dBm</td>
                  <td className="py-4 px-4">
                    <StatusBadge status={network.status === 'Safe' ? 'Secure' : 'At Risk'} />
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/50">
                      {network.scanType === 'SYSTEM_PROFILE' ? 'Profile' : 'Live'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredNetworks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {loading ? 'Decrypting historical records...' : 'No networks discovered yet'}
          </div>
        )}
      </div>

      {/* Selected Network Detail Panel */}
      {selectedNetwork && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-background border-l border-border shadow-2xl z-50 p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold">Network Forensics</h2>
            <Button variant="ghost" size="icon" onClick={() => setSelectedNetwork(null)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Primary SSID</p>
                <p className="font-semibold text-lg">{selectedNetwork.ssid}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">BSSID / MAC</p>
                <p className="font-mono text-sm">{selectedNetwork.bssid}</p>
              </div>
            </div>

            <div className="h-px bg-border my-6" />

            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/40">
                <span className="text-sm text-muted-foreground">Current Signal</span>
                <span className="font-mono font-bold">{selectedNetwork.rssi} dBm</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/40">
                <span className="text-sm text-muted-foreground">Detection Type</span>
                <span className="text-xs font-bold uppercase">{selectedNetwork.scanType === 'SYSTEM_PROFILE' ? 'System Profile Discovery' : 'Live Radio Scan'}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/40">
                <span className="text-sm text-muted-foreground">Classification</span>
                <StatusBadge status={selectedNetwork.status === 'Safe' ? 'Secure' : 'At Risk'} />
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/40 border-l-4 border-status-info">
                <span className="text-sm text-status-info font-bold">Risk Score</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold">
                    {selectedNetwork.riskScore && selectedNetwork.riskScore > 0 ? `${selectedNetwork.riskScore}%` : '-'}
                  </span>
                  {selectedNetwork.confidence && selectedNetwork.confidence !== 'Low' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-status-info/20 text-status-info font-bold uppercase">
                      AI: {selectedNetwork.confidence}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {selectedNetwork.explanation && (
              <div className="mt-8 p-4 rounded-xl bg-status-info/5 border border-status-info/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10">
                  <Info className="h-12 w-12" />
                </div>
                <p className="text-xs text-status-info uppercase font-black tracking-widest mb-2">AI Intelligence Summary</p>
                <p className="text-sm text-foreground leading-relaxed italic font-medium">
                  "{selectedNetwork.explanation}"
                </p>
              </div>
            )}

            {selectedNetwork.reasons && selectedNetwork.reasons.length > 0 && (
              <div className="mt-8">
                <p className="text-xs text-muted-foreground uppercase font-bold mb-3">Security Assessment</p>
                <div className="space-y-2">
                  {selectedNetwork.reasons.map((reason, i) => (
                    <div key={i} className="flex gap-2 items-start p-3 rounded-lg border border-border bg-card">
                      <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <p className="text-sm">{reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto pt-12 pb-6">
            <Button className="w-full gap-2" variant="outline" onClick={handleExportSingle}>
              <Download className="h-4 w-4" />
              Download {exportFormat.toUpperCase()} Forensics
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
