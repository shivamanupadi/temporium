import type { StablecoinWithMetadata } from '@/hooks/useStablecoins';
import type { TokenRole } from '@/types';

export type StablecoinModalType =
  | 'create'
  | 'manage'
  | 'mint'
  | 'burn'
  | 'supply-cap'
  | 'grant-role'
  | 'revoke-role'
  | 'burn-blocked'
  | null;

export interface StablecoinCardProps {
  coin: StablecoinWithMetadata;
}

export interface MintBurnModalProps {
  isOpen: boolean;
  mode: 'mint' | 'burn';
  selectedCoin: StablecoinWithMetadata | null;
  txHash: string | null;
  isSubmitting: boolean;
  amount: string;
  setAmount: (v: string) => void;
  mintTo: string;
  setMintTo: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export interface ManageModalProps {
  isOpen: boolean;
  selectedCoin: StablecoinWithMetadata | null;
  isSubmitting: boolean;
  onPause: () => void;
  onUnpause: () => void;
  onMint: (coin: StablecoinWithMetadata) => void;
  onBurn: (coin: StablecoinWithMetadata) => void;
  onSetSupplyCap: (coin: StablecoinWithMetadata) => void;
  onGrantRole: (coin: StablecoinWithMetadata) => void;
  onRevokeRole: (coin: StablecoinWithMetadata) => void;
  onBurnBlocked: (coin: StablecoinWithMetadata) => void;
  onRemove: (coin: StablecoinWithMetadata) => void;
  onClose: () => void;
}

export interface RoleModalProps {
  isOpen: boolean;
  mode: 'grant' | 'revoke';
  selectedCoin: StablecoinWithMetadata | null;
  txHash: string | null;
  isSubmitting: boolean;
  roleAddress: string;
  setRoleAddress: (v: string) => void;
  selectedRole: TokenRole;
  setSelectedRole: (v: TokenRole) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export interface SupplyCapModalProps {
  isOpen: boolean;
  selectedCoin: StablecoinWithMetadata | null;
  txHash: string | null;
  isSubmitting: boolean;
  supplyCap: string;
  setSupplyCap: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export interface BurnBlockedModalProps {
  isOpen: boolean;
  selectedCoin: StablecoinWithMetadata | null;
  txHash: string | null;
  isSubmitting: boolean;
  burnFrom: string;
  setBurnFrom: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export interface RemoveConfirmModalProps {
  coin: StablecoinWithMetadata | null;
  onConfirm: () => void;
  onCancel: () => void;
}
