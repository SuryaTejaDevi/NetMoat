import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { Network, rssiDistributionData, threatTrendData } from '@/data/mockData';

interface NetworkChartsProps {
  networks: Network[];
}

export function NetworkCharts({ networks }: NetworkChartsProps) {
  const safeCount = networks.filter(n => n.status === 'Safe').length;
  const suspiciousCount = networks.filter(n => n.status === 'Suspicious').length;
  const rogueCount = networks.filter(n => n.status === 'Rogue').length;
  const total = networks.length;

  const statusData = [
    { name: 'Safe', value: safeCount, color: 'hsl(142, 76%, 36%)' },
    { name: 'Suspicious', value: suspiciousCount, color: 'hsl(38, 92%, 50%)' },
    { name: 'Rogue', value: rogueCount, color: 'hsl(0, 84%, 60%)' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Network Status Distribution */}
      <div className="card-stat">
        <h3 className="text-base font-semibold mb-4">Network Status Distribution</h3>
        <div className="flex flex-col items-center">
          <div className="relative w-44 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
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
              <span className="text-2xl font-bold">{total}</span>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
          </div>
          <div className="mt-4 space-y-2 w-full">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-status-safe" />
                <span>Safe</span>
              </div>
              <span className="font-medium">{safeCount} ({Math.round(safeCount / total * 100)}%)</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-status-suspicious" />
                <span>Suspicious</span>
              </div>
              <span className="font-medium">{suspiciousCount} ({Math.round(suspiciousCount / total * 100)}%)</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-status-rogue" />
                <span>Rogue</span>
              </div>
              <span className="font-medium">{rogueCount} ({Math.round(rogueCount / total * 100)}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* RSSI Distribution */}
      <div className="card-stat">
        <h3 className="text-base font-semibold mb-4">RSSI Distribution</h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { range: '-30 to -40', count: networks.filter(n => n.rssi >= -40).length },
                { range: '-41 to -50', count: networks.filter(n => n.rssi >= -50 && n.rssi < -40).length },
                { range: '-51 to -60', count: networks.filter(n => n.rssi >= -60 && n.rssi < -50).length },
                { range: '-61 to -70', count: networks.filter(n => n.rssi >= -70 && n.rssi < -60).length },
                { range: '-71+', count: networks.filter(n => n.rssi < -70).length },
              ]}
              margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
            >
              <XAxis
                dataKey="range"
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
              <Bar dataKey="count" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Threat Trend */}
      <div className="card-stat">
        <h3 className="text-base font-semibold mb-4">Threat Trend (Last 7 Days)</h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={threatTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <XAxis
                dataKey="day"
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
              <Bar dataKey="threats" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
