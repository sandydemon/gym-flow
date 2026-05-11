import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';

const CATEGORIES = ['Rent', 'Electricity', 'Water', 'Equipment', 'Maintenance', 'Salary', 'Other'];

export interface ExpenseFormValues {
  category: string;
  description: string;
  amount: string;
  expense_date: string;
  is_recurring: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<ExpenseFormValues> | null;
  isEditing?: boolean;
  onSubmit: (values: ExpenseFormValues) => Promise<void> | void;
  trigger?: boolean;
}

const empty: ExpenseFormValues = {
  category: 'Other',
  description: '',
  amount: '',
  expense_date: format(new Date(), 'yyyy-MM-dd'),
  is_recurring: false,
};

export default function ExpenseFormDialog({ open, onOpenChange, initial, isEditing, onSubmit, trigger }: Props) {
  const [form, setForm] = useState<ExpenseFormValues>(empty);

  useEffect(() => {
    if (open) {
      setForm({ ...empty, ...(initial || {}) });
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && (
        <DialogTrigger asChild>
          <Button className="gap-2 rounded-xl"><Plus className="h-4 w-4" /> Add Expense</Button>
        </DialogTrigger>
      )}
      <DialogContent className="border-border/50 bg-card/95 shadow-lg backdrop-blur-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEditing ? 'Update existing expense details' : 'Record new expense entry'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Category</Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amount (PKR)</Label>
            <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.is_recurring} onCheckedChange={v => setForm(f => ({ ...f, is_recurring: v }))} />
            <Label>Recurring Monthly</Label>
          </div>
          <Button
            className="w-full rounded-xl"
            onClick={async () => { await onSubmit(form); }}
            disabled={!form.amount}
          >
            {isEditing ? 'Update' : 'Add'} Expense
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
