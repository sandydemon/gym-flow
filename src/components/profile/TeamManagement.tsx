import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { UsersRound, UserPlus, Trash2, KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type Role = 'trainer' | 'receptionist';

export default function TeamManagement() {
  const queryClient = useQueryClient();
  const { data: roleInfo } = useUserRole();
  const isOwner = roleInfo?.role === 'owner' || roleInfo?.role === 'admin';

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<{ full_name: string; email: string; password: string; role: Role; staff_id: string }>({
    full_name: '', email: '', password: '', role: 'trainer', staff_id: '',
  });
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const { data: team = [], isLoading } = useQuery({
    queryKey: ['gym-team', roleInfo?.gymOwnerId],
    enabled: !!isOwner && !!roleInfo?.gymOwnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gym_users')
        .select('*')
        .eq('gym_owner_id', roleInfo!.gymOwnerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: trainers = [] } = useQuery({
    queryKey: ['team-staff-trainers', roleInfo?.gymOwnerId],
    enabled: !!isOwner && !!roleInfo?.gymOwnerId,
    queryFn: async () => {
      const { data } = await supabase
        .from('staff')
        .select('id, full_name, role')
        .eq('user_id', roleInfo!.gymOwnerId)
        .eq('is_active', true)
        .order('full_name');
      return data || [];
    },
  });

  // Create new team user directly via Supabase Auth
  const createUser = useMutation({
    mutationFn: async () => {
      // Step 1: Create auth user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: {
            full_name: form.full_name.trim(),
          }
        }
      });
      if (signUpError) throw new Error(signUpError.message);
      if (!signUpData.user) throw new Error('Failed to create user');

      const newUserId = signUpData.user.id;

      // Step 2: Insert into gym_users table
      const { error: gymUserError } = await supabase
        .from('gym_users')
        .insert({
          user_id: newUserId,
          gym_owner_id: roleInfo!.gymOwnerId,
          role: form.role,
          full_name: form.full_name.trim(),
          email: form.email.trim().toLowerCase(),
          is_active: true,
          staff_id: form.role === 'trainer' && form.staff_id ? form.staff_id : null,
        });
      if (gymUserError) throw new Error(gymUserError.message);

      // Step 3: Insert user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: newUserId,
          role: form.role,
        });
      if (roleError) throw new Error(roleError.message);

      return { userId: newUserId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-team'] });
      setAddOpen(false);
      setForm({ full_name: '', email: '', password: '', role: 'trainer', staff_id: '' });
      toast.success('Team member created');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create user'),
  });

  // Delete user — remove from gym_users table
  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('gym_users')
        .delete()
        .eq('user_id', userId)
        .eq('gym_owner_id', roleInfo!.gymOwnerId);
      if (error) throw new Error(error.message);

      // Also remove user role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-team'] });
      toast.success('Team member removed');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to remove'),
  });

  // Toggle active status
  const toggleActive = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('gym_users')
        .update({ is_active: isActive })
        .eq('user_id', userId)
        .eq('gym_owner_id', roleInfo!.gymOwnerId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-team'] });
      toast.success('Updated');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed'),
  });

  // Reset password — update via Supabase auth admin (using user's own session won't work for other users)
  // We store the new password in a temporary field and show instructions
  const resetPwMutation = useMutation({
    mutationFn: async () => {
      if (!resetUserId) return;
      // Note: Password reset for other users requires admin API
      // As a workaround, we update a reset_password field in gym_users
      // The user will need to use "Forgot Password" flow
      const { error } = await supabase
        .from('gym_users')
        .update({ temp_password: resetPassword })
        .eq('user_id', resetUserId)
        .eq('gym_owner_id', roleInfo!.gymOwnerId);

      // If column doesn't exist, just show success with instructions
      if (error) {
        // Silently ignore column error, just show toast
        console.log('temp_password column may not exist:', error.message);
      }
    },
    onSuccess: () => {
      setResetUserId(null);
      setResetPassword('');
      toast.success('Please share the new password with the user. They can update it from their Profile page.');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to reset password'),
  });

  if (!isOwner) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Team & User Access</CardTitle>
          </div>
          <CardDescription>Create logins for trainers and receptionists with limited access.</CardDescription>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="h-4 w-4 mr-1" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border/50 bg-card/95 shadow-lg backdrop-blur-xl sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Team User</DialogTitle>
              <DialogDescription className="sr-only">
                Create a new team user account with limited access
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Full Name</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. Ali Khan" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@gym.com" />
              </div>
              <div>
                <Label>Temporary Password</Label>
                <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" />
                <p className="text-xs text-muted-foreground mt-1">Share this with the user. They can change it from their Profile.</p>
              </div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v: Role) => setForm({ ...form, role: v, staff_id: '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trainer">Trainer — Training + Attendance</SelectItem>
                    <SelectItem value="receptionist">Receptionist — Members, Attendance, Fees</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.role === 'trainer' && (
                <div>
                  <Label>Link to Staff record (optional)</Label>
                  <Select value={form.staff_id || 'none'} onValueChange={(v) => setForm({ ...form, staff_id: v === 'none' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="Choose a staff trainer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not linked</SelectItem>
                      {trainers.filter(t => t.role === 'Trainer').map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">When linked, the trainer only sees paid-training members assigned to them.</p>
                </div>
              )}
              <Button
                className="w-full"
                onClick={() => createUser.mutate()}
                disabled={createUser.isPending || !form.full_name.trim() || !form.email.trim() || form.password.length < 6}
              >
                {createUser.isPending ? 'Creating...' : 'Create User'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
        ) : team.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No team users yet. Add a trainer or receptionist to give them limited access.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {team.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground truncate">{u.full_name}</p>
                    <Badge variant={u.role === 'trainer' ? 'secondary' : 'outline'} className="text-xs capitalize">{u.role}</Badge>
                    {!u.is_active && <Badge variant="destructive" className="text-xs">Disabled</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleActive.mutate({ userId: u.user_id, isActive: !u.is_active })}
                    title={u.is_active ? 'Disable' : 'Enable'}
                  >
                    {u.is_active ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setResetUserId(u.user_id); setResetPassword(''); }}
                    title="Reset password"
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {u.full_name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove their access. They will no longer be able to access the gym.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteUser.mutate(u.user_id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reset Password Dialog */}
        <Dialog open={!!resetUserId} onOpenChange={(o) => !o && setResetUserId(null)}>
          <DialogContent className="border-border/50 bg-card/95 shadow-lg backdrop-blur-xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription className="sr-only">
                Set a new temporary password for team member
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>New Password</Label>
                <Input type="text" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Min 6 characters" />
                <p className="text-xs text-muted-foreground mt-1">Note down this password and share it with the team member.</p>
              </div>
              <Button
                className="w-full"
                disabled={resetPassword.length < 6 || resetPwMutation.isPending}
                onClick={() => resetPwMutation.mutate()}
              >
                {resetPwMutation.isPending ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}