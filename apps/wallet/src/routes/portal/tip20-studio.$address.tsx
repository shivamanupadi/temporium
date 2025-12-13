import {
  createFileRoute,
  useNavigate,
  Link,
  Outlet,
  useLocation,
  redirect,
} from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { ArrowLeft, CircleDollarSign, Loader2, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTip20Studio } from '@/hooks/useTip20Studio';

export const Route = createFileRoute('/portal/tip20-studio/$address')({
  component: Tip20StudioLayout,
  beforeLoad: ({ location, params }) => {
    // Redirect to overview if at base address path
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

  // Determine active tab from URL
  const isRewardsTab = location.pathname.endsWith('/rewards');

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => navigate({ to: '/portal/tip20-studio' })}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <h1 className="text-[15px] font-medium text-foreground">Loading...</h1>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  // Not found state
  if (isNotFound) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => navigate({ to: '/portal/tip20-studio' })}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <h1 className="text-[15px] font-medium text-foreground">TIP20 Studio</h1>
        </div>
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <CircleDollarSign className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Token Not Found</h2>
          <p className="text-muted-foreground mb-4">This token is not in your list</p>
          <Button onClick={() => navigate({ to: '/portal/tip20-studio' })}>
            Back to TIP20 Studio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto -mt-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => navigate({ to: '/portal/tip20-studio' })}
          className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-medium text-foreground">TIP20 Studio</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-[15px] font-medium text-foreground">
            {stablecoin?.name ?? tokenAddress}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg mb-3">
        <Link
          to="/portal/tip20-studio/$address/overview"
          params={{ address: tokenAddress }}
          className={`px-4 py-2 text-[13px] font-medium rounded-md transition-colors ${
            !isRewardsTab
              ? 'bg-white text-foreground shadow-sm'
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
              ? 'bg-white text-foreground shadow-sm'
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
