import { createFileRoute } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import {
  StablecoinCard,
  StablecoinEmptyState,
  CreateStablecoinModal,
} from '@/components/stablecoins';
import { useStablecoins } from '@/hooks/useStablecoins';

export const Route = createFileRoute('/portal/stablecoins/')({
  component: StablecoinsIndexPage,
});

function StablecoinsIndexPage(): ReactElement {
  const { stablecoins, isLoading, refresh } = useStablecoins();
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="My Stablecoins"
        action={
          <Button size="sm" onClick={() => setShowCreateModal(true)} className="h-8 px-3">
            <Plus className="h-4 w-4" />
            Create
          </Button>
        }
      />

      {/* Stablecoins List */}
      <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
          </div>
        ) : stablecoins.length === 0 ? (
          <StablecoinEmptyState onCreate={() => setShowCreateModal(true)} />
        ) : (
          <div className="divide-y divide-[rgba(0,0,0,0.03)]">
            {stablecoins.map(coin => (
              <StablecoinCard key={coin.id} coin={coin} />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateStablecoinModal
        isOpen={showCreateModal}
        onSuccess={refresh}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
