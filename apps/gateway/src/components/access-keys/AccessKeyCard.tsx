import type { ReactElement } from 'react';
import { Link } from '@tanstack/react-router';
import { Key, ChevronRight, Fingerprint, Lock } from 'lucide-react';
import { formatAddress } from '@/lib/utils';
import { getKeyStatus, formatExpiry } from '@/lib/access-keys-utils';
import type { AccessKeyWithMetadata } from '@/hooks/useAccessKeys';

interface AccessKeyCardProps {
  accessKey: AccessKeyWithMetadata;
}

export function AccessKeyCard({ accessKey }: AccessKeyCardProps): ReactElement {
  const status = getKeyStatus(accessKey.isRevoked, accessKey.expiry);

  const getKeyTypeIcon = (): ReactElement => {
    switch (accessKey.signatureType) {
      case 'secp256k1':
        return <Key className="h-5 w-5 text-primary" />;
      case 'p256':
        return <Lock className="h-5 w-5 text-primary" />;
      case 'webAuthn':
        return <Fingerprint className="h-5 w-5 text-primary" />;
      default:
        return <Key className="h-5 w-5 text-primary" />;
    }
  };

  const getStatusBadge = (): ReactElement => {
    switch (status) {
      case 'active':
        return (
          <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
            Active
          </span>
        );
      case 'expired':
        return (
          <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
            Expired
          </span>
        );
      case 'revoked':
        return (
          <span className="text-[10px] font-medium text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
            Revoked
          </span>
        );
    }
  };

  const getKeyTypeBadge = (): ReactElement => {
    const typeLabels: Record<string, string> = {
      secp256k1: 'Secp256k1',
      p256: 'P256',
      webAuthn: 'WebAuthn',
    };

    return (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded text-primary bg-primary/10">
        {typeLabels[accessKey.signatureType] ?? accessKey.signatureType}
      </span>
    );
  };

  return (
    <Link
      to="/portal/access-keys/$keyId"
      params={{ keyId: accessKey.keyId }}
      className="block w-full p-4 text-left hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10">
            {getKeyTypeIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-medium text-foreground font-mono">
                {formatAddress(accessKey.keyId, 6)}
              </p>
              {getKeyTypeBadge()}
              {getStatusBadge()}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Expires: {formatExpiry(accessKey.expiry)}
              {accessKey.enforceLimits && ' • Limits enforced'}
            </p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}
