import { useState, type ReactElement } from 'react';
import {
  Gift,
  UserCheck,
  UserX,
  HandCoins,
  Loader2,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRewards } from '@/hooks/useRewards';
import { formatAmount, formatAddress } from '@/lib/utils';
import { getExplorerAddressUrl } from '@/lib/tempo-client';
import { StartRewardModal } from './StartRewardModal';
import { SetRecipientModal } from './SetRecipientModal';
import { ClaimRewardsModal } from './ClaimRewardsModal';
import type { StablecoinWithMetadata } from '@/hooks/useStablecoins';
import type { Address } from 'viem';

interface RewardsTabProps {
  stablecoin: StablecoinWithMetadata | null;
  onSuccess: () => void;
}

type RewardsModal = 'start-reward' | 'opt-in' | 'opt-out' | 'claim' | null;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

export function RewardsTab({ stablecoin, onSuccess }: RewardsTabProps): ReactElement {
  const { rewardInfo, isLoading, refresh } = useRewards({ token: stablecoin?.address });
  const [activeModal, setActiveModal] = useState<RewardsModal>(null);
  const [copiedRecipient, setCopiedRecipient] = useState(false);

  const decimals = stablecoin?.metadata?.decimals ?? 6;
  const isOptedIn = rewardInfo?.isOptedIn ?? false;
  const claimableBalance = rewardInfo?.rewardBalance ?? 0n;
  const formattedBalance = formatAmount(claimableBalance.toString(), decimals);
  const hasClaimableRewards = claimableBalance > 0n;

  const handleSuccess = (): void => {
    refresh();
    onSuccess();
  };

  const closeModal = (): void => {
    setActiveModal(null);
  };

  const copyRecipientAddress = async (): Promise<void> => {
    if (!rewardInfo?.rewardRecipient) return;
    await navigator.clipboard.writeText(rewardInfo.rewardRecipient);
    setCopiedRecipient(true);
    setTimeout(() => setCopiedRecipient(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Reward Status Card */}
      <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.05)]">
          <h2 className="text-[13px] font-semibold text-foreground">Reward Status</h2>
        </div>
        <div className="p-4 space-y-4">
          {/* Opt-in Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${isOptedIn ? 'bg-emerald-100' : 'bg-muted'}`}
              >
                {isOptedIn ? (
                  <UserCheck className="h-5 w-5 text-emerald-600" />
                ) : (
                  <UserX className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p
                  className={`text-[13px] font-medium ${isOptedIn ? 'text-emerald-600' : 'text-muted-foreground'}`}
                >
                  {isOptedIn ? 'Opted In' : 'Not Opted In'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isOptedIn ? 'You are receiving rewards' : 'You are not receiving rewards'}
                </p>
              </div>
            </div>
            {isOptedIn ? (
              <Button
                variant="outline"
                size="sm"
                className="text-amber-600 border-amber-200 hover:bg-amber-50"
                onClick={() => setActiveModal('opt-out')}
              >
                <UserX className="h-4 w-4 mr-1" />
                Opt Out
              </Button>
            ) : (
              <Button size="sm" onClick={() => setActiveModal('opt-in')}>
                <UserCheck className="h-4 w-4 mr-1" />
                Opt In
              </Button>
            )}
          </div>

          {/* Recipient Address (if opted in) */}
          {isOptedIn &&
            rewardInfo?.rewardRecipient &&
            rewardInfo.rewardRecipient !== ZERO_ADDRESS && (
              <>
                <div className="h-px bg-[rgba(0,0,0,0.05)]" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Reward Recipient</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[12px] font-mono text-foreground">
                      {formatAddress(rewardInfo.rewardRecipient, 8)}
                    </span>
                    <button
                      onClick={copyRecipientAddress}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      title="Copy address"
                    >
                      {copiedRecipient ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                    <a
                      href={getExplorerAddressUrl(rewardInfo.rewardRecipient)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-muted transition-colors"
                      title="View in explorer"
                    >
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  </div>
                </div>
              </>
            )}
        </div>
      </div>

      {/* Claimable Rewards Card */}
      <div className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Claimable Rewards
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{formattedBalance}</span>
              <span className="text-lg text-muted-foreground">{stablecoin?.symbol}</span>
            </div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center">
            <HandCoins className="h-7 w-7 text-primary" />
          </div>
        </div>
        <Button
          className="w-full h-11"
          onClick={() => setActiveModal('claim')}
          disabled={!hasClaimableRewards}
        >
          <HandCoins className="h-4 w-4 mr-2" />
          {hasClaimableRewards ? 'Claim Rewards' : 'No Rewards to Claim'}
        </Button>
      </div>

      {/* Distribute Rewards Section */}
      <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.05)]">
          <h2 className="text-[13px] font-semibold text-foreground">Distribute Rewards</h2>
        </div>
        <button
          onClick={() => setActiveModal('start-reward')}
          className="w-full flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Gift className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-[13px] font-medium text-foreground">Start Reward Distribution</p>
              <p className="text-[11px] text-muted-foreground">
                Distribute tokens to all opted-in holders
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <h3 className="text-[12px] font-semibold text-blue-800 mb-2">How TIP-20 Rewards Work</h3>
        <ul className="space-y-1.5 text-[11px] text-blue-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>Opt in to start receiving your share of reward distributions</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>Rewards are distributed proportionally based on your token balance</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>Claim your accumulated rewards at any time</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>You can delegate rewards to another address if desired</span>
          </li>
        </ul>
      </div>

      {/* Modals */}
      <StartRewardModal
        isOpen={activeModal === 'start-reward'}
        selectedCoin={stablecoin}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <SetRecipientModal
        isOpen={activeModal === 'opt-in'}
        mode="opt-in"
        selectedCoin={stablecoin}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <SetRecipientModal
        isOpen={activeModal === 'opt-out'}
        mode="opt-out"
        selectedCoin={stablecoin}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <ClaimRewardsModal
        isOpen={activeModal === 'claim'}
        selectedCoin={stablecoin}
        claimableBalance={claimableBalance}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />
    </div>
  );
}
