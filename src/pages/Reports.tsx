import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGymOwnerId } from '@/hooks/useGymOwnerId';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend, AreaChart, Area } from 'recharts';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Users, Percent, Download } from 'lucide-react';
import { format, subMonths, startOfMonth } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = [
  'hsl(166, 76%, 58%)',
  'hsl(270, 60%, 65%)',
  'hsl(200, 80%, 60%)',
  'hsl(330, 70%, 60%)',
  'hsl(45, 90%, 60%)',
  'hsl(0, 72%, 50%)',
];

export default function Reports() {
  const { user } = useAuth();
  const gymOwnerId = useGymOwnerId();
  const [fees, setFees] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [months, setMonths] = useState(6);
  const [gymName, setGymName] = useState('My Gym');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    if (!gymOwnerId) return;
    const fetchAll = async () => {
      const [feesRes, expRes, memRes, profileRes] = await Promise.all([
        supabase.from('monthly_fees').select('*').eq('user_id', gymOwnerId!),
        supabase.from('expenses').select('*').eq('user_id', gymOwnerId!),
        supabase.from('members').select('*').eq('user_id', gymOwnerId!),
        supabase.from('profiles').select('gym_name, logo_url').eq('user_id', gymOwnerId!).single(),
      ]);
      setFees(feesRes.data || []);
      setExpenses(expRes.data || []);
      setMembers(memRes.data || []);
      if (profileRes.data) {
        setGymName(profileRes.data.gym_name || 'My Gym');
        setLogoUrl(profileRes.data.logo_url || null);
      }
    };
    fetchAll();
  }, [gymOwnerId]);

  const last6Months = useMemo(() => {
    const arr = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      arr.push(format(d, 'yyyy-MM'));
    }
    return arr;
  }, [months]);

  // Income vs Expense per month
  const incomeVsExpense = useMemo(() => {
    return last6Months.map(m => {
      const income = fees.filter(f => f.month === m && f.status === 'Paid').reduce((s: number, f: any) => s + Number(f.amount), 0);
      const expense = expenses.filter(e => e.expense_date?.startsWith(m)).reduce((s: number, e: any) => s + Number(e.amount), 0);
      return { month: format(new Date(m + '-01'), 'MMM yyyy'), income, expense, profit: income - expense };
    });
  }, [fees, expenses, last6Months]);

  // Member growth
  const memberGrowth = useMemo(() => {
    return last6Months.map(m => {
      const total = members.filter(mem => mem.join_date <= m + '-31').length;
      const active = members.filter(mem => mem.join_date <= m + '-31' && mem.is_active).length;
      return { month: format(new Date(m + '-01'), 'MMM yyyy'), total, active };
    });
  }, [members, last6Months]);

  // Expense by category
  const expenseByCategory = useMemo(() => {
    const catMap: Record<string, number> = {};
    expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount); });
    return Object.entries(catMap).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  // Fee collection rate
  const collectionRate = useMemo(() => {
    return last6Months.map(m => {
      const monthFees = fees.filter(f => f.month === m);
      const paid = monthFees.filter(f => f.status === 'Paid').length;
      const total = monthFees.length;
      return { month: format(new Date(m + '-01'), 'MMM'), rate: total ? Math.round((paid / total) * 100) : 0 };
    });
  }, [fees, last6Months]);

  // Totals
  const totalIncome = fees.filter(f => f.status === 'Paid').reduce((s: number, f: any) => s + Number(f.amount), 0);
  const totalExpense = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const pendingFees = fees.filter(f => f.status === 'Pending').reduce((s: number, f: any) => s + Number(f.amount), 0);
  const profit = totalIncome - totalExpense;

  // Monthly report PDF
  const downloadMonthlyPDF = async (targetMonth: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    let logoImg: string | null = null;
    if (logoUrl) {
      try {
        const response = await fetch(logoUrl);
        const blob = await response.blob();
        logoImg = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (e) { console.error('Failed to load logo', e); }
    }

    doc.setFillColor(34, 139, 120);
    doc.rect(0, 0, pageWidth, 36, 'F');
    let textCenterX = pageWidth / 2;
    if (logoImg) {
      doc.addImage(logoImg, 'PNG', 10, 4, 28, 28);
      textCenterX = (pageWidth + 38) / 2;
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(gymName, textCenterX, 16, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Monthly Report - ${format(new Date(targetMonth + '-01'), 'MMMM yyyy')}`, textCenterX, 24, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, textCenterX, 31, { align: 'center' });

    // Month-specific data
    const monthFees = fees.filter(f => f.month === targetMonth);
    const monthExpenses = expenses.filter(e => e.expense_date?.startsWith(targetMonth));
    const mIncome = monthFees.filter(f => f.status === 'Paid').reduce((s: number, f: any) => s + Number(f.amount), 0);
    const mPending = monthFees.filter(f => f.status === 'Pending').reduce((s: number, f: any) => s + Number(f.amount), 0);
    const mExpense = monthExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const mProfit = mIncome - mExpense;

    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text('Summary', 14, 46);
    autoTable(doc, {
      startY: 50,
      head: [['Metric', 'Amount (PKR)']],
      body: [
        ['Income (Paid)', mIncome.toLocaleString()],
        ['Pending Fees', mPending.toLocaleString()],
        ['Total Expenses', mExpense.toLocaleString()],
        ['Net Profit', mProfit.toLocaleString()],
      ],
      theme: 'grid',
      headStyles: { fillColor: [34, 139, 120], textColor: 255 },
    });

    // Expenses breakdown
    const catMap: Record<string, number> = {};
    monthExpenses.forEach((e: any) => { catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount); });
    const y1 = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text('Expense Breakdown', 14, y1);
    autoTable(doc, {
      startY: y1 + 4,
      head: [['Category', 'Amount (PKR)']],
      body: Object.entries(catMap).length > 0
        ? Object.entries(catMap).map(([cat, amt]) => [cat, amt.toLocaleString()])
        : [['No expenses', '0']],
      theme: 'grid',
      headStyles: { fillColor: [34, 139, 120], textColor: 255 },
    });

    // Fee details
    const y2 = (doc as any).lastAutoTable.finalY + 10;
    if (y2 > 240) doc.addPage();
    const y2f = y2 > 240 ? 20 : y2;
    doc.setFontSize(14);
    doc.text('Member Fee Details', 14, y2f);
    const memberMap = new Map(members.map((m: any) => [m.id, m.full_name]));
    autoTable(doc, {
      startY: y2f + 4,
      head: [['Member', 'Amount', 'Status', 'Payment Date']],
      body: monthFees.length > 0 ? monthFees.map((f: any) => [
        memberMap.get(f.member_id) || '—',
        Number(f.amount).toLocaleString(),
        f.status,
        f.payment_date ? format(new Date(f.payment_date), 'dd MMM yyyy') : '—',
      ]) : [['No fees recorded', '-', '-', '-']],
      theme: 'striped',
      headStyles: { fillColor: [34, 139, 120], textColor: 255 },
      styles: { fontSize: 9 },
    });

    doc.save(`${gymName}_Monthly_Report_${targetMonth}.pdf`);
  };

  const downloadPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Load logo if available
    let logoImg: string | null = null;
    if (logoUrl) {
      try {
        const response = await fetch(logoUrl);
        const blob = await response.blob();
        logoImg = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (e) { console.error('Failed to load logo', e); }
    }

    // Header with logo and gym name
    doc.setFillColor(34, 139, 120);
    doc.rect(0, 0, pageWidth, 36, 'F');

    let textCenterX = pageWidth / 2;
    if (logoImg) {
      doc.addImage(logoImg, 'PNG', 10, 4, 28, 28);
      textCenterX = (pageWidth + 38) / 2;
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(gymName, textCenterX, 16, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Financial Report', textCenterX, 24, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, textCenterX, 31, { align: 'center' });

    // Summary
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text('Summary', 14, 46);
    autoTable(doc, {
      startY: 50,
      head: [['Metric', 'Amount (PKR)']],
      body: [
        ['Total Income', totalIncome.toLocaleString()],
        ['Total Expense', totalExpense.toLocaleString()],
        ['Net Profit', profit.toLocaleString()],
        ['Pending Fees', pendingFees.toLocaleString()],
      ],
      theme: 'grid',
      headStyles: { fillColor: [34, 139, 120], textColor: 255 },
      styles: { fontSize: 10 },
    });

    // Income vs Expense table
    const y1 = (doc as any).lastAutoTable?.finalY + 10 || 90;
    doc.setFontSize(14);
    doc.text('Income vs Expense (Monthly)', 14, y1);
    autoTable(doc, {
      startY: y1 + 4,
      head: [['Month', 'Income (PKR)', 'Expense (PKR)', 'Profit (PKR)']],
      body: incomeVsExpense.map(r => [r.month, r.income.toLocaleString(), r.expense.toLocaleString(), r.profit.toLocaleString()]),
      theme: 'grid',
      headStyles: { fillColor: [34, 139, 120], textColor: 255 },
      styles: { fontSize: 10 },
    });

    // Expense by category
    const y2 = (doc as any).lastAutoTable?.finalY + 10 || 150;
    doc.setFontSize(14);
    doc.text('Expense by Category', 14, y2);
    autoTable(doc, {
      startY: y2 + 4,
      head: [['Category', 'Amount (PKR)']],
      body: expenseByCategory.map(r => [r.name, r.value.toLocaleString()]),
      theme: 'grid',
      headStyles: { fillColor: [34, 139, 120], textColor: 255 },
      styles: { fontSize: 10 },
    });

    // Member growth
    const y3 = (doc as any).lastAutoTable?.finalY + 10 || 200;
    if (y3 > 250) doc.addPage();
    const y3Final = y3 > 250 ? 20 : y3;
    doc.setFontSize(14);
    doc.text('Member Growth', 14, y3Final);
    autoTable(doc, {
      startY: y3Final + 4,
      head: [['Month', 'Total Members', 'Active Members']],
      body: memberGrowth.map(r => [r.month, r.total, r.active]),
      theme: 'grid',
      headStyles: { fillColor: [34, 139, 120], textColor: 255 },
      styles: { fontSize: 10 },
    });

    // Collection rate
    const y4 = (doc as any).lastAutoTable?.finalY + 10 || 20;
    if (y4 > 250) doc.addPage();
    const y4Final = y4 > 250 ? 20 : y4;
    doc.setFontSize(14);
    doc.text('Fee Collection Rate', 14, y4Final);
    autoTable(doc, {
      startY: y4Final + 4,
      head: [['Month', 'Collection Rate (%)']],
      body: collectionRate.map(r => [r.month, `${r.rate}%`]),
      theme: 'grid',
      headStyles: { fillColor: [34, 139, 120], textColor: 255 },
      styles: { fontSize: 10 },
    });

    doc.save(`Gym_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--chart-1))] to-[hsl(var(--chart-2))] shadow-lg">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Reports</h1>
              <p className="text-sm text-muted-foreground">Financial & member analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={downloadPDF} variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" /> Download PDF
            </Button>
            <Select value={String(months)} onValueChange={v => setMonths(Number(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Last 3 Months</SelectItem>
                <SelectItem value="6">Last 6 Months</SelectItem>
                <SelectItem value="12">Last 12 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Monthly Report */}
        <Card className="glass-card">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Monthly Report</p>
              <p className="text-xs text-muted-foreground">Pick a month and download a detailed PDF report</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
              <Button onClick={() => downloadMonthlyPDF(selectedMonth)} size="sm" className="gap-2">
                <Download className="h-4 w-4" /> Download Monthly PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div><p className="text-xs text-muted-foreground">Total Income</p><p className="text-lg font-bold text-primary">PKR {totalIncome.toLocaleString()}</p></div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-destructive" />
              <div><p className="text-xs text-muted-foreground">Total Expense</p><p className="text-lg font-bold text-destructive">PKR {totalExpense.toLocaleString()}</p></div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-3">
              <DollarSign className="h-8 w-8" style={{ color: profit >= 0 ? 'hsl(160, 84%, 39%)' : 'hsl(0, 72%, 50%)' }} />
              <div><p className="text-xs text-muted-foreground">Net Profit</p><p className="text-lg font-bold" style={{ color: profit >= 0 ? 'hsl(160, 84%, 39%)' : 'hsl(0, 72%, 50%)' }}>PKR {profit.toLocaleString()}</p></div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-3">
              <Percent className="h-8 w-8 text-warning" />
              <div><p className="text-xs text-muted-foreground">Pending Fees</p><p className="text-lg font-bold text-warning">PKR {pendingFees.toLocaleString()}</p></div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income vs Expense */}
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-base">Income vs Expense</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={incomeVsExpense}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'hsl(220, 20%, 10%)', border: '1px solid hsl(220, 15%, 18%)', borderRadius: 12, color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="income" fill="hsl(166, 76%, 58%)" radius={[6, 6, 0, 0]} name="Income" />
                  <Bar dataKey="expense" fill="hsl(0, 72%, 50%)" radius={[6, 6, 0, 0]} name="Expense" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Expense by Category */}
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-base">Expense by Category</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(220, 20%, 10%)', border: '1px solid hsl(220, 15%, 18%)', borderRadius: 12, color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Member Growth */}
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-base">Member Growth</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={memberGrowth}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(270, 60%, 65%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(270, 60%, 65%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(166, 76%, 58%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(166, 76%, 58%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'hsl(220, 20%, 10%)', border: '1px solid hsl(220, 15%, 18%)', borderRadius: 12, color: '#fff' }} />
                  <Legend />
                  <Area type="monotone" dataKey="total" stroke="hsl(270, 60%, 65%)" fill="url(#colorTotal)" name="Total" />
                  <Area type="monotone" dataKey="active" stroke="hsl(166, 76%, 58%)" fill="url(#colorActive)" name="Active" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Fee Collection Rate */}
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-base">Fee Collection Rate</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={collectionRate}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: 'hsl(220, 20%, 10%)', border: '1px solid hsl(220, 15%, 18%)', borderRadius: 12, color: '#fff' }} formatter={(v: any) => `${v}%`} />
                  <Line type="monotone" dataKey="rate" stroke="hsl(45, 90%, 60%)" strokeWidth={3} dot={{ fill: 'hsl(45, 90%, 60%)', r: 5 }} name="Collection %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
