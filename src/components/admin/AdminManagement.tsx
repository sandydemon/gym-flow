import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Shield, AlertCircle, Mail, Loader2 } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().trim().email({ message: "Invalid email address" }).max(255);
const passwordSchema = z.string().min(6, { message: "Password must be at least 6 characters" });

export default function AdminManagement() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate email
    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      setError(emailValidation.error.errors[0].message);
      return;
    }

    // Validate password
    const passwordValidation = passwordSchema.safeParse(password);
    if (!passwordValidation.success) {
      setError(passwordValidation.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create user with email and password
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Failed to create user');

      const newUserId = signUpData.user.id;

      // Step 2: Insert admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: newUserId,
          role: 'admin',
        });

      if (roleError) throw roleError;

      // Step 3: Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: newUserId,
        });

      if (profileError) throw profileError;

      toast({
        title: "Admin Created Successfully",
        description: `Admin account created for ${email}. They can now login with the provided password.`,
      });

      setEmail('');
      setPassword('');
    } catch (err: any) {
      console.error('Error creating admin:', err);
      const errorMessage = err.message || 'Failed to create admin';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Admin Management
        </h2>
        <p className="text-muted-foreground text-sm">Create new administrators for the system</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Create New Admin
          </CardTitle>
          <CardDescription>
            Enter email and password to create a new administrator account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email Address</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="newadmin@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                disabled={loading}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading || !email.trim() || !password.trim()} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Admin...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Create Admin
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium text-sm mb-2">How it works:</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Enter email and password for new admin</li>
              <li>Account is created instantly</li>
              <li>Share credentials with the new admin</li>
              <li>They can login at the admin login page</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}