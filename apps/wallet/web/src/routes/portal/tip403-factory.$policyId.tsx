import { createFileRoute, useNavigate, Link, Outlet, redirect } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePolicy } from '@/hooks/usePolicies';

export const Route = createFileRoute('/portal/tip403-factory/$policyId')({
  component: Tip403FactoryLayout,
  beforeLoad: ({ location, params }) => {
    if (!location.pathname.endsWith('/overview')) {
      throw redirect({
        to: '/portal/tip403-factory/$policyId/overview',
        params: { policyId: params.policyId },
        replace: true,
      });
    }
  },
});

function Tip403FactoryLayout(): ReactElement {
  const { policyId } = Route.useParams();
  const navigate = useNavigate();

  const { policy, isLoading } = usePolicy(policyId);

  if (isLoading) {
    return (
      <div className="max-w-5xl animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-32 bg-muted rounded" />
          <span className="text-muted-foreground">/</span>
          <div className="h-8 w-24 bg-muted rounded" />
        </div>

        {/* Content Skeleton */}
        <div className="lg:flex lg:gap-6 lg:items-stretch">
          <div className="lg:flex-[3]">
            <div className="rounded-2xl p-6 mb-6 bg-muted/30">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-muted" />
                  <div>
                    <div className="h-8 w-40 bg-muted rounded mb-2" />
                    <div className="h-4 w-32 bg-muted rounded mb-2" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 h-11 bg-muted rounded-lg" />
                <div className="flex-1 h-11 bg-muted rounded-lg" />
              </div>
            </div>
          </div>
          <div className="lg:flex-[2] mt-6 lg:mt-0">
            <div className="bg-card rounded-xl shadow-xs border border-border overflow-hidden h-full">
              <div className="px-4 py-3 border-b border-border/50">
                <div className="h-4 w-28 bg-muted rounded" />
              </div>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="p-4 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted" />
                    <div>
                      <div className="h-4 w-24 bg-muted rounded mb-1" />
                      <div className="h-3 w-32 bg-muted rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">TIP403 Factory</h1>
        </div>
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Policy Not Found</h2>
          <p className="text-muted-foreground mb-4">This policy is not in your list</p>
          <Button
            onClick={() => navigate({ to: '/portal/tip403-factory' })}
            className="rounded-xl font-semibold bg-coral hover:bg-coral/80 text-white"
          >
            Back to TIP403 Factory
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          to="/portal/tip403-factory"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-2xl font-bold">TIP403 Factory</span>
        </Link>
        <span className="text-2xl text-muted-foreground/50">/</span>
        <span className="text-2xl font-bold text-foreground">
          Policy #{policy?.policyId ?? policyId}
        </span>
      </div>

      {/* Child Routes */}
      <Outlet />
    </div>
  );
}
