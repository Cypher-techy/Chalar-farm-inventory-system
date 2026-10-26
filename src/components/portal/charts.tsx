'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const PALETTE = ['#2b6f4a', '#3d8b5f', '#62a87f', '#94c7a8', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ef4444'];

interface XY {
  name: string;
  value: number;
  [k: string]: string | number;
}

function ChartFrame({ height = 260, children }: { height?: number; children: React.ReactElement }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid #e7e5e4',
  fontSize: 12,
  boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
};

export function SimpleBarChart({ data, dataKey = 'value', height = 260 }: { data: XY[]; dataKey?: string; height?: number }) {
  return (
    <ChartFrame height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#78716c' }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: '#78716c' }} width={48} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(43,111,74,0.06)' }} />
        <Bar dataKey={dataKey} fill="#2b6f4a" radius={[4, 4, 0, 0]} animationDuration={700} />
      </BarChart>
    </ChartFrame>
  );
}

export function SimpleLineChart({ data, dataKey = 'value', height = 260 }: { data: XY[]; dataKey?: string; height?: number }) {
  return (
    <ChartFrame height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#78716c' }} />
        <YAxis tick={{ fontSize: 11, fill: '#78716c' }} width={48} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey={dataKey} stroke="#2b6f4a" strokeWidth={2.5} dot={{ r: 3 }} animationDuration={800} />
      </LineChart>
    </ChartFrame>
  );
}

export function StackedBarChart({
  data,
  keys,
  height = 280,
}: {
  data: XY[];
  keys: string[];
  height?: number;
}) {
  return (
    <ChartFrame height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#78716c' }} />
        <YAxis tick={{ fontSize: 11, fill: '#78716c' }} width={48} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} stackId="a" fill={PALETTE[i % PALETTE.length]} radius={i === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} animationDuration={700} />
        ))}
      </BarChart>
    </ChartFrame>
  );
}

export function DonutChart({ data, height = 240 }: { data: XY[]; height?: number }) {
  return (
    <ChartFrame height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={2} animationDuration={700}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ChartFrame>
  );
}
