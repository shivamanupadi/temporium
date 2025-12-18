import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, type JSX } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Zap, Server } from 'lucide-react';

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
      <div className="flex items-center justify-center min-h-screen bg-[#FAFAFA]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4">
      <div className="w-full max-w-md">
        {/* Card Container */}
        <div className="bg-white rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04),0_12px_24px_rgba(0,0,0,0.04)] p-8">
          {/* Logo & Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: '#EDE9FE' }}
              >
                <Zap className="w-6 h-6" style={{ color: '#7C3AED' }} />
              </div>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Temporium</h1>
            <div className="flex items-center gap-1.5 text-gray-500">
              <Server className="w-3.5 h-3.5" />
              <span className="text-[13px] font-medium">Node Manager</span>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              {isSetup ? 'Welcome back' : 'Get started'}
            </h2>
            <p className="text-[13px] text-gray-500">
              {isSetup
                ? 'Enter your password to access the dashboard'
                : 'Create an admin password to begin'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[13px] font-medium text-gray-700">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isSetup ? 'Enter your password' : 'Create a password'}
                required
                disabled={isSubmitting}
                className="h-11 bg-gray-50 border-gray-200 focus:border-violet-500 focus:ring-violet-500/20"
              />
              {!isSetup && <p className="text-[11px] text-gray-400">Minimum 8 characters</p>}
            </div>

            {!isSetup && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-[13px] font-medium text-gray-700">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  disabled={isSubmitting}
                  className="h-11 bg-gray-50 border-gray-200 focus:border-violet-500 focus:ring-violet-500/20"
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isSetup ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          {/* Help text */}
          <p className="mt-6 text-center text-[12px] text-gray-400">
            {isSetup
              ? 'Forgot your password? Reset the database to start fresh.'
              : 'This password will be used to access your node dashboard.'}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-[12px] text-gray-400">
            Powered by{' '}
            <a
              href="https://tempo.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              Tempo
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
