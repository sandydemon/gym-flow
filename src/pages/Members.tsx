import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logActivity } from '@/lib/activityLog';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, UserPlus, MessageCircle, Search, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { z } from 'zod';
import { openWhatsApp, buildReminderMessage } from '@/lib/whatsapp';
import { Link } from 'react-router-dom';
import { useGymOwnerId } from '@/hooks/useGymOwnerId';

interface Member {
  id: string;
  member_code: string | null;
  full_name: string;
  phone: string | null;
  join_date: string;
  monthly_fee: number;
  admission_fee: number;
  admission_fee_paid: boolean;
  is_active: boolean;
}

const memberSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
  phone: z.string().optional(),
  join_date: z.string().min(1, 'Join date is required'),
  monthly_fee: z.number().min(0, 'Fee must be positive'),
  admission_fee: z.number().min(0, 'Admission fee must be positive'),
});

export default function Members() {
  const { user } = useAuth();
  const gymOwnerId = useGymOwnerId();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    join_date: format(new Date(), 'yyyy-MM-dd'),
    monthly_fee: '',
    admission_fee: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gymName, setGymName] = useState('Gym');
  const [feeStatusMap, setFeeStatusMap] = useState<Record<string, 'Paid' | 'Pending'>>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (gymOwnerId) {
      fetchMembers();
      fetchGymName();
    }
  }, [gymOwnerId]);

  const fetchGymName = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('gym_name')
      .eq('user_id', gymOwnerId!)
      .single();
    if (data?.gym_name) setGymName(data.gym_name);
  };

  const fetchMembers = async () => {
    try {
      const currentMonth = format(new Date(), 'yyyy-MM');

      const [membersRes, feesRes] = await Promise.all([
        supabase
          .from('members')
          .select('*')
          .eq('user_id', gymOwnerId!)
          .order('full_name'),
        supabase
          .from('monthly_fees')
          .select('member_id, status')
          .eq('user_id', gymOwnerId!)
          .eq('month', currentMonth),
      ]);

      if (membersRes.error) throw membersRes.error;
      setMembers(membersRes.data || []);

      // Build fee status map for current month
      const statusMap: Record<string, 'Paid' | 'Pending'> = {};
      (feesRes.data || []).forEach((f) => {
        statusMap[f.member_id] = f.status as 'Paid' | 'Pending';
      });
      setFeeStatusMap(statusMap);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load members',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      phone: '',
      join_date: format(new Date(), 'yyyy-MM-dd'),
      monthly_fee: '',
      admission_fee: '',
    });
    setEditingMember(null);
  };

  const openEditDialog = (member: Member) => {
    setEditingMember(member);
    setFormData({
      full_name: member.full_name,
      phone: member.phone || '',
      join_date: member.join_date,
      monthly_fee: member.monthly_fee.toString(),
      admission_fee: member.admission_fee.toString(),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = memberSchema.safeParse({
      full_name: formData.full_name,
      phone: formData.phone || undefined,
      join_date: formData.join_date,
      monthly_fee: parseFloat(formData.monthly_fee) || 0,
      admission_fee: parseFloat(formData.admission_fee) || 0,
    });

    if (!validation.success) {
      toast({
        title: 'Validation Error',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingMember) {
        const updateData: any = {
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          join_date: formData.join_date,
          monthly_fee: parseFloat(formData.monthly_fee),
        };

        if (!editingMember.admission_fee_paid) {
          updateData.admission_fee = parseFloat(formData.admission_fee);
        }

        const { error } = await supabase
          .from('members')
          .update(updateData)
          .eq('id', editingMember.id);

        if (error) throw error;
        await logActivity({ action_type: 'member_updated', description: `Updated member ${formData.full_name.trim()}`, entity_type: 'member', entity_id: editingMember.id });
        toast({ title: 'Success', description: 'Member updated successfully' });
      } else {
        const { error } = await supabase.from('members').insert({
          user_id: gymOwnerId!,
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          join_date: formData.join_date,
          monthly_fee: parseFloat(formData.monthly_fee),
          admission_fee: parseFloat(formData.admission_fee) || 0,
          admission_fee_paid: false,
        });

        if (error) throw error;
        await logActivity({ action_type: 'member_added', description: `Added member ${formData.full_name.trim()}`, entity_type: 'member' });
        toast({ title: 'Success', description: 'Member added successfully' });
      }

      setDialogOpen(false);
      resetForm();
      fetchMembers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save member',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (member: Member) => {
    if (!confirm(`Are you sure you want to delete ${member.full_name}?`)) return;

    try {
      const { error } = await supabase.from('members').delete().eq('id', member.id);
      if (error) throw error;
      toast({ title: 'Success', description: 'Member deleted successfully' });
      fetchMembers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete member',
        variant: 'destructive',
      });
    }
  };

  const toggleActive = async (member: Member) => {
    try {
      const { error } = await supabase
        .from('members')
        .update({ is_active: !member.is_active })
        .eq('id', member.id);

      if (error) throw error;
      toast({
        title: 'Success',
        description: `Member ${member.is_active ? 'deactivated' : 'activated'}`,
      });
      fetchMembers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update member',
        variant: 'destructive',
      });
    }
  };

  const sendWhatsAppReminder = (member: Member) => {
    if (!member.phone) {
      toast({
        title: 'No Phone Number',
        description: `Please add a phone number for ${member.full_name} first.`,
        variant: 'destructive',
      });
      return;
    }

    const currentMonth = format(new Date(), 'MMMM yyyy');
    const dueDate = format(new Date(), 'dd MMMM yyyy');
    const message = buildReminderMessage({
      name: member.full_name,
      dueDate,
      gymName,
    });

    openWhatsApp(member.phone, message);
  };

  const getFeeStatus = (memberId: string): 'Paid' | 'Pending' | null => {
    return feeStatusMap[memberId] || null;
  };

  const copyMemberId = (code: string | null) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast({ title: 'Copied', description: `Member ID ${code} copied to clipboard` });
  };

  const filteredMembers = members.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      (m.member_code || '').toLowerCase().includes(q) ||
      m.full_name.toLowerCase().includes(q) ||
      (m.phone || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Members</h1>
            <p className="text-muted-foreground">
              Manage your gym members
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingMember ? 'Edit Member' : 'Add New Member'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number (WhatsApp)</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="03001234567"
                  />
                  <p className="text-xs text-muted-foreground">
                    Pakistani format (e.g. 03001234567) — auto-converts to international
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="join_date">Join Date</Label>
                  <Input
                    id="join_date"
                    type="date"
                    value={formData.join_date}
                    onChange={(e) =>
                      setFormData({ ...formData, join_date: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly_fee">Monthly Fee (PKR)</Label>
                  <Input
                    id="monthly_fee"
                    type="number"
                    step="1"
                    min="0"
                    value={formData.monthly_fee}
                    onChange={(e) =>
                      setFormData({ ...formData, monthly_fee: e.target.value })
                    }
                    placeholder="5000"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admission_fee">
                    Admission Fee (PKR)
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      One-time (Paid at Joining only)
                    </span>
                  </Label>
                  <Input
                    id="admission_fee"
                    type="number"
                    step="1"
                    min="0"
                    value={formData.admission_fee}
                    onChange={(e) =>
                      setFormData({ ...formData, admission_fee: e.target.value })
                    }
                    placeholder="1000"
                    disabled={editingMember?.admission_fee_paid}
                  />
                  {editingMember?.admission_fee_paid && (
                    <p className="text-xs text-muted-foreground">
                      Admission fee already paid - cannot be modified
                    </p>
                  )}
                </div>
                <div className="flex gap-3 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : editingMember ? 'Update' : 'Add Member'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Members ({members.length})</CardTitle>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Member ID (e.g. GYM001), name, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <div className="text-center py-12">
                <UserPlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium text-foreground mb-1">
                  No members yet
                </h3>
                <p className="text-muted-foreground mb-4">
                  Add your first member to get started
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Member
                </Button>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No members match "{searchQuery}"
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="space-y-3 md:hidden">
                  {filteredMembers.map((member) => {
                    const status = getFeeStatus(member.id);
                    return (
                      <div key={member.id} className="rounded-lg border border-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <Link to={`/members/${member.id}`} className="font-medium text-foreground hover:text-primary hover:underline">{member.full_name}</Link>
                            {member.member_code && (
                              <button
                                onClick={() => copyMemberId(member.member_code)}
                                className="text-xs font-mono text-primary hover:underline flex items-center gap-1 mt-0.5"
                              >
                                {member.member_code} <Copy className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {status === 'Paid' && (
                              <Badge className="bg-green-600 text-white hover:bg-green-700">
                                Paid
                              </Badge>
                            )}
                            {status === 'Pending' && (
                              <Badge variant="destructive">Unpaid</Badge>
                            )}
                            <Badge
                              variant={member.is_active ? 'default' : 'secondary'}
                              className="cursor-pointer"
                              onClick={() => toggleActive(member)}
                            >
                              {member.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>{format(new Date(member.join_date), 'MMM d, yyyy')}</span>
                          <span className="font-medium text-foreground">PKR {Number(member.monthly_fee).toLocaleString()}</span>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 pt-1 border-t border-border">
                          {status === 'Pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-green-600 text-green-600 hover:bg-green-50"
                              onClick={() => sendWhatsAppReminder(member)}
                            >
                              <MessageCircle className="h-4 w-4 mr-1" /> Send Reminder
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(member)}>
                            <Pencil className="h-4 w-4 mr-1" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(member)}>
                            <Trash2 className="h-4 w-4 mr-1 text-destructive" /> Delete
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Join Date</TableHead>
                        <TableHead>Monthly Fee</TableHead>
                        <TableHead>Fee Status</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map((member) => {
                        const status = getFeeStatus(member.id);
                        return (
                          <TableRow key={member.id}>
                            <TableCell>
                              {member.member_code ? (
                                <button
                                  onClick={() => copyMemberId(member.member_code)}
                                  className="font-mono text-primary hover:underline flex items-center gap-1"
                                  title="Click to copy"
                                >
                                  {member.member_code}
                                  <Copy className="h-3 w-3" />
                                </button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium"><Link to={`/members/${member.id}`} className="hover:text-primary hover:underline">{member.full_name}</Link></TableCell>
                            <TableCell>{format(new Date(member.join_date), 'MMM d, yyyy')}</TableCell>
                            <TableCell>PKR {Number(member.monthly_fee).toLocaleString()}</TableCell>
                            <TableCell>
                              {status === 'Paid' && (
                                <Badge className="bg-green-600 text-white hover:bg-green-700">
                                  Paid
                                </Badge>
                              )}
                              {status === 'Pending' && (
                                <Badge variant="destructive">Unpaid</Badge>
                              )}
                              {!status && (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={member.is_active ? 'default' : 'secondary'}
                                className="cursor-pointer"
                                onClick={() => toggleActive(member)}
                              >
                                {member.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {status === 'Pending' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-green-600 text-green-600 hover:bg-green-50"
                                    onClick={() => sendWhatsAppReminder(member)}
                                    title="Send WhatsApp Reminder"
                                  >
                                    <MessageCircle className="h-4 w-4 mr-1" />
                                    Send Reminder
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(member)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(member)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
