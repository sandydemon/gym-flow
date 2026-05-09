import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGymOwnerId } from '@/hooks/useGymOwnerId';
import { logActivity } from '@/lib/activityLog';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Wallet, Trash2, Edit } from 'lucide-react';
import { format } from 'date-fns';
import ExpenseFormDialog, { ExpenseFormValues } from '@/components/expenses/ExpenseFormDialog';

const CATEGORIES = ['Rent', 'Electricity', 'Water', 'Equipment', 'Maintenance', 'Salary', 'Other'];

interface Expense {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
  is_recurring: boolean;
}

export default function Expenses() {
  const { user } = useAuth();
  const gymOwnerId = useGymOwnerId();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('All');

  const fetchExpenses = async () => {
    if (!gymOwnerId) return;
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', gymOwnerId!)
      .order('expense_date', { ascending: false });
    setExpenses((data as Expense[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, [gymOwnerId]);

  const handleSubmit = async (form: ExpenseFormValues) => {
    if (!gymOwnerId) return;
    const payload = {
      user_id: gymOwnerId!,
      category: form.category,
      description: form.description || null,
      amount: parseFloat(form.amount),
      expense_date: form.expense_date,
      is_recurring: form.is_recurring,
    };

    if (editingExpense) {
      await supabase.from('expenses').update(payload).eq('id', editingExpense.id);
      await logActivity({ action_type: 'expense_updated', description: `Updated expense ${form.category} - PKR ${payload.amount}`, entity_type: 'expense', entity_id: editingExpense.id });
      toast({ title: 'Expense updated' });
    } else {
      await supabase.from('expenses').insert(payload);
      await logActivity({ action_type: 'expense_added', description: `Added expense ${form.category} - PKR ${payload.amount}`, entity_type: 'expense' });
      toast({ title: 'Expense added' });
    }
    setDialogOpen(false);
    setEditingExpense(null);
    fetchExpenses();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id);
    toast({ title: 'Expense deleted' });
    fetchExpenses();
  };

  const handleEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setDialogOpen(true);
  };

  const filtered = filterCategory === 'All' ? expenses : expenses.filter(e => e.category === filterCategory);
  const totalExpenses = filtered.reduce((sum, e) => sum + Number(e.amount), 0);
  const currentMonth = format(new Date(), 'yyyy-MM');
  const monthlyTotal = expenses.filter(e => e.expense_date.startsWith(currentMonth)).reduce((s, e) => s + Number(e.amount), 0);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--chart-4))] to-[hsl(var(--destructive))] shadow-lg">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Expenses</h1>
              <p className="text-sm text-muted-foreground">Track your gym expenses</p>
            </div>
          </div>
          <ExpenseFormDialog
            open={dialogOpen}
            onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingExpense(null); }}
            initial={editingExpense ? {
              category: editingExpense.category,
              description: editingExpense.description || '',
              amount: String(editingExpense.amount),
              expense_date: editingExpense.expense_date,
              is_recurring: editingExpense.is_recurring,
            } : null}
            isEditing={!!editingExpense}
            onSubmit={handleSubmit}
            trigger
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="glass-card">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold text-destructive">PKR {monthlyTotal.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Shown</p>
              <p className="text-2xl font-bold">PKR {totalExpenses.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Records</p>
              <p className="text-2xl font-bold">{filtered.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <Label>Filter:</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="glass-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Recurring</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No expenses found</TableCell></TableRow>
                ) : filtered.map(exp => (
                  <TableRow key={exp.id}>
                    <TableCell>{format(new Date(exp.expense_date), 'dd MMM yyyy')}</TableCell>
                    <TableCell><Badge variant="secondary">{exp.category}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{exp.description || '-'}</TableCell>
                    <TableCell className="font-semibold text-destructive">PKR {Number(exp.amount).toLocaleString()}</TableCell>
                    <TableCell>{exp.is_recurring ? <Badge className="bg-primary/20 text-primary">Yes</Badge> : '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(exp)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(exp.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
