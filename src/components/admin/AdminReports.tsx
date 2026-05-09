import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { BarChart3, TrendingUp, TrendingDown, Building2, DollarSign, Users, Download } from 'lucide-react';
import { format, subMonths, startOfMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MonthlyData {
  month: string;
  label: string;
  collected: number;
  pending: number;
}

interface GymPerformance {
  gym_name: string;
  total_paid: number;
  total_pending: number;
  months_paid: number;
  months_pending: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function AdminReports() {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [gymPerformance, setGymPerformance] = useState<GymPerformance[]>([]);
  const [totalGyms, setTotalGyms] = useState(0);
  const [activeGyms, setActiveGyms] = useState(0);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [timeRange, setTimeRange] = useState('6');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadReportData();
  }, [timeRange]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const months = parseInt(timeRange);
      const monthKeys: string[] = [];
      for (let i = 0; i < months; i++) {
        monthKeys.push(format(subMonths(startOfMonth(new Date()), i), 'yyyy-MM'));
      }

      const [gymsRes, feesRes] = await Promise.all([
        supabase.from('gyms').select('id, gym_name, is_active'),
        supabase.from('gym_fees').select('gym_id, month, amount, status, gyms(gym_name)').in('month', monthKeys),
      ]);

      // Gyms stats
      const gyms = gymsRes.data || [];
      setTotalGyms(gyms.length);
      setActiveGyms(gyms.filter(g => g.is_active).length);

      // Monthly breakdown
      const fees = feesRes.data || [];
      const monthMap: Record<string, { collected: number; pending: number }> = {};
      monthKeys.forEach(m => { monthMap[m] = { collected: 0, pending: 0 }; });

      let allCollected = 0;
      let allPending = 0;

      fees.forEach((fee: any) => {
        const amt = Number(fee.amount);
        if (fee.status === 'Paid') {
          allCollected += amt;
          if (monthMap[fee.month]) monthMap[fee.month].collected += amt;
        } else {
          allPending += amt;
          if (monthMap[fee.month]) monthMap[fee.month].pending += amt;
        }
      });

      setTotalCollected(allCollected);
      setTotalPending(allPending);

      const monthly = monthKeys.reverse().map(m => ({
        month: m,
        label: format(new Date(m + '-01'), 'MMM yy'),
        collected: monthMap[m].collected,
        pending: monthMap[m].pending,
      }));
      setMonthlyData(monthly);

      // Gym performance
      const gymMap: Record<string, GymPerformance> = {};
      fees.forEach((fee: any) => {
        const name = fee.gyms?.gym_name || 'Unknown';
        if (!gymMap[name]) {
          gymMap[name] = { gym_name: name, total_paid: 0, total_pending: 0, months_paid: 0, months_pending: 0 };
        }
        if (fee.status === 'Paid') {
          gymMap[name].total_paid += Number(fee.amount);
          gymMap[name].months_paid += 1;
        } else {
          gymMap[name].total_pending += Number(fee.amount);
          gymMap[name].months_pending += 1;
        }
      });
      setGymPerformance(Object.values(gymMap).sort((a, b) => b.total_paid - a.total_paid));

    } catch (error) {
      console.error('Error loading report data:', error);
      toast({ title: "Error", description: "Failed to load report data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('GymFlow Admin Report', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${format(new Date(), 'PPpp')}`, 14, 28);
    doc.text(`Period: Last ${timeRange} months`, 14, 34);

    // Summary
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Summary', 14, 46);
    autoTable(doc, {
      startY: 50,
      head: [['Metric', 'Value']],
      body: [
        ['Total Gyms', totalGyms.toString()],
        ['Active Gyms', activeGyms.toString()],
        ['Total Collected', `PKR ${totalCollected.toLocaleString()}`],
        ['Total Pending', `PKR ${totalPending.toLocaleString()}`],
        ['Collection Rate', `${totalCollected + totalPending > 0 ? ((totalCollected / (totalCollected + totalPending)) * 100).toFixed(1) : 0}%`],
      ],
      theme: 'striped',
    });

    // Monthly breakdown
    const finalY1 = (doc as any).lastAutoTable?.finalY || 90;
    doc.setFontSize(14);
    doc.text('Monthly Breakdown', 14, finalY1 + 12);
    autoTable(doc, {
      startY: finalY1 + 16,
      head: [['Month', 'Collected', 'Pending', 'Total']],
      body: monthlyData.map(m => [
        m.label,
        `PKR ${m.collected.toLocaleString()}`,
        `PKR ${m.pending.toLocaleString()}`,
        `PKR ${(m.collected + m.pending).toLocaleString()}`,
      ]),
      theme: 'striped',
    });

    // Gym performance
    const finalY2 = (doc as any).lastAutoTable?.finalY || 150;
    if (finalY2 > 240) doc.addPage();
    const startY3 = finalY2 > 240 ? 20 : finalY2 + 12;
    doc.setFontSize(14);
    doc.text('Gym Performance', 14, startY3);
    autoTable(doc, {
      startY: startY3 + 4,
      head: [['Gym', 'Paid', 'Pending', 'Months Paid', 'Months Pending']],
      body: gymPerformance.map(g => [
        g.gym_name,
        `PKR ${g.total_paid.toLocaleString()}`,
        `PKR ${g.total_pending.toLocaleString()}`,
        g.months_paid.toString(),
        g.months_pending.toString(),
      ]),
      theme: 'striped',
    });

    doc.save(`admin-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({ title: "Downloaded", description: "Report PDF has been downloaded" });
  };

  const collectionRate = totalCollected + totalPending > 0 
    ? ((totalCollected / (totalCollected + totalPending)) * 100).toFixed(1) 
    : '0';

  const pieData = [
    { name: 'Collected', value: totalCollected },
    { name: 'Pending', value: totalPending },
  ].filter(d => d.value > 0);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading reports...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Admin Reports
          </h2>
          <p className="text-muted-foreground text-sm">Financial overview and gym performance analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Last 3 Months</SelectItem>
              <SelectItem value="6">Last 6 Months</SelectItem>
              <SelectItem value="12">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={downloadPDF} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Building2 className="w-4 h-4" /> Gyms
            </div>
            <p className="text-2xl font-bold">{totalGyms}</p>
            <p className="text-xs text-muted-foreground">{activeGyms} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4 text-primary" /> Collected
            </div>
            <p className="text-2xl font-bold text-primary">PKR {totalCollected.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingDown className="w-4 h-4 text-destructive" /> Pending
            </div>
            <p className="text-2xl font-bold text-destructive">PKR {totalPending.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="w-4 h-4" /> Collection Rate
            </div>
            <p className="text-2xl font-bold">{collectionRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly Collection</CardTitle>
            <CardDescription>Collected vs Pending fees per month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [`PKR ${value.toLocaleString()}`, '']}
                  />
                  <Legend />
                  <Bar dataKey="collected" name="Collected" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                  <Bar dataKey="pending" name="Pending" fill="hsl(var(--destructive))" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Collection Split</CardTitle>
            <CardDescription>Overall payment status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`PKR ${value.toLocaleString()}`, '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gym Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Gym Performance
          </CardTitle>
          <CardDescription>Payment history per gym</CardDescription>
        </CardHeader>
        <CardContent>
          {gymPerformance.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No fee data available for this period.</p>
          ) : (
            <div className="space-y-3">
              {gymPerformance.map((gym, i) => {
                const total = gym.total_paid + gym.total_pending;
                const paidPercent = total > 0 ? (gym.total_paid / total) * 100 : 0;
                return (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-border">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{gym.gym_name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{gym.months_paid} paid</span>
                        <span>{gym.months_pending} pending</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${paidPercent}%` }} />
                      </div>
                      <div className="text-right min-w-[100px]">
                        <p className="text-sm font-medium text-primary">PKR {gym.total_paid.toLocaleString()}</p>
                        {gym.total_pending > 0 && (
                          <p className="text-xs text-destructive">PKR {gym.total_pending.toLocaleString()} pending</p>
                        )}
                      </div>
                      <Badge variant={paidPercent === 100 ? 'default' : paidPercent >= 50 ? 'secondary' : 'destructive'}>
                        {paidPercent.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
