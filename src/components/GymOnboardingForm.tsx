import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Building2, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';

const gymSchema = z.object({
  gymName: z.string().trim().min(1, 'Gym name is required').max(100, 'Gym name is too long'),
  gymEmail: z.string().trim().email('Invalid email address').max(255, 'Email is too long'),
  subscriptionPlan: z.enum(['Monthly', 'Yearly'], { required_error: 'Please select a subscription plan' }),
  subscriptionAmount: z.number().min(0, 'Amount must be positive').max(10000000, 'Amount is too large'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100, 'Password is too long'),
});

interface CreatedGym {
  gymId: string;
  authUid: string;
  gymName: string;
  password: string;
  gymEmail: string;
  subscriptionPlan: string;
  subscriptionAmount: number;
}

interface GymOnboardingFormProps {
  onGymCreated?: () => void;
}

export default function GymOnboardingForm({ onGymCreated }: GymOnboardingFormProps) {
  const [gymName, setGymName] = useState('');
  const [gymEmail, setGymEmail] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>('');
  const [subscriptionAmount, setSubscriptionAmount] = useState<string>('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdGym, setCreatedGym] = useState<CreatedGym | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = gymSchema.safeParse({
      gymName,
      gymEmail,
      subscriptionPlan,
      subscriptionAmount: subscriptionAmount ? Number(subscriptionAmount) : 0,
      password,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    try {
      // Step 1: Create auth user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: gymEmail.trim().toLowerCase(),
        password: password,
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Failed to create user');

      const newUserId = signUpData.user.id;

      // Step 2: Create gym record
      const { data: gymData, error: gymError } = await supabase
        .from('gyms')
        .insert({
          user_id: newUserId,
          gym_name: gymName.trim(),
          gym_email: gymEmail.trim().toLowerCase(),
          subscription_plan: subscriptionPlan,
          subscription_amount: Number(subscriptionAmount),
          is_active: true,
        })
        .select()
        .single();

      if (gymError) throw gymError;

      // Step 3: Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: newUserId,
          gym_name: gymName.trim(),
        });

      if (profileError) throw profileError;

      // Step 4: Set owner role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: newUserId,
          role: 'owner',
        });

      if (roleError) throw roleError;

      setCreatedGym({
        gymId: gymData.id,
        authUid: newUserId,
        gymName: gymName.trim(),
        password: password,
        gymEmail: gymEmail.trim(),
        subscriptionPlan: subscriptionPlan,
        subscriptionAmount: Number(subscriptionAmount),
      });

      toast({
        title: "Gym Created",
        description: "The gym has been successfully onboarded",
      });

      // Reset form
      setGymName('');
      setGymEmail('');
      setSubscriptionPlan('');
      setSubscriptionAmount('');
      setPassword('');

      onGymCreated?.();

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create gym",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyEmail = async () => {
    if (createdGym) {
      await navigator.clipboard.writeText(createdGym.gymEmail);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  const copyPassword = async () => {
    if (createdGym) {
      await navigator.clipboard.writeText(createdGym.password);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const resetForm = () => {
    setCreatedGym(null);
    setShowPassword(false);
  };

  if (createdGym) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Gym Created Successfully</CardTitle>
          </div>
          <CardDescription>Share these credentials with the gym owner</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Gym Name</p>
              <p className="font-medium">{createdGym.gymName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Login Email</p>
              <div className="flex items-center gap-2">
                <code className="bg-background px-2 py-1 rounded font-mono">
                  {createdGym.gymEmail}
                </code>
                <Button variant="ghost" size="sm" onClick={copyEmail}>
                  {copiedUid ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Password</p>
              <div className="flex items-center gap-2">
                <code className="bg-background px-2 py-1 rounded font-mono">
                  {showPassword ? createdGym.password : '••••••••'}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={copyPassword}>
                  {copiedPassword ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Subscription</p>
              <p className="font-medium">{createdGym.subscriptionPlan} - PKR {createdGym.subscriptionAmount.toLocaleString()}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            The gym owner will use the email and password to log into their account.
          </p>
          <Button onClick={resetForm} className="w-full">
            Onboard Another Gym
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Gym Onboarding</CardTitle>
        </div>
        <CardDescription>Add a new gym to the platform</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gymName">Gym Name *</Label>
            <Input
              id="gymName"
              placeholder="Enter gym name"
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
            />
            {errors.gymName && <p className="text-sm text-destructive">{errors.gymName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gymEmail">Gym Email *</Label>
            <Input
              id="gymEmail"
              type="email"
              placeholder="gym@example.com"
              value={gymEmail}
              onChange={(e) => setGymEmail(e.target.value)}
            />
            {errors.gymEmail && <p className="text-sm text-destructive">{errors.gymEmail}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subscriptionPlan">Subscription Plan *</Label>
            <Select value={subscriptionPlan} onValueChange={setSubscriptionPlan}>
              <SelectTrigger id="subscriptionPlan">
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Monthly">Monthly</SelectItem>
                <SelectItem value="Yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            {errors.subscriptionPlan && <p className="text-sm text-destructive">{errors.subscriptionPlan}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subscriptionAmount">Subscription Amount (PKR) *</Label>
            <Input
              id="subscriptionAmount"
              type="number"
              placeholder="Enter amount in PKR"
              value={subscriptionAmount}
              onChange={(e) => setSubscriptionAmount(e.target.value)}
              min="0"
            />
            {errors.subscriptionAmount && <p className="text-sm text-destructive">{errors.subscriptionAmount}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Initial Password *</Label>
            <Input
              id="password"
              type="password"
              placeholder="Set initial password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            <p className="text-xs text-muted-foreground">
              This password will be shared with the gym owner for initial login.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating...' : 'Create Gym'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}