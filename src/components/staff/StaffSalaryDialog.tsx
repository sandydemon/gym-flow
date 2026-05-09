import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { format, subMonths } from 'date-fns';
import { CheckCircle2, Wallet } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string | null;
  staffName: string;
  baseSalary: number;
}

interface SalaryRow {
  id: string;
  month: string;
  base_salary: number;
  advance_amount: number;
  deduction_amount: number;
  net_paid: number;
  status: string;
  payment_date: string | null;
  payment_method: string | null;
}

interface AdvanceRow {
  id: string;
  amount: number;
  advance_date: string;
  deducted_amount: number;
  is_settled: boolean;
  notes: string | null;
}

const PAYMENT_METHODS = ['Cash', 'EasyPaisa', 'JazzCash', 'Bank Transfer'];

export default function StaffSalaryDialog({ open, onOpenChange, staffId, staffName, baseSalary }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [salaries, setSalaries] = useState<SalaryRow[]>([]);
  const [advances, setAdvances] = useState<AdvanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Pay form
  const [payMonth, setPayMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [deduction, setDeduction] = useState('0');
  const [advanceUsed, setAdvanceUsed] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  // Advance form
  const [advAmount, setAdvAmount] = useState('');
  const [advNotes, setAdvNotes] = useState('');

  const fetchData = async () => {
    if (!user || !staffId) return;
    setLoading(true);
    const sixMonthsAgo = format(subMonths(new Date(), 5), 'yyyy-MM');
    const [salRes, advRes] = await Promise.all([
      supabase.from('staff_salaries').select('*').eq('user_id', user.id).eq('staff_id', staffId).gte('month', sixMonthsAgo).order('month', { ascending: false }),
      supabase.from('staff_advances').select('*').eq('user_id', user.id).eq('staff_id', staffId).order('advance_date', { ascending: false }),
    ]);
    setSalaries((salRes.data as SalaryRow[]) || []);
    setAdvances((advRes.data as AdvanceRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open && staffId) {
      fetchData();
      setPayMonth(format(new Date(), 'yyyy-MM'));
      setDeduction('0');
      setAdvanceUsed('0');
      setPaymentMethod('Cash');
      setAdvAmount('');
      setAdvNotes('');
    }
  }, [open, staffId]);

  const outstandingAdvance = advances
    .filter(a => !a.is_settled)
    .reduce((s, a) => s + (Number(a.amount) - Number(a.deducted_amount)), 0);

  const markPaid = async () => {
    if (!user || !staffId) return;
    const ded = parseFloat(deduction) || 0;
    const adv = parseFloat(advanceUsed) || 0;
    const net = Math.max(0, Number(baseSalary) - ded - adv);

    // Upsert salary record for the month
    const existing = salaries.find(s => s.month === payMonth);
    const payload = {
      user_id: user.id,
      staff_id: staffId,
      month: payMonth,
      base_salary: Number(baseSalary),
      advance_amount: adv,
      deduction_amount: ded,
      net_paid: net,
      status: 'Paid',
      payment_date: format(new Date(), 'yyyy-MM-dd'),
      payment_method: paymentMethod,
    };

    if (existing) {
      const { error } = await supabase.from('staff_salaries').update(payload).eq('id', existing.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { error } = await supabase.from('staff_salaries').insert(payload);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    }

    // Apply advance deductions to oldest unsettled advances
    if (adv > 0) {
      let remaining = adv;
      const unsettled = advances.filter(a => !a.is_settled).sort((a, b) => a.advance_date.localeCompare(b.advance_date));
      for (const a of unsettled) {
        if (remaining <= 0) break;
        const owed = Number(a.amount) - Number(a.deducted_amount);
        const apply = Math.min(owed, remaining);
        const newDeducted = Number(a.deducted_amount) + apply;
        const settled = newDeducted >= Number(a.amount);
        await supabase.from('staff_advances').update({ deducted_amount: newDeducted, is_settled: settled }).eq('id', a.id);
        remaining -= apply;
      }
    }

    toast({ title: 'Salary marked as paid', description: `Net: PKR ${net.toLocaleString()}` });
    fetchData();
  };

  const addAdvance = async () => {
    if (!user || !staffId) return;
    const amount = parseFloat(advAmount);
    if (!amount || amount <= 0) { toast({ title: 'Enter valid amount', variant: 'destructive' }); return; }
    const { error } = await supabase.from('staff_advances').insert({
      user_id: user.id,
      staff_id: staffId,
      amount,
      advance_date: format(new Date(), 'yyyy-MM-dd'),
      notes: advNotes || null,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Advance recorded' });
    setAdvAmount(''); setAdvNotes('');
    fetchData();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border/50 bg-card/95 shadow-lg backdrop-blur-xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" /> Salary — {staffName}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mb-2">
          <div className="rounded-lg border border-border/50 p-3">
            <p className="text-xs text-muted-foreground">Monthly Base</p>
            <p className="text-lg font-bold">PKR {Number(baseSalary).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-border/50 p-3">
            <p className="text-xs text-muted-foreground">Outstanding Advance</p>
            <p className="text-lg font-bold text-warning">PKR {outstandingAdvance.toLocaleString()}</p>
          </div>
        </div>

        <Tabs defaultValue="pay">
          <TabsList className="w-full">
            <TabsTrigger value="pay" className="flex-1">Mark Paid</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">History (6 mo)</TabsTrigger>
            <TabsTrigger value="advance" className="flex-1">Advances</TabsTrigger>
          </TabsList>

          <TabsContent value="pay" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Month</Label><Input type="month" value={payMonth} onChange={e => setPayMonth(e.target.value)} /></div>
              <div>
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Deduction (PKR)</Label><Input type="number" min="0" value={deduction} onChange={e => setDeduction(e.target.value)} /></div>
              <div>
                <Label>Advance Deduction (PKR)</Label>
                <Input type="number" min="0" max={outstandingAdvance} value={advanceUsed} onChange={e => setAdvanceUsed(e.target.value)} />
                {outstandingAdvance > 0 && <p className="text-xs text-muted-foreground mt-1">Max: PKR {outstandingAdvance.toLocaleString()}</p>}
              </div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3">
              <div className="flex justify-between text-sm"><span>Base</span><span>PKR {Number(baseSalary).toLocaleString()}</span></div>
              <div className="flex justify-between text-sm text-destructive"><span>− Deduction</span><span>PKR {(parseFloat(deduction) || 0).toLocaleString()}</span></div>
              <div className="flex justify-between text-sm text-warning"><span>− Advance</span><span>PKR {(parseFloat(advanceUsed) || 0).toLocaleString()}</span></div>
              <div className="flex justify-between font-bold mt-2 pt-2 border-t border-border/50"><span>Net Pay</span><span className="text-success">PKR {Math.max(0, Number(baseSalary) - (parseFloat(deduction) || 0) - (parseFloat(advanceUsed) || 0)).toLocaleString()}</span></div>
            </div>
            <Button onClick={markPaid} className="w-full gap-2"><CheckCircle2 className="h-4 w-4" /> Mark Salary Paid</Button>
          </TabsContent>

          <TabsContent value="history">
            {loading ? <p className="text-center py-6 text-muted-foreground">Loading...</p> :
              salaries.length === 0 ? <p className="text-center py-6 text-muted-foreground">No salary records yet</p> :
              <div className="space-y-2">
                {salaries.map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div>
                      <p className="font-medium">{format(new Date(s.month + '-01'), 'MMMM yyyy')}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.payment_date ? `Paid ${format(new Date(s.payment_date), 'dd MMM yyyy')}` : 'Not paid'}
                        {s.payment_method && ` • ${s.payment_method}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">PKR {Number(s.net_paid).toLocaleString()}</p>
                      <Badge className={s.status === 'Paid' ? 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]' : 'bg-warning/20 text-warning'}>{s.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>}
          </TabsContent>

          <TabsContent value="advance" className="space-y-3">
            <div className="rounded-lg border border-border/50 p-3 space-y-3">
              <p className="text-sm font-medium">Give New Advance</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Amount (PKR)" value={advAmount} onChange={e => setAdvAmount(e.target.value)} />
                <Input placeholder="Notes (optional)" value={advNotes} onChange={e => setAdvNotes(e.target.value)} />
              </div>
              <Button onClick={addAdvance} variant="outline" className="w-full">Record Advance</Button>
            </div>
            {advances.length === 0 ? <p className="text-center py-4 text-muted-foreground text-sm">No advances</p> :
              <div className="space-y-2">
                {advances.map(a => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div>
                      <p className="font-medium">PKR {Number(a.amount).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(a.advance_date), 'dd MMM yyyy')} {a.notes && `• ${a.notes}`}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Recovered: PKR {Number(a.deducted_amount).toLocaleString()}</p>
                      <Badge className={a.is_settled ? 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]' : 'bg-warning/20 text-warning'}>{a.is_settled ? 'Settled' : 'Pending'}</Badge>
                    </div>
                  </div>
                ))}
              </div>}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
