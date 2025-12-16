import { type ReactElement } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNetworkManager } from '@/hooks/useNetworkManager';
import { TEMPO_TESTNET } from '@/lib/constants';

/**
 * Banner displayed when connected with an external wallet on the wrong network
 * Prompts user to switch to Tempo network
 */
export function WrongNetworkBanner(): ReactElement | null {
  const { isWrongNetwork, switchToTempo, isNetworkSwitching } = useNetworkManager();

  if (!isWrongNetwork) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm font-medium">
            Please switch to {TEMPO_TESTNET.name} to continue
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={switchToTempo}
          isLoading={isNetworkSwitching}
          className="bg-white text-amber-600 hover:bg-amber-50 flex-shrink-0"
        >
          Switch Network
        </Button>
      </div>
    </div>
  );
}
