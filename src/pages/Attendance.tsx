import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logActivity } from '@/lib/activityLog';
import Layout from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, CheckCircle, CheckCircle2, UserCheck, Undo2, UserX, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { openWhatsApp, buildInactiveReminderMessage } from '@/lib/whatsapp';
import { useGymOwnerId } from '@/hooks/useGymOwnerId';

interface InactiveMember {
  id: string;
  full_name: string;
  phone: string | null;
  lastAttendance: string;
  daysAbsent: number;
}

export default function Attendance() {
  const { user } = useAuth();
  const gymOwnerId = useGymOwnerId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: profile } = useQuery({
    queryKey: ['profile', gymOwnerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('gym_name')
        .eq('user_id', gymOwnerId!)
        .single();
      return data;
    },
    enabled: !!gymOwnerId,
  });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members-attendance', gymOwnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', gymOwnerId!)
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: !!gymOwnerId,
  });

  const { data: todayAttendance = [] } = useQuery({
    queryKey: ['attendance-today', gymOwnerId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('member_id')
        .eq('user_id', gymOwnerId!)
        .eq('attendance_date', today);
      if (error) throw error;
      return data.map((a: { member_id: string }) => a.member_id);
    },
    enabled: !!gymOwnerId,
  });

  const { data: inactiveMembers = [] } = useQuery({
    queryKey: ['inactive-members', gymOwnerId],
    queryFn: async () => {
      const { data: allMembers, error } = await supabase
        .from('members')
        .select('id, full_name, phone')
        .eq('user_id', gymOwnerId!)
        .eq('is_active', true);
      if (error) throw error;
      if (!allMembers?.length) return [];

      const { data: attendances } = await supabase
        .from('attendance')
        .select('member_id, attendance_date')
        .eq('user_id', gymOwnerId!)
        .order('attendance_date', { ascending: false });

      const latestByMember = new Map<string, string>();
      attendances?.forEach((a: { member_id: string; attendance_date: string }) => {
        if (!latestByMember.has(a.member_id)) {
          latestByMember.set(a.member_id, a.attendance_date);
        }
      });

      const now = new Date();
      const inactive: InactiveMember[] = [];
      allMembers.forEach((m) => {
        const lastDate = latestByMember.get(m.id);
        if (lastDate) {
          const days = differenceInDays(now, new Date(lastDate));
          if (days > 5) {
            inactive.push({
              id: m.id,
              full_name: m.full_name,
              phone: m.phone,
              lastAttendance: lastDate,
              daysAbsent: days,
            });
          }
        }
      });
      return inactive.sort((a, b) => b.daysAbsent - a.daysAbsent);
    },
    enabled: !!gymOwnerId,
  });

  const { data: todayReminders = [] } = useQuery({
    queryKey: ['reminder-logs-today', gymOwnerId, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('reminder_logs')
        .select('member_id')
        .eq('user_id', gymOwnerId!)
        .eq('reminder_type', 'inactive')
        .eq('sent_date', today);
      return data?.map((r: { member_id: string }) => r.member_id) || [];
    },
    enabled: !!gymOwnerId,
  });

  const markAttendance = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from('attendance').insert({
        member_id: memberId,
        user_id: gymOwnerId!,
        attendance_date: today,
      });
      if (error) {
        if (error.code === '23505') throw new Error('Attendance already marked for today');
        throw error;
      }
      await logActivity({ action_type: 'attendance_marked', description: 'Marked attendance', entity_type: 'member', entity_id: memberId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-today-dashboard'] });
      toast.success('Attendance marked ✅');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeAttendance = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('member_id', memberId)
        .eq('user_id', gymOwnerId!)
        .eq('attendance_date', today);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-today-dashboard'] });
      toast.success('Attendance removed');
    },
    onError: () => toast.error('Failed to remove attendance'),
  });

  const sendReminder = useMutation({
    mutationFn: async (member: InactiveMember) => {
      if (!member.phone) throw new Error('No phone number for this member');
      const gymName = profile?.gym_name || 'Your Gym';
      const message = buildInactiveReminderMessage({
        name: member.full_name,
        daysAbsent: member.daysAbsent,
        gymName,
      });
      const { error } = await supabase.from('reminder_logs').insert({
        member_id: member.id,
        user_id: gymOwnerId!,
        reminder_type: 'inactive',
        sent_date: today,
      });
      if (error) {
        if (error.code === '23505') throw new Error('Reminder already sent today');
        throw error;
      }
      openWhatsApp(member.phone, message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder-logs-today'] });
      toast.success('Reminder sent ✅');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filtered = members.filter(
    (m) =>
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (m.phone && m.phone.includes(search)) ||
      (m.member_code && m.member_code.toLowerCase().includes(search.toLowerCase()))
  );

  // Sort: present members at top
  const sorted = [...filtered].sort((a, b) => {
    const aPresent = todayAttendance.includes(a.id) ? 1 : 0;
    const bPresent = todayAttendance.includes(b.id) ? 1 : 0;
    return bPresent - aPresent;
  });

  const presentCount = todayAttendance.length;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
            <p className="text-muted-foreground text-sm">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-sm px-3 py-1.5">
              <UserCheck className="h-4 w-4 mr-1.5" />
              {presentCount} Present Today
            </Badge>
            <Badge variant="outline" className="text-sm px-3 py-1.5">
              {members.length} Total
            </Badge>
          </div>
        </div>

        {/* Progress bar */}
        {members.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Today's attendance</span>
              <span>{Math.round((presentCount / members.length) * 100)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${(presentCount / members.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone or member ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Members List */}
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Loading members...</p>
        ) : sorted.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            {search ? 'No members found' : 'No active members'}
          </p>
        ) : (
          <div className="grid gap-2">
            {sorted.map((member) => {
              const isPresent = todayAttendance.includes(member.id);
              return (
                <Card
                  key={member.id}
                  className={isPresent
                    ? 'border-green-500/40 bg-green-500/5'
                    : 'hover:border-primary/30 transition-colors'
                  }
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        isPresent
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {member.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground">{member.full_name}</p>
                          {member.member_code && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 font-mono text-primary border-primary/30"
                            >
                              {member.member_code}
                            </Badge>
                          )}
                        </div>
                        {member.phone && (
                          <p className="text-sm text-muted-foreground">{member.phone}</p>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    {isPresent ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="bg-green-600 hover:bg-green-600 text-white">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Present
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                          onClick={() => removeAttendance.mutate(member.id)}
                          disabled={removeAttendance.isPending}
                          title="Undo attendance"
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="shrink-0"
                        onClick={() => markAttendance.mutate(member.id)}
                        disabled={markAttendance.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Mark
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Inactive Members Alert */}
        {inactiveMembers.length > 0 && (
          <Card className="glass-card border-destructive/20 overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(0,72%,50%)] to-[hsl(38,92%,50%)]" />
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <UserX className="h-5 w-5 text-destructive" />
                <CardTitle>Inactive Members</CardTitle>
              </div>
              <Badge variant="destructive">{inactiveMembers.length}</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Members who haven't visited in more than 5 days
              </p>
              <div className="space-y-3">
                {inactiveMembers.map((member) => {
                  const alreadySent = todayReminders.includes(member.id);
                  return (
                    <div
                      key={member.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-border last:border-0"
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{member.full_name}</p>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <span>{member.daysAbsent} days absent</span>
                          <span>•</span>
                          <span>Last: {format(new Date(member.lastAttendance), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                      {member.phone ? (
                        alreadySent ? (
                          <Badge variant="secondary" className="w-fit">
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Sent Today
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-fit border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                            onClick={() => sendReminder.mutate(member)}
                            disabled={sendReminder.isPending}
                          >
                            <MessageCircle className="h-4 w-4 mr-1" />
                            Send WhatsApp Reminder
                          </Button>
                        )
                      ) : (
                        <Badge variant="outline" className="w-fit text-muted-foreground">
                          No phone number
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}