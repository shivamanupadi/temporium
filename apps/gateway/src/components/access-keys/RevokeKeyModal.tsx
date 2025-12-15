import { useState, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAccessKeys } from '@/hooks/useAccessKeys';
import { formatAddress } from '@/lib/utils';
import type { Address } from 'viem';

interface RevokeKeyModalProps {
  isOpen: boolean;
  keyId: Address;
  onSuccess: () => void;
  onClose: () => void;
}

export function RevokeKeyModal({
  isOpen,
  keyId,
  onSuccess,
  onClose,
}: RevokeKeyModalProps): ReactElement {
  const { revokeKey } = useAccessKeys();
  const [isRevoking, setIsRevoking] = useState(false);
  const isRevokingRef = useRef(false);

  const handleRevoke = useCallback(async () => {
    setIsRevoking(true);
    isRevokingRef.current = true;

    try {
      await revokeKey({ keyId });
      toast.success('Access key revoked successfully');
      onSuccess();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to revoke key';
      toast.error(message);
    } finally {
      setIsRevoking(false);
      isRevokingRef.current = false;
    }
  }, [keyId, revokeKey, onSuccess, onClose]);

  const handleClose = useCallback(() => {
    if (!isRevoking && !isRevokingRef.current) {
      onClose();
    }
  }, [isRevoking, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Revoke Access Key</DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            This action is permanent and cannot be undone. The key{' '}
            <span className="font-mono text-foreground">{formatAddress(keyId, 6)}</span> will be
            permanently disabled and can never be re-authorized.
          </DialogDescription>
        </div>

        <div className="px-6 pb-6">
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
            <p className="text-xs text-red-700">
              <strong>Warning:</strong> Once revoked, this key cannot be used for any transactions,
              and the same public key can never be authorized again.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={isRevoking}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleRevoke}
              disabled={isRevoking}
            >
              {isRevoking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Revoking
                </>
              ) : (
                'Revoke Key'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
