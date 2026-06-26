import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { openWhatsApp, buildReminderMessage } from '@/lib/whatsapp';
import { useAuth } from '@/hooks/useAuth';
import { logActivity } from '@/lib/activityLog';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Receipt, Plus, ChevronLeft, ChevronRight, MessageCircle, RefreshCw, RotateCcw, Printer } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, isBefore, startOfDay } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { printReceipt } from '@/components/PrintReceipt';
import { useGymOwnerId } from '@/hooks/useGymOwnerId';

interface Member {
  id: string;
  full_name: string;
  phone: string | null;
  monthly_fee: number;
  admission_fee: number;
  admission_fee_paid: boolean;
  is_active: boolean;
  member_code?: string | null;
}

interface Fee {
  id: string;
  member_id: string;
  month: string;
  amount: number;
  status: 'Paid' | 'Pending';
  payment_date: string | null;
  payment_method: string | null;
}

interface FeeWithMember extends Fee {
  member: Member;
  includesAdmissionFee?: boolean;
}

const PAYMENT_METHODS = ['Cash', 'EasyPaisa', 'JazzCash', 'Bank Transfer'];

export default function Fees() {
  const { user } = useAuth();
  const gymOwnerId = useGymOwnerId();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [fees, setFees] = useState<FeeWithMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isGenerating, setIsGenerating] = useState(false);
  const [gymName, setGymName] = useState('Gym');
  const [gymLogoUrl, setGymLogoUrl] = useState<string | null>(null);
  const [gymPhone, setGymPhone] = useState<string | null>(null);
  const [gymAddress, setGymAddress] = useState<string | null>(null);

  // Payment dialog state
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingFee, setPayingFee] = useState<FeeWithMember | null>(null);
  const [payMethod, setPayMethod] = useState('Cash');

  useEffect(() => {
    if (gymOwnerId) {
      supabase.from('profiles').select('gym_name, logo_url').eq('user_id', gymOwnerId!).single()
        .then(({ data }) => {
          if (data?.gym_name) setGymName(data.gym_name);
          if (data?.logo_url) setGymLogoUrl(data.logo_url);
        });
      supabase.from('gyms').select('phone, address').eq('user_id', gymOwnerId!).maybeSingle()
        .then(({ data }) => {
          if (data?.phone) setGymPhone(data.phone);
          if (data?.address) setGymAddress(data.address);
        });
    }
  }, [gymOwnerId]);

  useEffect(() => {
    if (gymOwnerId) {
      fetchData();
    }
  }, [gymOwnerId, selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch members with admission fee info
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', gymOwnerId!)
        .order('full_name');

      if (membersError) throw membersError;
      setMembers(membersData || []);

      // Fetch fees for selected month
      const { data: feesData, error: feesError } = await supabase
        .from('monthly_fees')
        .select('*')
        .eq('user_id', gymOwnerId!)
        .eq('month', selectedMonth);

      if (feesError) throw feesError;

      // Combine fees with member data
      const feesWithMembers: FeeWithMember[] = (feesData || []).map((fee) => {
        const member = membersData?.find((m) => m.id === fee.member_id);
        const memberData = member || {
          id: fee.member_id,
          full_name: 'Unknown',
          phone: null,
          monthly_fee: fee.amount,
          admission_fee: 0,
          admission_fee_paid: true,
          is_active: false,
        };
        
        // Check if this fee includes admission fee (amount > monthly_fee and admission not paid)
        const includesAdmissionFee = member && 
          !member.admission_fee_paid && 
          member.admission_fee > 0 && 
          Number(fee.amount) > Number(member.monthly_fee);

        return {
          ...fee,
          status: fee.status as 'Paid' | 'Pending',
          member: memberData,
          includesAdmissionFee,
        };
      });

      setFees(feesWithMembers);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load fee data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Check if the selected month is in the future (beyond current month)
  const isFutureMonth = false;

  const generateMonthlyFees = async () => {
    if (isFutureMonth) {
      toast({
        title: 'Not Allowed',
        description: 'Fees can only be generated for the current or past months',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const activeMembers = members.filter((m) => m.is_active);
      
      if (activeMembers.length === 0) {
        toast({
          title: 'No Active Members',
          description: 'Add active members before generating fees',
          variant: 'destructive',
        });
        return;
      }

      // Get existing fees for this month
      const existingMemberIds = fees.map((f) => f.member_id);
      const membersWithoutFees = activeMembers.filter(
        (m) => !existingMemberIds.includes(m.id)
      );

      if (membersWithoutFees.length === 0) {
        toast({
          title: 'Fees Already Generated',
          description: 'All active members already have fees for this month',
        });
        return;
      }

      // Fetch all pending (unpaid) fees from previous months for these members
      const memberIds = membersWithoutFees.map((m) => m.id);
      const { data: pendingFees, error: pendingError } = await supabase
        .from('monthly_fees')
        .select('member_id, amount')
        .eq('user_id', gymOwnerId!)
        .eq('status', 'Pending')
        .in('member_id', memberIds)
        .lt('month', selectedMonth);

      if (pendingError) throw pendingError;

      // Calculate total pending amount per member
      const pendingByMember: Record<string, number> = {};
      (pendingFees || []).forEach((pf) => {
        pendingByMember[pf.member_id] = (pendingByMember[pf.member_id] || 0) + Number(pf.amount);
      });

      // Insert fees with previous pending amounts added
      const newFees = membersWithoutFees.map((member) => {
        const previousPending = pendingByMember[member.id] || 0;
        return {
          user_id: gymOwnerId!,
          member_id: member.id,
          month: selectedMonth,
          amount: Number(member.monthly_fee) + previousPending,
          status: 'Pending' as const,
        };
      });

      const { error } = await supabase.from('monthly_fees').insert(newFees);

      if (error) throw error;

      const membersWithCarryover = newFees.filter((f) => pendingByMember[f.member_id] > 0).length;
      const carryoverMsg = membersWithCarryover > 0 
        ? ` (${membersWithCarryover} member(s) have previous pending fees added)` 
        : '';

      toast({
        title: 'Success',
        description: `Generated ${newFees.length} fee record(s)${carryoverMsg}`,
      });
      fetchData();
    } catch (error: any) {
      console.error('Error generating fees:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate fees',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const regenerateFees = async () => {
    if (isFutureMonth) {
      toast({
        title: 'Not Allowed',
        description: 'Fees can only be generated for the current or past months',
        variant: 'destructive',
      });
      return;
    }

    // Only delete pending fees, not paid ones
    const pendingFeeIds = fees.filter(f => f.status === 'Pending').map(f => f.id);
    if (pendingFeeIds.length === 0 && fees.length > 0) {
      toast({
        title: 'Cannot Regenerate',
        description: 'All fees for this month are already paid',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Delete only pending fees for this month
      if (pendingFeeIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('monthly_fees')
          .delete()
          .eq('user_id', gymOwnerId!)
          .eq('month', selectedMonth)
          .eq('status', 'Pending');

        if (deleteError) throw deleteError;
      }

      // Now regenerate for active members who don't have a paid fee
      const paidMemberIds = fees.filter(f => f.status === 'Paid').map(f => f.member_id);
      const activeMembers = members.filter(m => m.is_active && !paidMemberIds.includes(m.id));

      if (activeMembers.length === 0) {
        toast({ title: 'No Fees to Generate', description: 'All active members already have paid fees' });
        fetchData();
        return;
      }

      const memberIds = activeMembers.map(m => m.id);
      const { data: pendingPrev } = await supabase
        .from('monthly_fees')
        .select('member_id, amount')
        .eq('user_id', gymOwnerId!)
        .eq('status', 'Pending')
        .in('member_id', memberIds)
        .lt('month', selectedMonth);

      const pendingByMember: Record<string, number> = {};
      (pendingPrev || []).forEach(pf => {
        pendingByMember[pf.member_id] = (pendingByMember[pf.member_id] || 0) + Number(pf.amount);
      });

      const newFees = activeMembers.map(member => ({
        user_id: gymOwnerId!,
        member_id: member.id,
        month: selectedMonth,
        amount: Number(member.monthly_fee) + (pendingByMember[member.id] || 0),
        status: 'Pending' as const,
      }));

      const { error } = await supabase.from('monthly_fees').insert(newFees);
      if (error) throw error;

      toast({
        title: 'Success',
        description: `Regenerated ${newFees.length} fee record(s)`,
      });
      fetchData();
    } catch (error: any) {
      console.error('Error regenerating fees:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to regenerate fees',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const openPayDialog = (fee: FeeWithMember) => {
    setPayingFee(fee);
    setPayMethod(fee.payment_method || 'Cash');
    setPayDialogOpen(true);
  };

  const reprintReceipt = (fee: FeeWithMember) => {
    if (!fee.payment_date) return;
    printReceipt({
      gymName,
      gymLogoUrl,
      gymPhone,
      gymAddress,
      receiptNo: `RCP-${fee.id.slice(0, 8).toUpperCase()}`,
      memberName: fee.member.full_name,
      memberCode: (fee.member as any).member_code || null,
      month: fee.month,
      amount: Number(fee.amount),
      paymentDate: fee.payment_date,
      paymentMethod: fee.payment_method || 'Cash',
    });
  };

  const togglePaymentStatus = async (fee: FeeWithMember, method?: string) => {
    const newStatus = fee.status === 'Paid' ? 'Pending' : 'Paid';
    const paymentDate = newStatus === 'Paid' ? format(new Date(), 'yyyy-MM-dd') : null;
    const usedMethod = newStatus === 'Paid' ? (method || 'Cash') : null;

    try {
      // Check if this is the first payment and admission fee hasn't been paid
      const member = members.find(m => m.id === fee.member_id);
      const shouldChargeAdmissionFee = member && 
        !member.admission_fee_paid && 
        member.admission_fee > 0 && 
        newStatus === 'Paid';

      // Calculate total amount if marking as paid with admission fee
      let newAmount = Number(fee.member.monthly_fee);
      if (shouldChargeAdmissionFee) {
        newAmount = Number(member.monthly_fee) + Number(member.admission_fee);
      }

      // Update fee record
      const { error: feeError } = await supabase
        .from('monthly_fees')
        .update({
          status: newStatus,
          payment_date: paymentDate,
          payment_method: usedMethod,
          amount: newStatus === 'Paid' && shouldChargeAdmissionFee ? newAmount : fee.amount,
        })
        .eq('id', fee.id);

      if (feeError) throw feeError;
      await logActivity({
        action_type: newStatus === 'Paid' ? 'fee_collected' : 'fee_updated',
        description: `${newStatus === 'Paid' ? 'Collected' : 'Updated'} fee for ${fee.member?.full_name ?? 'member'} (${fee.month}) - PKR ${fee.amount}${usedMethod ? ' via ' + usedMethod : ''}`,
        entity_type: 'fee',
        entity_id: fee.id,
      });

      // If marking as paid, check if future months had this fee's amount carried forward and adjust them
      if (newStatus === 'Paid' && member) {
        const { data: futureFees } = await supabase
          .from('monthly_fees')
          .select('id, amount, month')
          .eq('user_id', gymOwnerId!)
          .eq('member_id', fee.member_id)
          .eq('status', 'Pending')
          .gt('month', fee.month)
          .order('month', { ascending: true })
          .limit(1);

        if (futureFees && futureFees.length > 0) {
          const futureFee = futureFees[0];
          // Recalculate: get all remaining pending fees before that future month
          const { data: remainingPending } = await supabase
            .from('monthly_fees')
            .select('amount')
            .eq('user_id', gymOwnerId!)
            .eq('member_id', fee.member_id)
            .eq('status', 'Pending')
            .lt('month', futureFee.month);

          const totalRemainingPending = (remainingPending || []).reduce((sum, f) => sum + Number(f.amount), 0);
          const correctedAmount = Number(member.monthly_fee) + totalRemainingPending;

          await supabase
            .from('monthly_fees')
            .update({ amount: correctedAmount })
            .eq('id', futureFee.id);
        }
      }

      // If marking as paid and admission fee was included, mark it as paid
      if (shouldChargeAdmissionFee) {
        const { error: memberError } = await supabase
          .from('members')
          .update({ admission_fee_paid: true })
          .eq('id', fee.member_id);

        if (memberError) throw memberError;

        toast({
          title: 'Success',
          description: `Payment marked as paid (includes admission fee: PKR ${Number(member.admission_fee).toLocaleString()})`,
        });
      } else if (newStatus === 'Pending' && fee.includesAdmissionFee) {
        // If unmarking payment that included admission fee, reset it
        const { error: memberError } = await supabase
          .from('members')
          .update({ admission_fee_paid: false })
          .eq('id', fee.member_id);

        if (memberError) throw memberError;

        // Reset amount back to monthly fee only
        await supabase
          .from('monthly_fees')
          .update({ amount: fee.member.monthly_fee })
          .eq('id', fee.id);

        toast({
          title: 'Success',
          description: 'Payment marked as pending (admission fee status reset)',
        });
      } else {
        toast({
          title: 'Success',
          description: `Payment marked as ${newStatus.toLowerCase()}`,
        });
      }

      // Auto-print receipt when marking as Paid
      if (newStatus === 'Paid' && member) {
        const finalAmount = shouldChargeAdmissionFee ? newAmount : Number(fee.amount);
        printReceipt({
          gymName,
          gymLogoUrl,
          gymPhone,
          gymAddress,
          receiptNo: `RCP-${fee.id.slice(0, 8).toUpperCase()}`,
          memberName: member.full_name,
          memberCode: (member as any).member_code || null,
          month: fee.month,
          amount: finalAmount,
          paymentDate: paymentDate!,
          paymentMethod: usedMethod || 'Cash',
          notes: shouldChargeAdmissionFee ? `Includes admission fee PKR ${Number(member.admission_fee).toLocaleString()}` : undefined,
        });
      }

      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update payment status',
        variant: 'destructive',
      });
    }
  };

  const sendWhatsAppReminder = (member: Member, month: string) => {
    if (!member.phone) {
      toast({
        title: 'No Phone Number',
        description: `No phone number for ${member.full_name}. Add it in Members page.`,
        variant: 'destructive',
      });
      return;
    }
    const dueDate = format(new Date(month + '-01'), 'dd MMMM yyyy');
    const message = buildReminderMessage({
      name: member.full_name,
      dueDate,
      gymName,
    });
    openWhatsApp(member.phone, message);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const currentDate = new Date(selectedMonth + '-01');
    const newDate = direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1);
    setSelectedMonth(format(newDate, 'yyyy-MM'));
  };

  // Calculate totals - only monthly fees for reports (not admission fees)
  const totalExpected = fees.reduce((sum, f) => sum + Number(f.member.monthly_fee), 0);
  const totalCollected = fees
    .filter((f) => f.status === 'Paid')
    .reduce((sum, f) => sum + Number(f.amount), 0);
  const totalPending = fees
    .filter((f) => f.status === 'Pending')
    .reduce((sum, f) => {
      // Show what will be charged when paid
      const member = members.find(m => m.id === f.member_id);
      if (member && !member.admission_fee_paid && member.admission_fee > 0) {
        return sum + Number(member.monthly_fee) + Number(member.admission_fee);
      }
      return sum + Number(f.amount);
    }, 0);

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Monthly Fees</h1>
            <p className="text-muted-foreground">Track and manage payment collection</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {fees.length > 0 && (
              <Button variant="outline" onClick={regenerateFees} disabled={isGenerating || isFutureMonth}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Regenerate
              </Button>
            )}
            <Button onClick={generateMonthlyFees} disabled={isGenerating || isFutureMonth}>
              <Plus className="mr-2 h-4 w-4" />
              {isGenerating ? 'Generating...' : 'Generate Fees'}
            </Button>
          </div>
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

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Expected (Monthly)</p>
              <p className="text-2xl font-bold">PKR {totalExpected.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Collected</p>
              <p className="text-2xl font-bold text-success">
                PKR {totalCollected.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Pending (incl. admission)</p>
              <p className="text-2xl font-bold text-warning">
                PKR {totalPending.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Fees Table */}
        <Card>
          <CardHeader>
            <CardTitle>Fee Records ({fees.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {fees.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium text-foreground mb-1">
                  No fee records
                </h3>
                <p className="text-muted-foreground mb-4">
                  Click "Generate Fees" to create fee records for active members
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="space-y-3 md:hidden">
                  {fees.map((fee) => {
                    const member = members.find(m => m.id === fee.member_id);
                    const pendingAdmissionFee = member && !member.admission_fee_paid && member.admission_fee > 0;
                    const displayAmount = fee.status === 'Paid' 
                      ? Number(fee.amount) 
                      : pendingAdmissionFee 
                        ? Number(member.monthly_fee) + Number(member.admission_fee)
                        : Number(fee.amount);

                    return (
                      <div key={fee.id} className="rounded-lg border border-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{fee.member.full_name}</span>
                          <Badge
                            variant={fee.status === 'Paid' ? 'default' : 'outline'}
                            className={fee.status === 'Paid' ? 'bg-success text-success-foreground' : 'text-warning border-warning'}
                          >
                            {fee.status}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="font-medium text-foreground">PKR {displayAmount.toLocaleString()}</span>
                          </div>
                          {fee.status === 'Pending' && pendingAdmissionFee && (
                            <p className="text-xs text-muted-foreground">
                              Monthly: {Number(member.monthly_fee).toLocaleString()} + Admission: {Number(member.admission_fee).toLocaleString()}
                            </p>
                          )}
                          {fee.status === 'Paid' && fee.includesAdmissionFee && (
                            <p className="text-xs text-success">Includes admission fee</p>
                          )}
                          {fee.payment_date && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Paid on</span>
                              <span>{format(new Date(fee.payment_date), 'MMM d, yyyy')}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-border">
                          {fee.status === 'Pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => sendWhatsAppReminder(fee.member, fee.month)}
                            >
                              <MessageCircle className="h-4 w-4 mr-1 text-green-600" /> Remind
                            </Button>
                          )}
                          {fee.status === 'Paid' ? (
                            <>
                              <Button variant="outline" size="sm" className="flex-1" onClick={() => reprintReceipt(fee)}>
                                <Printer className="h-4 w-4 mr-1" /> Receipt
                              </Button>
                              <Button variant="outline" size="sm" className="flex-1" onClick={() => togglePaymentStatus(fee)}>
                                Mark Pending
                              </Button>
                            </>
                          ) : (
                            <Button variant="default" size="sm" className="flex-1" onClick={() => openPayDialog(fee)}>
                              Mark Paid
                            </Button>
                          )}
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
                        <TableHead>Member</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fees.map((fee) => {
                        const member = members.find(m => m.id === fee.member_id);
                        const pendingAdmissionFee = member && !member.admission_fee_paid && member.admission_fee > 0;
                        const displayAmount = fee.status === 'Paid' 
                          ? Number(fee.amount) 
                          : pendingAdmissionFee 
                            ? Number(member.monthly_fee) + Number(member.admission_fee)
                            : Number(fee.amount);

                        return (
                          <TableRow key={fee.id}>
                            <TableCell className="font-medium">{fee.member.full_name}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span>PKR {displayAmount.toLocaleString()}</span>
                                {fee.status === 'Pending' && pendingAdmissionFee && (
                                  <span className="text-xs text-muted-foreground">
                                    (Monthly: {Number(member.monthly_fee).toLocaleString()} + Admission: {Number(member.admission_fee).toLocaleString()})
                                  </span>
                                )}
                                {fee.status === 'Paid' && fee.includesAdmissionFee && (
                                  <span className="text-xs text-success">Includes admission fee</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={fee.status === 'Paid' ? 'default' : 'outline'}
                                className={fee.status === 'Paid' ? 'bg-success text-success-foreground' : 'text-warning border-warning'}
                              >
                                {fee.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {fee.payment_date ? format(new Date(fee.payment_date), 'MMM d, yyyy') : '-'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {fee.payment_method || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {fee.status === 'Pending' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => sendWhatsAppReminder(fee.member, fee.month)}
                                    title="Send WhatsApp Reminder"
                                  >
                                    <MessageCircle className="h-4 w-4 text-green-600" />
                                  </Button>
                                )}
                                {fee.status === 'Paid' ? (
                                  <>
                                    <Button variant="outline" size="sm" onClick={() => reprintReceipt(fee)} title="Print Receipt">
                                      <Printer className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => togglePaymentStatus(fee)}>Mark Pending</Button>
                                  </>
                                ) : (
                                  <Button variant="default" size="sm" onClick={() => openPayDialog(fee)}>Mark Paid</Button>
                                )}
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

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="border-border/50 bg-card/95 shadow-lg backdrop-blur-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Collect Payment</DialogTitle>
            <DialogDescription className="sr-only">
              Record payment method and mark fee as paid
            </DialogDescription>
          </DialogHeader>
          {payingFee && (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary/50 p-3 space-y-1">
                <p className="font-medium">{payingFee.member.full_name}</p>
                <p className="text-sm text-muted-foreground">{format(new Date(payingFee.month + '-01'), 'MMMM yyyy')}</p>
                <p className="text-2xl font-bold mt-2">PKR {Number(payingFee.amount).toLocaleString()}</p>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (payingFee) {
                await togglePaymentStatus(payingFee, payMethod);
                setPayDialogOpen(false);
                setPayingFee(null);
              }
            }} className="gap-2">
              <Receipt className="h-4 w-4" /> Mark Paid & Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
