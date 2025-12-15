import { createFileRoute } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { AccessKeyCard, AccessKeyEmptyState, CreateKeyModal } from '@/components/access-keys';
import { useAccessKeys } from '@/hooks/useAccessKeys';

export const Route = createFileRoute('/portal/access-keys/')({
  component: AccessKeysIndexPage,
});

function AccessKeysIndexPage(): ReactElement {
  const { keys, isLoading, refresh } = useAccessKeys();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Access Keys"
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing}
              className="h-8 px-3"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button size="sm" onClick={() => setShowCreateModal(true)} className="h-8 px-3">
              <Plus className="h-4 w-4" />
              Create Key
            </Button>
          </div>
        }
      />

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-6">
        Access keys are secondary signing keys that can perform transactions without prompting for
        passkey authentication. They can have spending limits and expiry times.
      </p>

      {/* Keys List */}
      <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-[rgba(0,0,0,0.03)]">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted" />
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="h-4 w-24 bg-muted rounded" />
                        <div className="h-4 w-16 bg-muted rounded" />
                        <div className="h-4 w-12 bg-muted rounded" />
                      </div>
                      <div className="h-3 w-32 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="w-4 h-4 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : keys.length === 0 ? (
          <AccessKeyEmptyState onCreate={() => setShowCreateModal(true)} />
        ) : (
          <div className="divide-y divide-[rgba(0,0,0,0.03)]">
            {keys.map(key => (
              <AccessKeyCard key={key.keyId} accessKey={key} />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateKeyModal
        isOpen={showCreateModal}
        onSuccess={refresh}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
