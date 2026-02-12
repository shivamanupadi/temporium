import {
  createFileRoute,
  useNavigate,
  Link,
  Outlet,
  useLocation,
  redirect,
} from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { CircleDollarSign, Gift, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTip20Studio } from '@/hooks/useTip20Studio';

export const Route = createFileRoute('/portal/tip20-studio/$address')({
  component: Tip20StudioLayout,
  beforeLoad: ({ location, params }) => {
    if (!location.pathname.endsWith('/overview') && !location.pathname.endsWith('/rewards')) {
      throw redirect({
        to: '/portal/tip20-studio/$address/overview',
        params: { address: params.address },
        replace: true,
      });
    }
  },
});

function Tip20StudioLayout(): ReactElement {
  const { address: tokenAddress } = Route.useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { stablecoin, isLoading, isNotFound } = useTip20Studio(tokenAddress);

  const isRewardsTab = location.pathname.endsWith('/rewards');

  if (isLoading) {
    return (
      <div className="max-w-5xl animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-32 bg-muted rounded" />
          <span className="text-muted-foreground">/</span>
          <div className="h-8 w-24 bg-muted rounded" />
        </div>

        {/* Tab Navigation Skeleton */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg mb-3">
          <div className="px-4 py-2 bg-card rounded-md shadow-sm">
            <div className="h-4 w-20 bg-muted rounded" />
          </div>
          <div className="px-4 py-2">
            <div className="h-4 w-16 bg-muted/50 rounded" />
          </div>
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
            <div className="grid grid-cols-2 gap-4 mb-6">
              {[1, 2].map(i => (
                <div key={i} className="bg-card rounded-xl p-4 shadow-xs border border-border">
                  <div className="h-3 w-20 bg-muted rounded mb-2" />
                  <div className="h-6 w-24 bg-muted rounded mb-1" />
                  <div className="h-3 w-12 bg-muted rounded" />
                </div>
              ))}
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

  if (isNotFound) {
    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">TIP20 Studio</h1>
        </div>
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <CircleDollarSign className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Token Not Found</h2>
          <p className="text-muted-foreground mb-4">This token is not in your list</p>
          <Button onClick={() => navigate({ to: '/portal/tip20-studio' })} className="rounded-xl font-semibold bg-lavender hover:bg-lavender/80 text-white">
            Back to TIP20 Studio
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
          to="/portal/tip20-studio"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-2xl font-bold">TIP20 Studio</span>
        </Link>
        <span className="text-2xl text-muted-foreground/50">/</span>
        <span className="text-2xl font-bold text-foreground">
          {stablecoin?.name ?? tokenAddress}
        </span>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg mb-4">
        <Link
          to="/portal/tip20-studio/$address/overview"
          params={{ address: tokenAddress }}
          className={`px-4 py-2 text-[13px] font-medium rounded-md transition-colors ${
            !isRewardsTab
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <CircleDollarSign className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
          Overview
        </Link>
        <Link
          to="/portal/tip20-studio/$address/rewards"
          params={{ address: tokenAddress }}
          className={`px-4 py-2 text-[13px] font-medium rounded-md transition-colors ${
            isRewardsTab
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Gift className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
          Rewards
        </Link>
      </div>

      {/* Child Routes */}
      <Outlet />
    </div>
  );
}
