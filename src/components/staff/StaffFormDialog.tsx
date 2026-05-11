import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';

const ROLES = ['Trainer', 'Receptionist', 'Cleaner', 'Manager', 'Other'];

export interface StaffFormValues {
  full_name: string;
  phone: string;
  role: string;
  salary: string;
  joining_date: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<StaffFormValues> | null;
  isEditing?: boolean;
  onSubmit: (values: StaffFormValues) => Promise<void> | void;
  trigger?: boolean;
}

const empty: StaffFormValues = {
  full_name: '',
  phone: '',
  role: 'Trainer',
  salary: '',
  joining_date: format(new Date(), 'yyyy-MM-dd'),
};

export default function StaffFormDialog({ open, onOpenChange, initial, isEditing, onSubmit, trigger }: Props) {
  const [form, setForm] = useState<StaffFormValues>(empty);

  useEffect(() => {
    if (open) {
      setForm({ ...empty, ...(initial || {}) });
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && (
        <DialogTrigger asChild>
          <Button className="gap-2 rounded-xl"><Plus className="h-4 w-4" /> Add Staff</Button>
        </DialogTrigger>
      )}
      <DialogContent className="border-border/50 bg-card/95 shadow-lg backdrop-blur-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Staff' : 'Add Staff'}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEditing ? 'Update existing staff information' : 'Add new staff member to gym'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>Full Name</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div>
            <Label>Role</Label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Salary (PKR)</Label><Input type="number" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} /></div>
          <div><Label>Joining Date</Label><Input type="date" value={form.joining_date} onChange={e => setForm(f => ({ ...f, joining_date: e.target.value }))} /></div>
          <Button
            className="w-full rounded-xl"
            onClick={async () => { await onSubmit(form); }}
            disabled={!form.full_name || !form.salary}
          >
            {isEditing ? 'Update' : 'Add'} Staff
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
