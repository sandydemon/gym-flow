import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Shield, LogOut, LayoutDashboard, DollarSign, Building2, UserPlus, Users, BarChart3 } from 'lucide-react';
import GymOnboardingForm from '@/components/GymOnboardingForm';
import GymList from '@/components/GymList';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminGymFees from '@/components/admin/AdminGymFees';
import AdminManagement from '@/components/admin/AdminManagement';
import AdminReports from '@/components/admin/AdminReports';
import { format } from 'date-fns';

interface Stats {
  totalGyms: number;
  activeGyms: number;
  totalMembers: number;
  totalCollected: number;
  pendingCollection: number;
  monthlyEarnings: number;
}

export default function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalGyms: 0,
    activeGyms: 0,
    totalMembers: 0,
    totalCollected: 0,
    pendingCollection: 0,
    monthlyEarnings: 0,
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAndLoadStats();
  }, []);

  const checkAdminAndLoadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/admin/auth');
        return;
      }

      // Check admin role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (roleError || !roleData) {
        toast({
          title: "Access Denied",
          description: "You do not have admin privileges",
          variant: "destructive",
        });
        navigate('/admin/auth');
        return;
      }

      await loadStats();
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    const currentMonth = format(new Date(), 'yyyy-MM');

    const [gymsRes, membersRes, paidFeesRes, pendingFeesRes, monthlyFeesRes] = await Promise.all([
      supabase.from('gyms').select('id, is_active'),
      supabase.from('members').select('id', { count: 'exact', head: true }),
      supabase.from('gym_fees').select('amount').eq('status', 'Paid'),
      supabase.from('gym_fees').select('amount').eq('status', 'Pending'),
      supabase.from('gym_fees').select('amount').eq('status', 'Paid').eq('month', currentMonth),
    ]);

    const totalGyms = gymsRes.data?.length || 0;
    const activeGyms = gymsRes.data?.filter(g => g.is_active).length || 0;
    const totalCollected = paidFeesRes.data?.reduce((sum, fee) => sum + Number(fee.amount), 0) || 0;
    const pendingCollection = pendingFeesRes.data?.reduce((sum, fee) => sum + Number(fee.amount), 0) || 0;
    const monthlyEarnings = monthlyFeesRes.data?.reduce((sum, fee) => sum + Number(fee.amount), 0) || 0;

    setStats({
      totalGyms,
      activeGyms,
      totalMembers: membersRes.count || 0,
      totalCollected,
      pendingCollection,
      monthlyEarnings,
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged Out",
      description: "You have been signed out",
    });
    navigate('/admin/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Admin Panel</h1>
                <p className="text-xs text-muted-foreground">GymFlow Management</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 lg:w-auto lg:inline-grid">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="w-4 h-4 hidden sm:inline" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="fees" className="gap-2">
              <DollarSign className="w-4 h-4 hidden sm:inline" />
              Fees
            </TabsTrigger>
            <TabsTrigger value="gyms" className="gap-2">
              <Building2 className="w-4 h-4 hidden sm:inline" />
              Gyms
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <BarChart3 className="w-4 h-4 hidden sm:inline" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="onboard" className="gap-2">
              <UserPlus className="w-4 h-4 hidden sm:inline" />
              Add Gym
            </TabsTrigger>
            <TabsTrigger value="admins" className="gap-2">
              <Users className="w-4 h-4 hidden sm:inline" />
              Admins
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <AdminDashboard stats={stats} />
          </TabsContent>

          <TabsContent value="fees" className="mt-6">
            <AdminGymFees onDataChange={loadStats} />
          </TabsContent>

          <TabsContent value="gyms" className="mt-6">
            <GymList onStatusChange={() => { loadStats(); }} />
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <AdminReports />
          </TabsContent>

          <TabsContent value="onboard" className="mt-6">
            <div className="max-w-2xl">
              <GymOnboardingForm onGymCreated={() => { loadStats(); }} />
            </div>
          </TabsContent>

          <TabsContent value="admins" className="mt-6">
            <AdminManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
