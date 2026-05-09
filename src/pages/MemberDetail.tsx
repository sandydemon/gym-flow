import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useGymOwnerId } from '@/hooks/useGymOwnerId';
import { useAuth } from '@/hooks/useAuth';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, User, Calendar, CreditCard, FileText, Save, Package } from 'lucide-react';
import { format, subDays, addMonths } from 'date-fns';

interface MemberFull {
  id: string;
  member_code: string | null;
  full_name: string;
  phone: string | null;
  join_date: string;
  monthly_fee: number;
  admission_fee: number;
  is_active: boolean;
  notes: string | null;
  package_name: string | null;
  package_duration_months: number;
  expiry_date: string | null;
}

interface Fee {
  id: string;
  month: string;
  amount: number;
  status: string;
  payment_date: string | null;
  payment_method: string | null;
}

interface AttendanceRow {
  attendance_date: string;
}

export default function MemberDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const gymOwnerId = useGymOwnerId();
  const { toast } = useToast();
  const [member, setMember] = useState<MemberFull | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [notes, setNotes] = useState('');
  const [packageName, setPackageName] = useState('');
  const [packageDuration, setPackageDuration] = useState('1');
  const [expiryDate, setExpiryDate] = useState('');

  useEffect(() => {
    if (gymOwnerId && id) fetchAll();
  }, [gymOwnerId, id]);

  const fetchAll = async () => {
    setLoading(true);
    const thirtyAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const [mRes, fRes, aRes] = await Promise.all([
      supabase.from('members').select('*').eq('id', id).eq('user_id', gymOwnerId!).single(),
      supabase.from('monthly_fees').select('*').eq('member_id', id).eq('user_id', gymOwnerId!).order('month', { ascending: false }),
      supabase.from('attendance').select('attendance_date').eq('member_id', id).eq('user_id', gymOwnerId!).gte('attendance_date', thirtyAgo).order('attendance_date', { ascending: false }),
    ]);
    if (mRes.data) {
      const m = mRes.data as MemberFull;
      setMember(m);
      setNotes(m.notes || '');
      setPackageName(m.package_name || '');
      setPackageDuration(String(m.package_duration_months || 1));
      setExpiryDate(m.expiry_date || computeExpiry(m.join_date, m.package_duration_months || 1));
    }
    setFees((fRes.data as Fee[]) || []);
    setAttendance((aRes.data as AttendanceRow[]) || []);
    setLoading(false);
  };

  const computeExpiry = (join: string, months: number) => {
    return format(addMonths(new Date(join), months), 'yyyy-MM-dd');
  };

  const saveProfile = async () => {
    if (!member) return;
    setSaving(true);
    const { error } = await supabase.from('members').update({
      notes: notes || null,
      package_name: packageName || null,
      package_duration_months: parseInt(packageDuration) || 1,
      expiry_date: expiryDate || null,
    }).eq('id', member.id);
    setSaving(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Profile updated' });
    fetchAll();
  };

  if (loading) return <Layout><div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></Layout>;
  if (!member) return <Layout><div className="text-center py-12">Member not found</div></Layout>;

  const isExpired = expiryDate && new Date(expiryDate) < new Date();
  const totalPaid = fees.filter(f => f.status === 'Paid').reduce((s, f) => s + Number(f.amount), 0);

  return (
    <Layout>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/members')} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Members
        </Button>

        {/* Header card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{member.full_name}</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {member.member_code && <Badge variant="outline" className="font-mono">{member.member_code}</Badge>}
                    <Badge variant={member.is_active ? 'default' : 'secondary'}>{member.is_active ? 'Active' : 'Inactive'}</Badge>
                    {isExpired && <Badge variant="destructive">Expired</Badge>}
                  </div>
                  {member.phone && <p className="text-sm text-muted-foreground mt-1">{member.phone}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total Paid (Lifetime)</p>
                <p className="text-2xl font-bold text-success">PKR {totalPaid.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Membership package */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Membership Package</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><Label>Package Name</Label><Input value={packageName} onChange={e => setPackageName(e.target.value)} placeholder="e.g. Standard, Premium" /></div>
            <div><Label>Duration (months)</Label><Input type="number" min="1" value={packageDuration} onChange={e => { setPackageDuration(e.target.value); setExpiryDate(computeExpiry(member.join_date, parseInt(e.target.value) || 1)); }} /></div>
            <div><Label>Join Date</Label><Input value={format(new Date(member.join_date), 'dd MMM yyyy')} disabled /></div>
            <div><Label>Expiry Date</Label><Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Monthly Fee</Label><Input value={`PKR ${Number(member.monthly_fee).toLocaleString()}`} disabled /></div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Personal Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Health conditions, preferences, goals, anything relevant..." />
            <Button onClick={saveProfile} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Changes'}</Button>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Attendance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Attendance (Last 30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold mb-3">{attendance.length} <span className="text-sm font-normal text-muted-foreground">days present</span></p>
              {attendance.length === 0 ? <p className="text-sm text-muted-foreground">No attendance recorded</p> :
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                  {attendance.map((a, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{format(new Date(a.attendance_date), 'dd MMM')}</Badge>
                  ))}
                </div>}
            </CardContent>
          </Card>

          {/* Payment history */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {fees.length === 0 ? <p className="text-sm text-muted-foreground">No payment records</p> :
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {fees.map(f => (
                    <div key={f.id} className="flex items-center justify-between rounded-lg border border-border/50 p-2.5 text-sm">
                      <div>
                        <p className="font-medium">{format(new Date(f.month + '-01'), 'MMMM yyyy')}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.payment_date ? format(new Date(f.payment_date), 'dd MMM yyyy') : 'Not paid'}
                          {f.payment_method && ` • ${f.payment_method}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">PKR {Number(f.amount).toLocaleString()}</p>
                        <Badge className={f.status === 'Paid' ? 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]' : 'bg-warning/20 text-warning'}>{f.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
