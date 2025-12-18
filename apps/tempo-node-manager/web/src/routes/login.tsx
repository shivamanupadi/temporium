import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, type JSX } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Server, Zap } from 'lucide-react';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const { setToken, isAuthenticated } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: '/dashboard' });
    }
  }, [isAuthenticated, navigate]);

  // Check setup status
  const { data: status, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['auth-status'],
    queryFn: authApi.getStatus,
  });

  const isSetup = status?.isSetup ?? false;

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: data => {
      setToken(data.accessToken);
      toast.success('Login successful');
      navigate({ to: '/dashboard' });
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : 'Login failed');
    },
  });

  // Setup mutation
  const setupMutation = useMutation({
    mutationFn: authApi.setup,
    onSuccess: data => {
      setToken(data.accessToken);
      toast.success('Setup complete! Welcome to Tempo Node Manager');
      navigate({ to: '/dashboard' });
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : 'Setup failed');
    },
  });

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();

    if (!isSetup) {
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
      if (password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }
      setupMutation.mutate(password);
    } else {
      loginMutation.mutate(password);
    }
  };

  const isSubmitting = loginMutation.isPending || setupMutation.isPending;

  if (isLoadingStatus) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {/* Static background gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#0073e6]/15 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 px-6 py-6">
        <div className="max-w-md mx-auto flex items-center justify-center">
          <div className="flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-slate-900" strokeWidth={2} />
            <span className="text-lg font-bold text-slate-900 tracking-tight">Temporium</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-md">
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white backdrop-blur border border-border shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-[13px] font-medium text-foreground">Node Manager</span>
          </div>
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-primary/10">
            <Server className="w-8 h-8 text-primary" />
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            {isSetup ? 'Welcome Back' : 'Initial Setup'}
          </h1>
          <p className="text-[15px] text-muted-foreground">
            {isSetup
              ? 'Enter your password to access the dashboard'
              : 'Create an admin password to get started'}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white backdrop-blur rounded-xl border border-border p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isSetup ? 'Enter password' : 'Create password (min 8 characters)'}
                required
                disabled={isSubmitting}
              />
            </div>

            {!isSetup && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  required
                  disabled={isSubmitting}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isSetup ? 'Sign In' : 'Create Admin Account'}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <span className="text-[12px]">Powered by</span>
            <a
              href="https://tempo.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-semibold text-foreground hover:text-primary transition-colors"
            >
              Tempo
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
