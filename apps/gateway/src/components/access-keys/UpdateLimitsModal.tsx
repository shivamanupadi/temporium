import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAccessKeys } from '@/hooks/useAccessKeys';
import { useTokenList } from '@/hooks/useTokenList';
import { formatAddress } from '@/lib/utils';
import type { Token } from '@/lib/tokenlist';
import type { Address } from 'viem';
import { parseUnits, formatUnits } from 'viem';

interface UpdateLimitsModalProps {
  isOpen: boolean;
  keyId: Address;
  onSuccess: () => void;
  onClose: () => void;
}

export function UpdateLimitsModal({
  isOpen,
  keyId,
  onSuccess,
  onClose,
}: UpdateLimitsModalProps): ReactElement {
  const { updateSpendingLimit, getRemainingLimit } = useAccessKeys();
  const { tokens } = useTokenList();

  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [newLimit, setNewLimit] = useState('');
  const [currentRemaining, setCurrentRemaining] = useState<bigint | null>(null);
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingRemaining, setIsLoadingRemaining] = useState(false);
  const isUpdatingRef = useRef(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedToken(null);
      setNewLimit('');
      setCurrentRemaining(null);
      setFeeToken(null);
      setIsUpdating(false);
    }
  }, [isOpen]);

  // Fetch current remaining limit when token changes
  useEffect(() => {
    if (!selectedToken || !isOpen) {
      setCurrentRemaining(null);
      return;
    }

    const fetchRemaining = async (): Promise<void> => {
      setIsLoadingRemaining(true);
      try {
        const remaining = await getRemainingLimit(keyId, selectedToken.address as Address);
        setCurrentRemaining(remaining);
      } catch (error) {
        console.error('Failed to fetch remaining limit:', error);
        setCurrentRemaining(null);
      } finally {
        setIsLoadingRemaining(false);
      }
    };

    fetchRemaining();
  }, [selectedToken, keyId, getRemainingLimit, isOpen]);

  const handleUpdate = useCallback(async () => {
    if (!selectedToken || !newLimit) return;

    setIsUpdating(true);
    isUpdatingRef.current = true;

    try {
      const limitAmount = parseUnits(newLimit, selectedToken.decimals);

      await updateSpendingLimit({
        keyId,
        token: selectedToken.address as Address,
        newLimit: limitAmount,
        feeToken: feeToken?.address,
      });

      toast.success('Spending limit updated successfully');
      onSuccess();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update limit';
      toast.error(message);
    } finally {
      setIsUpdating(false);
      isUpdatingRef.current = false;
    }
  }, [selectedToken, newLimit, keyId, feeToken, updateSpendingLimit, onSuccess, onClose]);

  const handleClose = useCallback(() => {
    if (!isUpdating && !isUpdatingRef.current) {
      onClose();
    }
  }, [isUpdating, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
        <div className="px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-semibold">Update Spending Limit</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Update the spending limit for key {formatAddress(keyId, 6)}
          </DialogDescription>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Token Selection */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Token
            </label>
            <select
              value={selectedToken?.address ?? ''}
              onChange={e => {
                const token = tokens.find(t => t.address === e.target.value);
                setSelectedToken(token ?? null);
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Select a token</option>
              {tokens.map(token => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>

          {/* Current Remaining */}
          {selectedToken && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Current Remaining Limit</p>
              <p className="text-sm font-medium">
                {isLoadingRemaining
                  ? 'Loading...'
                  : currentRemaining !== null
                    ? `${formatUnits(currentRemaining, selectedToken.decimals)} ${selectedToken.symbol}`
                    : 'N/A'}
              </p>
            </div>
          )}

          {/* New Limit */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              New Limit {selectedToken ? `(${selectedToken.symbol})` : ''}
            </label>
            <Input
              type="number"
              placeholder="0.00"
              value={newLimit}
              onChange={e => setNewLimit(e.target.value)}
              className="h-10 w-full"
            />
          </div>

          <FeeTokenSelector
            value={feeToken}
            onChange={setFeeToken}
            className="pt-4 border-t border-border"
          />

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleUpdate}
              disabled={isUpdating || !selectedToken || !newLimit}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating
                </>
              ) : (
                'Update Limit'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
