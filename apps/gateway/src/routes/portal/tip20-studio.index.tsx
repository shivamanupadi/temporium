import { createFileRoute } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';
import { Plus, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import {
  StablecoinCard,
  StablecoinEmptyState,
  CreateStablecoinModal,
  ImportStablecoinModal,
} from '@/components/stablecoins';
import { useStablecoins } from '@/hooks/useStablecoins';

export const Route = createFileRoute('/portal/tip20-studio/')({
  component: Tip20StudioIndexPage,
});

function Tip20StudioIndexPage(): ReactElement {
  const { stablecoins, isLoading, refresh } = useStablecoins();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="TIP20 Studio"
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportModal(true)}
              className="h-8 px-3"
            >
              <Download className="h-4 w-4" />
              Import
            </Button>
            <Button size="sm" onClick={() => setShowCreateModal(true)} className="h-8 px-3">
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </div>
        }
      />

      {/* Tokens List */}
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

      {/* Import Modal */}
      <ImportStablecoinModal
        isOpen={showImportModal}
        onSuccess={refresh}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
}
