import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useQuery } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, DollarSign, AlertCircle, CheckCircle, ArrowRight, ClipboardCheck, Activity, Wallet, Dumbbell, UserCog } from 'lucide-react';
import { format } from 'date-fns';
import DashboardCharts from '@/components/dashboard/DashboardCharts';

interface DashboardStats {
  totalMembers: number;
  expectedFees: number;
  collectedFees: number;
  pendingFees: number;
  monthlyExpenses: number;
  pendingMembers: { id: string; full_name: string; amount: number }[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: roleInfo, isLoading: roleLoading } = useUserRole();
  const role = roleInfo?.role;
  const gymId = roleInfo?.gymOwnerId;
  const trainerStaffId = roleInfo?.staffId ?? null;

  const today = format(new Date(), 'yyyy-MM-dd');
  const currentMonth = format(new Date(), 'yyyy-MM');

  // ====== OWNER / ADMIN dashboard data ======
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0, expectedFees: 0, collectedFees: 0, pendingFees: 0, monthlyExpenses: 0, pendingMembers: [],
  });
  const [loading, setLoading] = useState(true);
  const isOwnerLike = role === 'owner' || role === 'admin';
  const isReceptionist = role === 'receptionist';
  const isTrainer = role === 'trainer';

  const { data: todayAttendance = [] } = useQuery({
    queryKey: ['attendance-today-dashboard', gymId, today],
    enabled: !!gymId && (isOwnerLike || isReceptionist),
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('member_id, marked_at')
        .eq('user_id', gymId!)
        .eq('attendance_date', today)
        .order('marked_at', { ascending: false });
      if (!data?.length) return [];
      const memberIds = data.map((a: any) => a.member_id);
      const { data: members } = await supabase.from('members').select('id, full_name').in('id', memberIds);
      const nameMap = new Map(members?.map((m) => [m.id, m.full_name]) || []);
      return data.map((a: any) => ({ member_id: a.member_id, full_name: nameMap.get(a.member_id) || 'Unknown', marked_at: a.marked_at }));
    },
  });

  useEffect(() => {
    if (gymId && (isOwnerLike || isReceptionist)) fetchOwnerData();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymId, role]);

  const fetchOwnerData = async () => {
    try {
      const { data: members } = await supabase
        .from('members').select('id, full_name, monthly_fee').eq('user_id', gymId!).eq('is_active', true);
      const totalMembers = members?.length || 0;
      const expectedFees = members?.reduce((s, m) => s + Number(m.monthly_fee), 0) || 0;

      const { data: fees } = await supabase
        .from('monthly_fees').select('member_id, amount, status').eq('user_id', gymId!).eq('month', currentMonth);
      const collectedFees = fees?.filter((f) => f.status === 'Paid').reduce((s, f) => s + Number(f.amount), 0) || 0;
      const pendingFees = fees?.filter((f) => f.status === 'Pending').reduce((s, f) => s + Number(f.amount), 0) || 0;
      const pendingIds = fees?.filter((f) => f.status === 'Pending').map((f) => f.member_id) || [];
      const pendingMembers = members?.filter((m) => pendingIds.includes(m.id)).map((m) => ({ id: m.id, full_name: m.full_name, amount: Number(m.monthly_fee) })) || [];

      let monthlyExpenses = 0;
      if (isOwnerLike) {
        const { data: exp } = await supabase.from('expenses').select('amount, expense_date').eq('user_id', gymId!);
        monthlyExpenses = exp?.filter((e: any) => e.expense_date?.startsWith(currentMonth)).reduce((s: number, e: any) => s + Number(e.amount), 0) || 0;
      }

      setStats({ totalMembers, expectedFees, collectedFees, pendingFees, monthlyExpenses, pendingMembers });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ====== TRAINER dashboard data ======
  const { data: trainerData, isLoading: trainerLoading } = useQuery({
    queryKey: ['trainer-dashboard', gymId, trainerStaffId, today, currentMonth],
    enabled: isTrainer && !!gymId,
    queryFn: async () => {
      // Assigned paid-training members for this trainer
      const { data: assigned = [] } = await supabase
        .from('paid_training_members')
        .select('id, member_id, target, created_at')
        .eq('user_id', gymId!)
        .eq('trainer_id', trainerStaffId);

      const memberIds = (assigned ?? []).map((p: any) => p.member_id);
      let memberRows: any[] = [];
      if (memberIds.length) {
        const { data } = await supabase.from('members').select('id, full_name, phone, is_active').in('id', memberIds);
        memberRows = data || [];
      }
      const activeAssigned = memberRows.filter((m) => m.is_active);

      // Attendance marked today by this trainer's gym for assigned members
      let todayMarked = 0;
      let recentSessions: any[] = [];
      if (memberIds.length) {
        const { data: att } = await supabase
          .from('attendance')
          .select('member_id, marked_at, attendance_date')
          .eq('user_id', gymId!)
          .in('member_id', memberIds)
          .order('marked_at', { ascending: false })
          .limit(50);
        todayMarked = (att || []).filter((a: any) => a.attendance_date === today).length;
        const nameMap = new Map(memberRows.map((m) => [m.id, m.full_name]));
        recentSessions = (att || []).slice(0, 8).map((a: any) => ({
          name: nameMap.get(a.member_id) || 'Member',
          marked_at: a.marked_at,
          date: a.attendance_date,
        }));
      }

      return {
        assignedCount: (assigned ?? []).length,
        activeCount: activeAssigned.length,
        todayMarked,
        recentSessions,
      };
    },
  });

  // ====== Loading ======
  if (roleLoading || (isOwnerLike || isReceptionist ? loading : false) || (isTrainer && trainerLoading)) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  const collectionPercent = stats.expectedFees > 0 ? Math.round((stats.collectedFees / stats.expectedFees) * 100) : 0;

  // ====== TRAINER VIEW ======
  if (isTrainer) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="animate-fade-in-up">
            <div className="page-header">
              <div className="page-header-icon">
                <Dumbbell className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold gradient-text">Trainer Dashboard</h1>
                <p className="text-sm text-muted-foreground">Your assigned members & sessions — {format(new Date(), 'MMMM yyyy')}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned Members</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><UserCog className="h-4 w-4 text-primary" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-extrabold tracking-tight">{trainerData?.assignedCount ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1.5">{trainerData?.activeCount ?? 0} active</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Check-ins</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10"><CheckCircle className="h-4 w-4 text-success" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-extrabold tracking-tight">{trainerData?.todayMarked ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1.5">From your members</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Sessions</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><Activity className="h-4 w-4 text-primary" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-extrabold tracking-tight">{trainerData?.recentSessions.length ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1.5">Recent activity</p>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Recent Sessions</CardTitle>
              <Button variant="outline" size="sm" asChild><Link to="/paid-training">My Members <ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
            </CardHeader>
            <CardContent>
              {(trainerData?.recentSessions.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No recent attendance yet.</p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {trainerData!.recentSessions.map((s, i) => (
                    <li key={i} className="py-2.5 flex items-center justify-between">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(s.marked_at), 'dd MMM, HH:mm')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // ====== RECEPTIONIST VIEW ======
  if (isReceptionist) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="animate-fade-in-up">
            <div className="page-header">
              <div className="page-header-icon"><Activity className="h-5 w-5 text-primary-foreground" /></div>
              <div>
                <h1 className="text-2xl font-extrabold gradient-text">Reception Dashboard</h1>
                <p className="text-sm text-muted-foreground">{format(new Date(), 'MMMM yyyy')}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Members</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><Users className="h-4 w-4 text-primary" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-extrabold tracking-tight">{stats.totalMembers}</div>
                <p className="text-xs text-muted-foreground mt-1.5">Active</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Attendance</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10"><ClipboardCheck className="h-4 w-4 text-success" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-extrabold tracking-tight">{todayAttendance.length}</div>
                <p className="text-xs text-muted-foreground mt-1.5">Members present</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Fees</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10"><AlertCircle className="h-4 w-4 text-warning" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-extrabold tracking-tight">PKR {stats.pendingFees.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  <span className="text-warning font-bold">{stats.pendingMembers.length}</span> member(s) pending
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild><Link to="/members">Members</Link></Button>
              <Button variant="outline" asChild><Link to="/attendance">Attendance</Link></Button>
              <Button variant="outline" asChild><Link to="/fees">Fees</Link></Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // ====== OWNER / ADMIN VIEW (original) ======
  return (
    <Layout>
      <div className="space-y-6">
        <div className="animate-fade-in-up">
          <div className="page-header">
            <div className="page-header-icon">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold gradient-text">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Overview for {format(new Date(), 'MMMM yyyy')}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Card className="glass-card overflow-hidden relative animate-fade-in-up-delay-1 group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(166,76%,58%)] to-[hsl(200,80%,60%)]" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Members</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><Users className="h-4 w-4 text-primary" /></div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-extrabold tracking-tight">{stats.totalMembers}</div>
              <p className="text-xs text-muted-foreground mt-1.5">Active members</p>
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden relative animate-fade-in-up-delay-2 group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(200,80%,60%)] to-[hsl(270,60%,65%)]" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expected Fees</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><DollarSign className="h-4 w-4 text-primary" /></div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-extrabold tracking-tight">PKR {stats.expectedFees.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1.5">This month</p>
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden relative animate-fade-in-up-delay-3 group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(166,76%,58%)] to-[hsl(160,84%,39%)]" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Collected Fees</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10"><CheckCircle className="h-4 w-4 text-success" /></div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-extrabold tracking-tight">PKR {stats.collectedFees.toLocaleString()}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[hsl(166,76%,58%)] to-[hsl(160,84%,39%)] rounded-full transition-all duration-700" style={{ width: `${collectionPercent}%` }} />
                </div>
                <span className="text-xs font-bold text-success">{collectionPercent}%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden relative animate-fade-in-up-delay-4 group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(38,92%,50%)] to-[hsl(0,72%,50%)]" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Fees</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10"><AlertCircle className="h-4 w-4 text-warning" /></div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-extrabold tracking-tight">PKR {stats.pendingFees.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1.5">
                <span className="text-warning font-bold">{stats.pendingMembers.length}</span> member(s) pending
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden relative animate-fade-in-up-delay-4 group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(0,72%,50%)] to-[hsl(330,70%,60%)]" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monthly Expenses</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10"><Wallet className="h-4 w-4 text-destructive" /></div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-extrabold tracking-tight text-destructive">PKR {stats.monthlyExpenses.toLocaleString()}</div>
              <Link to="/expenses" className="text-xs text-muted-foreground mt-1.5 inline-flex items-center gap-1 hover:text-primary">
                Manage expenses <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card overflow-hidden relative animated-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-[hsl(270,60%,65%)]/20">
                <ClipboardCheck className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold text-muted-foreground">Today's Attendance</CardTitle>
            </div>
            <Button variant="outline" size="sm" className="text-xs border-border/50 hover:border-primary/40 hover:text-primary gap-1.5" asChild>
              <Link to="/attendance">Mark Attendance <ArrowRight className="h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight">{todayAttendance.length}</span>
              <span className="text-sm text-muted-foreground">members present today</span>
            </div>
          </CardContent>
        </Card>

        <DashboardCharts />
      </div>
    </Layout>
  );
}
