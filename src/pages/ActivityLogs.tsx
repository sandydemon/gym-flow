import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';
import { format } from 'date-fns';

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  page_view: 'Page View',
  member_added: 'Added Member',
  member_updated: 'Updated Member',
  member_deleted: 'Deleted Member',
  attendance_marked: 'Marked Attendance',
  fee_collected: 'Collected Fee',
  fee_updated: 'Updated Fee',
  expense_added: 'Added Expense',
  staff_added: 'Added Staff',
  staff_salary_paid: 'Paid Salary',
};

export default function ActivityLogs() {
  const { data: roleInfo, isLoading: roleLoading } = useUserRole();
  const [userFilter, setUserFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['activity-logs', roleInfo?.gymOwnerId],
    enabled: !!roleInfo && (roleInfo.role === 'owner' || roleInfo.role === 'admin'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('gym_owner_id', roleInfo!.gymOwnerId)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const users = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((l: any) => {
      if (l.user_id && !map.has(l.user_id)) map.set(l.user_id, l.user_name || 'Unknown');
    });
    return Array.from(map.entries());
  }, [logs]);

  const actions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l: any) => set.add(l.action_type));
    return Array.from(set);
  }, [logs]);

  const filtered = logs.filter((l: any) => {
    if (userFilter !== 'all' && l.user_id !== userFilter) return false;
    if (actionFilter !== 'all' && l.action_type !== actionFilter) return false;
    if (dateFilter && !l.created_at.startsWith(dateFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = `${l.user_name ?? ''} ${l.description ?? ''} ${l.action_type}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!roleInfo || (roleInfo.role !== 'owner' && roleInfo.role !== 'admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="page-header">
          <div className="page-header-icon"><Activity className="h-5 w-5 text-primary-foreground" /></div>
          <div>
            <h1 className="text-2xl font-extrabold gradient-text">Activity Logs</h1>
            <p className="text-sm text-muted-foreground">Track every action by your team</p>
          </div>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-sm">Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger><SelectValue placeholder="All users" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {users.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue placeholder="All actions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actions.map(a => <SelectItem key={a} value={a}>{ACTION_LABELS[a] || a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-sm">{filtered.length} entries</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No activity found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-border/40 text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-4">When</th>
                      <th className="py-2 pr-4">User</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Action</th>
                      <th className="py-2 pr-4">Details</th>
                      <th className="py-2 pr-4">Page</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((l: any) => (
                      <tr key={l.id} className="border-b border-border/20 hover:bg-secondary/30">
                        <td className="py-2.5 pr-4 whitespace-nowrap text-xs text-muted-foreground">
                          {format(new Date(l.created_at), 'dd MMM yyyy, HH:mm:ss')}
                        </td>
                        <td className="py-2.5 pr-4 font-medium">{l.user_name || '—'}</td>
                        <td className="py-2.5 pr-4"><Badge variant="outline" className="capitalize">{l.user_role || '—'}</Badge></td>
                        <td className="py-2.5 pr-4"><Badge>{ACTION_LABELS[l.action_type] || l.action_type}</Badge></td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{l.description || '—'}</td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground">{l.page || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
