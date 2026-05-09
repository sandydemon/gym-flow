import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGymOwnerId } from '@/hooks/useGymOwnerId';
import { logActivity } from '@/lib/activityLog';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Users, Trash2, Edit, ClipboardCheck, UserCheck, UserX, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import StaffFormDialog, { StaffFormValues } from '@/components/staff/StaffFormDialog';
import StaffSalaryDialog from '@/components/staff/StaffSalaryDialog';

interface Staff {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  salary: number;
  joining_date: string;
  is_active: boolean;
}

interface StaffAttendance {
  id: string;
  staff_id: string;
  attendance_date: string;
  status: string;
}

export default function StaffPage() {
  const { user } = useAuth();
  const gymOwnerId = useGymOwnerId();
  const { toast } = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [attendance, setAttendance] = useState<StaffAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);
  const [salaryStaff, setSalaryStaff] = useState<Staff | null>(null);

  const fetchStaff = async () => {
    if (!gymOwnerId) return;
    const { data } = await supabase.from('staff').select('*').eq('user_id', gymOwnerId!).order('created_at', { ascending: false });
    setStaff((data as Staff[]) || []);
    setLoading(false);
  };

  const fetchAttendance = async () => {
    if (!gymOwnerId) return;
    const { data } = await supabase.from('staff_attendance').select('*').eq('user_id', gymOwnerId!).eq('attendance_date', selectedDate);
    setAttendance((data as StaffAttendance[]) || []);
  };

  useEffect(() => { fetchStaff(); }, [gymOwnerId]);
  useEffect(() => { fetchAttendance(); }, [gymOwnerId, selectedDate]);

  const handleSubmit = async (form: StaffFormValues) => {
    if (!gymOwnerId) return;
    const payload = {
      user_id: gymOwnerId!,
      full_name: form.full_name,
      phone: form.phone || null,
      role: form.role,
      salary: parseFloat(form.salary),
      joining_date: form.joining_date,
    };
    if (editingStaff) {
      await supabase.from('staff').update(payload).eq('id', editingStaff.id);
      await logActivity({ action_type: 'staff_updated', description: `Updated staff ${form.full_name}`, entity_type: 'staff', entity_id: editingStaff.id });
      toast({ title: 'Staff updated' });
    } else {
      await supabase.from('staff').insert(payload);
      await logActivity({ action_type: 'staff_added', description: `Added staff ${form.full_name}`, entity_type: 'staff' });
      toast({ title: 'Staff added' });
    }
    setDialogOpen(false);
    setEditingStaff(null);
    fetchStaff();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('staff').delete().eq('id', id);
    toast({ title: 'Staff removed' });
    fetchStaff();
  };

  const handleEdit = (s: Staff) => {
    setEditingStaff(s);
    setDialogOpen(true);
  };

  const toggleActive = async (s: Staff) => {
    await supabase.from('staff').update({ is_active: !s.is_active }).eq('id', s.id);
    toast({ title: s.is_active ? 'Staff deactivated' : 'Staff activated' });
    fetchStaff();
  };

  const markAttendance = async (staffId: string, status: string) => {
    if (!gymOwnerId) return;
    const existing = attendance.find(a => a.staff_id === staffId);
    if (existing) {
      await supabase.from('staff_attendance').update({ status }).eq('id', existing.id);
    } else {
      await supabase.from('staff_attendance').insert({ staff_id: staffId, user_id: gymOwnerId!, attendance_date: selectedDate, status });
    }
    fetchAttendance();
    toast({ title: `Marked ${status}` });
  };

  const activeStaff = staff.filter(s => s.is_active);
  const totalSalary = activeStaff.reduce((s, st) => s + Number(st.salary), 0);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--chart-3))] to-[hsl(var(--chart-2))] shadow-lg">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Staff Management</h1>
              <p className="text-sm text-muted-foreground">Manage your gym staff</p>
            </div>
          </div>
          <StaffFormDialog
            open={dialogOpen}
            onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingStaff(null); }}
            initial={editingStaff ? { full_name: editingStaff.full_name, phone: editingStaff.phone || '', role: editingStaff.role, salary: String(editingStaff.salary), joining_date: editingStaff.joining_date } : null}
            isEditing={!!editingStaff}
            onSubmit={handleSubmit}
            trigger
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="glass-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active Staff</p><p className="text-2xl font-bold text-primary">{activeStaff.length}</p></CardContent></Card>
          <Card className="glass-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Staff</p><p className="text-2xl font-bold">{staff.length}</p></CardContent></Card>
          <Card className="glass-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Monthly Salary</p><p className="text-2xl font-bold text-warning">PKR {totalSalary.toLocaleString()}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="list">
          <TabsList className="glass-card">
            <TabsTrigger value="list">Staff List</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Salary</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                    ) : staff.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No staff added yet</TableCell></TableRow>
                    ) : staff.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.full_name}</TableCell>
                        <TableCell><Badge variant="secondary">{s.role}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{s.phone || '-'}</TableCell>
                        <TableCell className="font-semibold">PKR {Number(s.salary).toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground">{format(new Date(s.joining_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          <Badge className={s.is_active ? 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]' : 'bg-destructive/20 text-destructive'} onClick={() => toggleActive(s)} style={{ cursor: 'pointer' }}>
                            {s.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => { setSalaryStaff(s); setSalaryDialogOpen(true); }}><Wallet className="h-3.5 w-3.5" /> Salary</Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5" /> Staff Attendance</CardTitle>
                  <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-[180px]" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeStaff.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No active staff</p>
                  ) : activeStaff.map(s => {
                    const att = attendance.find(a => a.staff_id === s.id);
                    return (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/30">
                        <div>
                          <p className="font-medium">{s.full_name}</p>
                          <p className="text-xs text-muted-foreground">{s.role}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant={att?.status === 'Present' ? 'default' : 'outline'} className="rounded-lg gap-1" onClick={() => markAttendance(s.id, 'Present')}>
                            <UserCheck className="h-3.5 w-3.5" /> Present
                          </Button>
                          <Button size="sm" variant={att?.status === 'Absent' ? 'destructive' : 'outline'} className="rounded-lg gap-1" onClick={() => markAttendance(s.id, 'Absent')}>
                            <UserX className="h-3.5 w-3.5" /> Absent
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <StaffSalaryDialog
        open={salaryDialogOpen}
        onOpenChange={(o) => { setSalaryDialogOpen(o); if (!o) setSalaryStaff(null); }}
        staffId={salaryStaff?.id || null}
        staffName={salaryStaff?.full_name || ''}
        baseSalary={Number(salaryStaff?.salary || 0)}
      />
    </Layout>
  );
}
