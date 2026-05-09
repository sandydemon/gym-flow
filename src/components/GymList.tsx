import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Building2, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { z } from 'zod';

interface Gym {
  id: string;
  gym_name: string;
  gym_email: string;
  subscription_plan: string;
  subscription_amount: number;
  is_active: boolean;
  created_at: string;
  phone: string | null;
  address: string | null;
  owner_name: string | null;
}

interface GymListProps {
  onStatusChange?: () => void;
}

const editFormSchema = z.object({
  gym_name: z.string().trim().min(1, 'Gym name is required').max(100),
  gym_email: z.string().trim().email('Invalid email address').max(255),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  address: z.string().trim().max(255).optional().or(z.literal('')),
  owner_name: z.string().trim().max(100).optional().or(z.literal('')),
});

export default function GymList({ onStatusChange }: GymListProps) {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [editingGym, setEditingGym] = useState<Gym | null>(null);
  const [editForm, setEditForm] = useState({
    gym_name: '',
    gym_email: '',
    phone: '',
    address: '',
    owner_name: '',
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deletingGym, setDeletingGym] = useState<Gym | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadGyms();
  }, []);

  const loadGyms = async () => {
    try {
      const { data, error } = await supabase
        .from('gyms')
        .select('id, gym_name, gym_email, subscription_plan, subscription_amount, is_active, created_at, phone, address, owner_name')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGyms(data || []);
    } catch (error: any) {
      console.error('Error loading gyms:', error);
      toast({
        title: "Error",
        description: "Failed to load gyms",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleGymStatus = async (gymId: string, currentStatus: boolean) => {
    setUpdating(gymId);
    try {
      const { error } = await supabase
        .from('gyms')
        .update({ is_active: !currentStatus })
        .eq('id', gymId);

      if (error) throw error;

      setGyms(prev => prev.map(gym => 
        gym.id === gymId ? { ...gym, is_active: !currentStatus } : gym
      ));

      toast({
        title: "Status Updated",
        description: `Gym has been ${!currentStatus ? 'activated' : 'deactivated'}`,
      });

      onStatusChange?.();
    } catch (error: any) {
      console.error('Error updating gym status:', error);
      toast({
        title: "Error",
        description: "Failed to update gym status",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const openEditModal = (gym: Gym) => {
    setEditingGym(gym);
    setEditForm({
      gym_name: gym.gym_name,
      gym_email: gym.gym_email,
      phone: gym.phone || '',
      address: gym.address || '',
      owner_name: gym.owner_name || '',
    });
    setEditErrors({});
  };

  const closeEditModal = () => {
    setEditingGym(null);
    setEditForm({ gym_name: '', gym_email: '', phone: '', address: '', owner_name: '' });
    setEditErrors({});
  };

  const handleEditSubmit = async () => {
    if (!editingGym) return;

    // Validate form
    const result = editFormSchema.safeParse(editForm);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message;
        }
      });
      setEditErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('gyms')
        .update({
          gym_name: editForm.gym_name.trim(),
          gym_email: editForm.gym_email.trim(),
          phone: editForm.phone.trim() || null,
          address: editForm.address.trim() || null,
          owner_name: editForm.owner_name.trim() || null,
        })
        .eq('id', editingGym.id);

      if (error) throw error;

      setGyms(prev => prev.map(gym => 
        gym.id === editingGym.id 
          ? { 
              ...gym, 
              gym_name: editForm.gym_name.trim(),
              gym_email: editForm.gym_email.trim(),
              phone: editForm.phone.trim() || null,
              address: editForm.address.trim() || null,
              owner_name: editForm.owner_name.trim() || null,
            } 
          : gym
      ));

      toast({
        title: "Gym Updated",
        description: "Gym details have been updated successfully",
      });

      closeEditModal();
      onStatusChange?.();
    } catch (error: any) {
      console.error('Error updating gym:', error);
      toast({
        title: "Error",
        description: "Failed to update gym details",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGym = async () => {
    if (!deletingGym) return;
    setDeleting(true);
    try {
      // Delete related gym_fees first
      await supabase.from('gym_fees').delete().eq('gym_id', deletingGym.id);
      
      const { error } = await supabase.from('gyms').delete().eq('id', deletingGym.id);
      if (error) throw error;

      setGyms(prev => prev.filter(g => g.id !== deletingGym.id));
      toast({ title: "Gym Deleted", description: `${deletingGym.gym_name} has been removed` });
      setDeletingGym(null);
      onStatusChange?.();
    } catch (error: any) {
      console.error('Error deleting gym:', error);
      toast({ title: "Error", description: "Failed to delete gym", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const activeGyms = gyms.filter(g => g.is_active).length;
  const inactiveGyms = gyms.filter(g => !g.is_active).length;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                All Gyms
              </CardTitle>
              <CardDescription>
                Manage all onboarded gyms and their status
              </CardDescription>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>{activeGyms} Active</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-muted-foreground"></div>
                <span>{inactiveGyms} Inactive</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading gyms...</div>
          ) : gyms.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No gyms onboarded yet. Use the onboarding form to add gyms.
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="space-y-3 md:hidden">
                {gyms.map((gym) => (
                  <div key={gym.id} className={`rounded-lg border border-border p-4 space-y-3 ${!gym.is_active ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{gym.gym_name}</span>
                      <Badge variant={gym.is_active ? 'default' : 'secondary'}>
                        {gym.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>{gym.gym_email}</p>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">{gym.subscription_plan}</Badge>
                        <span className="font-medium text-foreground">PKR {gym.subscription_amount.toLocaleString()}</span>
                      </div>
                      <p>Joined: {format(new Date(gym.created_at), 'MMM dd, yyyy')}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Active</span>
                        <Switch
                          checked={gym.is_active}
                          onCheckedChange={() => toggleGymStatus(gym.id, gym.is_active)}
                          disabled={updating === gym.id}
                        />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(gym)}>
                        <Pencil className="w-4 h-4 mr-1" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeletingGym(gym)}>
                        <Trash2 className="w-4 h-4 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gym Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gyms.map((gym) => (
                      <TableRow key={gym.id} className={!gym.is_active ? 'opacity-60' : ''}>
                        <TableCell className="font-medium">{gym.gym_name}</TableCell>
                        <TableCell>{gym.gym_email}</TableCell>
                        <TableCell><Badge variant="outline">{gym.subscription_plan}</Badge></TableCell>
                        <TableCell>PKR {gym.subscription_amount.toLocaleString()}</TableCell>
                        <TableCell>{format(new Date(gym.created_at), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>
                          <Badge variant={gym.is_active ? 'default' : 'secondary'}>
                            {gym.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={gym.is_active}
                            onCheckedChange={() => toggleGymStatus(gym.id, gym.is_active)}
                            disabled={updating === gym.id}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditModal(gym)}>
                              <Pencil className="w-4 h-4 mr-1" /> Edit
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeletingGym(gym)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Gym Modal */}
      <Dialog open={!!editingGym} onOpenChange={(open) => !open && closeEditModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Gym Details</DialogTitle>
            <DialogDescription>
              Update gym information. Subscription and status settings are not affected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="gym_name">Gym Name *</Label>
              <Input
                id="gym_name"
                value={editForm.gym_name}
                onChange={(e) => setEditForm(prev => ({ ...prev, gym_name: e.target.value }))}
                placeholder="Enter gym name"
              />
              {editErrors.gym_name && (
                <p className="text-sm text-destructive">{editErrors.gym_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="gym_email">Gym Email *</Label>
              <Input
                id="gym_email"
                type="email"
                value={editForm.gym_email}
                onChange={(e) => setEditForm(prev => ({ ...prev, gym_email: e.target.value }))}
                placeholder="Enter gym email"
              />
              {editErrors.gym_email && (
                <p className="text-sm text-destructive">{editErrors.gym_email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_name">Owner Name</Label>
              <Input
                id="owner_name"
                value={editForm.owner_name}
                onChange={(e) => setEditForm(prev => ({ ...prev, owner_name: e.target.value }))}
                placeholder="Enter owner name (optional)"
              />
              {editErrors.owner_name && (
                <p className="text-sm text-destructive">{editErrors.owner_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={editForm.phone}
                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="Enter phone number (optional)"
              />
              {editErrors.phone && (
                <p className="text-sm text-destructive">{editErrors.phone}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address / Area</Label>
              <Input
                id="address"
                value={editForm.address}
                onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter address or area (optional)"
              />
              {editErrors.address && (
                <p className="text-sm text-destructive">{editErrors.address}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditModal} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingGym} onOpenChange={(open) => !open && setDeletingGym(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Gym</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingGym?.gym_name}</strong>? This will also remove all fee records for this gym. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGym}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}