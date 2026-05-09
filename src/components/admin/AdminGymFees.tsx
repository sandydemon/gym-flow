import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Calendar, CheckCircle, RefreshCw, ChevronLeft, ChevronRight, Pencil, Save, X } from 'lucide-react';
import { format, subMonths, startOfMonth, addMonths } from 'date-fns';

interface GymFee {
  id: string;
  gym_id: string;
  month: string;
  amount: number;
  status: string;
  payment_date: string | null;
  gym_name: string;
  gym_email: string;
}

interface AdminGymFeesProps {
  onDataChange?: () => void;
}

export default function AdminGymFees({ onDataChange }: AdminGymFeesProps) {
  const [fees, setFees] = useState<GymFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadFees();
  }, [selectedMonth]);

  const loadFees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gym_fees')
        .select(`
          id,
          gym_id,
          month,
          amount,
          status,
          payment_date,
          gyms (
            gym_name,
            gym_email
          )
        `)
        .eq('month', selectedMonth)
        .order('status', { ascending: true });

      if (error) throw error;

      const formattedFees = data?.map((fee: any) => ({
        id: fee.id,
        gym_id: fee.gym_id,
        month: fee.month,
        amount: fee.amount,
        status: fee.status,
        payment_date: fee.payment_date,
        gym_name: fee.gyms?.gym_name || 'Unknown',
        gym_email: fee.gyms?.gym_email || 'Unknown',
      })) || [];

      setFees(formattedFees);
    } catch (error: any) {
      console.error('Error loading fees:', error);
      toast({
        title: "Error",
        description: "Failed to load gym fees",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyFees = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase
        .rpc('generate_monthly_gym_fees', { p_month: selectedMonth });

      if (error) throw error;

      toast({
        title: "Fees Generated",
        description: `Generated ${data} pending fee(s) for ${format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}`,
      });

      loadFees();
      onDataChange?.();
    } catch (error: any) {
      console.error('Error generating fees:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate fees",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const markAsPaid = async (feeId: string) => {
    try {
      const { error } = await supabase
        .from('gym_fees')
        .update({
          status: 'Paid',
          payment_date: format(new Date(), 'yyyy-MM-dd'),
        })
        .eq('id', feeId);

      if (error) throw error;

      toast({
        title: "Fee Collected",
        description: "Payment marked as received",
      });

      loadFees();
      onDataChange?.();
    } catch (error: any) {
      console.error('Error marking fee as paid:', error);
      toast({
        title: "Error",
        description: "Failed to update fee status",
        variant: "destructive",
      });
    }
  };

  const markAsPending = async (feeId: string) => {
    try {
      const { error } = await supabase
        .from('gym_fees')
        .update({
          status: 'Pending',
          payment_date: null,
        })
        .eq('id', feeId);

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: "Payment marked as pending",
      });

      loadFees();
      onDataChange?.();
    } catch (error: any) {
      console.error('Error updating fee:', error);
      toast({
        title: "Error",
        description: "Failed to update fee status",
        variant: "destructive",
      });
    }
  };

  const startEditFee = (fee: GymFee) => {
    setEditingFeeId(fee.id);
    setEditAmount(fee.amount.toString());
  };

  const cancelEdit = () => {
    setEditingFeeId(null);
    setEditAmount('');
  };

  const saveEditFee = async (feeId: string) => {
    const newAmount = parseFloat(editAmount);
    if (isNaN(newAmount) || newAmount < 0) {
      toast({ title: "Error", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase
        .from('gym_fees')
        .update({ amount: newAmount })
        .eq('id', feeId);
      if (error) throw error;
      toast({ title: "Updated", description: "Fee amount updated successfully" });
      setEditingFeeId(null);
      setEditAmount('');
      loadFees();
      onDataChange?.();
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to update fee amount", variant: "destructive" });
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const currentDate = new Date(selectedMonth + '-01');
    const newDate = direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1);
    setSelectedMonth(format(newDate, 'yyyy-MM'));
  };

  const pendingFees = fees.filter(f => f.status === 'Pending');
  const paidFees = fees.filter(f => f.status === 'Paid');
  const totalPending = pendingFees.reduce((sum, f) => sum + f.amount, 0);
  const totalCollected = paidFees.reduce((sum, f) => sum + f.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Gym Fee Collection
          </h2>
          <p className="text-muted-foreground text-sm">Manage monthly subscription fees from gyms</p>
        </div>
        <Button onClick={generateMonthlyFees} disabled={generating}>
          <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
          Generate Fees
        </Button>
      </div>

      {/* Month Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 max-w-xs">
              <Label className="text-sm text-muted-foreground block text-center mb-2">Selected Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue>
                    {format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const date = subMonths(startOfMonth(new Date()), i);
                    const value = format(date, 'yyyy-MM');
                    return (
                      <SelectItem key={value} value={value}>
                        {format(date, 'MMMM yyyy')}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Fees</p>
            <p className="text-2xl font-bold">PKR {(totalPending + totalCollected).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{fees.length} gym(s)</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-destructive">PKR {totalPending.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{pendingFees.length} pending</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Collected</p>
            <p className="text-2xl font-bold text-primary">PKR {totalCollected.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{paidFees.length} paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Fees Table */}
      <Card>
        <CardHeader>
          <CardTitle>Fee Records</CardTitle>
          <CardDescription>
            {format(new Date(selectedMonth + '-01'), 'MMMM yyyy')} - {fees.length} record(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading fees...</div>
          ) : fees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No fees for this month. Click "Generate Fees" to create pending fees for active gyms.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gym</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fees.map((fee) => (
                    <TableRow key={fee.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{fee.gym_name}</div>
                          <div className="text-xs text-muted-foreground">{fee.gym_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingFeeId === fee.id ? (
                          <Input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-28"
                            onKeyDown={(e) => e.key === 'Enter' && saveEditFee(fee.id)}
                          />
                        ) : (
                          <span>PKR {fee.amount.toLocaleString()}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={fee.status === 'Paid' ? 'default' : 'destructive'}>
                          {fee.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {fee.payment_date ? format(new Date(fee.payment_date), 'MMM dd, yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {editingFeeId === fee.id ? (
                            <>
                              <Button size="sm" onClick={() => saveEditFee(fee.id)}>
                                <Save className="w-4 h-4 mr-1" />
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEdit}>
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => startEditFee(fee)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {fee.status === 'Pending' ? (
                                <Button size="sm" onClick={() => markAsPaid(fee.id)}>
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Mark Paid
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" onClick={() => markAsPending(fee.id)}>
                                  Mark Pending
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
