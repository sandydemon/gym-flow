import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, subMonths, endOfMonth } from 'date-fns';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';

const COLORS_3D = [
  { main: 'hsl(166, 76%, 58%)', shadow: 'hsl(166, 76%, 38%)' },
  { main: 'hsl(200, 80%, 60%)', shadow: 'hsl(200, 80%, 40%)' },
  { main: 'hsl(270, 60%, 65%)', shadow: 'hsl(270, 60%, 45%)' },
  { main: 'hsl(38, 92%, 50%)', shadow: 'hsl(38, 92%, 35%)' },
  { main: 'hsl(0, 72%, 50%)', shadow: 'hsl(0, 72%, 35%)' },
  { main: 'hsl(120, 60%, 50%)', shadow: 'hsl(120, 60%, 35%)' },
];

interface ChartData {
  feeCollection: { name: string; collected: number; pending: number }[];
  expenseBreakdown: { name: string; value: number }[];
  attendanceTrend: { name: string; count: number }[];
  staffOverview: { name: string; value: number }[];
}

export default function DashboardCharts() {
  const { user } = useAuth();
  const [data, setData] = useState<ChartData>({
    feeCollection: [],
    expenseBreakdown: [],
    attendanceTrend: [],
    staffOverview: [],
  });

  useEffect(() => {
    if (user) fetchChartData();
  }, [user]);

  const fetchChartData = async () => {
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      months.push(format(subMonths(now, i), 'yyyy-MM'));
    }

    // Fee collection per month
    const { data: fees } = await supabase
      .from('monthly_fees')
      .select('month, amount, status')
      .eq('user_id', user!.id)
      .in('month', months);

    const feeCollection = months.map(m => {
      const monthFees = fees?.filter(f => f.month === m) || [];
      return {
        name: format(new Date(m + '-01'), 'MMM'),
        collected: monthFees.filter(f => f.status === 'Paid').reduce((s, f) => s + Number(f.amount), 0),
        pending: monthFees.filter(f => f.status === 'Pending').reduce((s, f) => s + Number(f.amount), 0),
      };
    });

    // Expense breakdown
    const currentMonth = format(now, 'yyyy-MM');
    const { data: expenses } = await supabase
      .from('expenses')
      .select('category, amount')
      .eq('user_id', user!.id)
      .gte('expense_date', currentMonth + '-01')
      .lte('expense_date', format(endOfMonth(now), 'yyyy-MM-dd'));

    const expMap = new Map<string, number>();
    expenses?.forEach(e => expMap.set(e.category, (expMap.get(e.category) || 0) + Number(e.amount)));
    const expenseBreakdown = Array.from(expMap.entries()).map(([name, value]) => ({ name, value }));

    // Attendance trend (last 7 days)
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(format(d, 'yyyy-MM-dd'));
    }
    const { data: attendance } = await supabase
      .from('attendance')
      .select('attendance_date')
      .eq('user_id', user!.id)
      .in('attendance_date', days);

    const attendanceTrend = days.map(d => ({
      name: format(new Date(d), 'EEE'),
      count: attendance?.filter(a => a.attendance_date === d).length || 0,
    }));

    // Staff overview
    const { data: staff } = await supabase
      .from('staff')
      .select('role, is_active')
      .eq('user_id', user!.id);

    const roleMap = new Map<string, number>();
    staff?.filter(s => s.is_active).forEach(s => roleMap.set(s.role, (roleMap.get(s.role) || 0) + 1));
    const staffOverview = Array.from(roleMap.entries()).map(([name, value]) => ({ name, value }));

    setData({ feeCollection, expenseBreakdown, attendanceTrend, staffOverview });
  };

  const renderCustom3DBar = (props: any) => {
    const { x, y, width, height, fill } = props;
    if (!height || height <= 0) return null;
    const depth = 8;
    return (
      <g>
        <defs>
          <linearGradient id={`bar3d-${x}-${y}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity={1} />
            <stop offset="100%" stopColor={fill} stopOpacity={0.6} />
          </linearGradient>
        </defs>
        {/* Side face */}
        <path
          d={`M${x + width},${y} L${x + width + depth},${y - depth} L${x + width + depth},${y + height - depth} L${x + width},${y + height} Z`}
          fill={fill}
          opacity={0.5}
        />
        {/* Top face */}
        <path
          d={`M${x},${y} L${x + depth},${y - depth} L${x + width + depth},${y - depth} L${x + width},${y} Z`}
          fill={fill}
          opacity={0.7}
        />
        {/* Front face */}
        <rect x={x} y={y} width={width} height={height} fill={`url(#bar3d-${x}-${y})`} rx={2} />
      </g>
    );
  };

  const render3DPieCell = (cx: number, cy: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number, color: string, shadowColor: string) => {
    return (
      <>
        <Pie
          data={[{ value: 1 }]}
          cx={cx}
          cy={cy + 8}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          dataKey="value"
        >
          <Cell fill={shadowColor} />
        </Pie>
      </>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-xs" style={{ color: p.color || p.fill }}>
            {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </p>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs font-semibold" style={{ color: payload[0].payload.fill || COLORS_3D[0].main }}>
          {payload[0].name}: PKR {payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Fee Collection - 3D Bar Chart */}
      <Card className="glass-card overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(166,76%,58%)] to-[hsl(200,80%,60%)]" />
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Fee Collection (6 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.feeCollection} margin={{ top: 15, right: 15, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 11 }} axisLine={false} />
                <YAxis tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 11 }} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="collected" name="Collected" fill="hsl(166, 76%, 58%)" shape={renderCustom3DBar} />
                <Bar dataKey="pending" name="Pending" fill="hsl(38, 92%, 50%)" shape={renderCustom3DBar} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Expense Breakdown - 3D Donut */}
      <Card className="glass-card overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(270,60%,65%)] to-[hsl(38,92%,50%)]" />
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Expense Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            {data.expenseBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  {/* Shadow layer for 3D effect */}
                  <Pie
                    data={data.expenseBreakdown}
                    cx="50%"
                    cy="55%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.expenseBreakdown.map((_, i) => (
                      <Cell key={`shadow-${i}`} fill={COLORS_3D[i % COLORS_3D.length].shadow} />
                    ))}
                  </Pie>
                  {/* Main layer */}
                  <Pie
                    data={data.expenseBreakdown}
                    cx="50%"
                    cy="52%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    stroke="none"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {data.expenseBreakdown.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={COLORS_3D[i % COLORS_3D.length].main} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No expenses this month
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Attendance Trend - 3D Area Chart */}
      <Card className="glass-card overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(200,80%,60%)] to-[hsl(166,76%,58%)]" />
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Attendance (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.attendanceTrend} margin={{ top: 15, right: 15, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="attendanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(166, 76%, 58%)" stopOpacity={0.6} />
                    <stop offset="50%" stopColor="hsl(200, 80%, 60%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(270, 60%, 65%)" stopOpacity={0.05} />
                  </linearGradient>
                  <filter id="shadow3d">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="hsl(166, 76%, 58%)" floodOpacity="0.3" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 11 }} axisLine={false} />
                <YAxis tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 11 }} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Attendance"
                  stroke="hsl(166, 76%, 58%)"
                  strokeWidth={3}
                  fill="url(#attendanceGrad)"
                  filter="url(#shadow3d)"
                  dot={{ r: 5, fill: 'hsl(166, 76%, 58%)', stroke: 'hsl(220, 20%, 10%)', strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: 'hsl(166, 76%, 68%)', stroke: 'hsl(166, 76%, 58%)', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Staff Overview - 3D Donut */}
      <Card className="glass-card overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(38,92%,50%)] to-[hsl(0,72%,50%)]" />
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Staff by Role</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            {data.staffOverview.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  {/* Shadow layer */}
                  <Pie
                    data={data.staffOverview}
                    cx="50%"
                    cy="55%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.staffOverview.map((_, i) => (
                      <Cell key={`shadow-${i}`} fill={COLORS_3D[i % COLORS_3D.length].shadow} />
                    ))}
                  </Pie>
                  {/* Main layer */}
                  <Pie
                    data={data.staffOverview}
                    cx="50%"
                    cy="52%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    stroke="none"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {data.staffOverview.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={COLORS_3D[i % COLORS_3D.length].main} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No active staff
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
