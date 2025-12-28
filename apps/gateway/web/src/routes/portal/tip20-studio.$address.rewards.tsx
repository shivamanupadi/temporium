import { createFileRoute } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';
import {
  Gift,
  UserCheck,
  UserX,
  HandCoins,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRewards } from '@/hooks/useRewards';
import { useTip20Studio } from '@/hooks/useTip20Studio';
import { formatAmount, formatAddress } from '@/lib/utils';
import { getExplorerAddressUrl } from '@/lib/tempo-client';
import { StartRewardModal, SetRecipientModal, ClaimRewardsModal } from '@/components/stablecoins';
import type { Address } from 'viem';

export const Route = createFileRoute('/portal/tip20-studio/$address/rewards')({
  component: Tip20StudioRewards,
});

type RewardsModal = 'start-reward' | 'opt-in' | 'opt-out' | 'claim' | null;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

function Tip20StudioRewards(): ReactElement {
  const { address: tokenAddress } = Route.useParams();
  const {
    stablecoin,
    isLoading: isLoadingToken,
    refresh: refreshToken,
  } = useTip20Studio(tokenAddress);
  const {
    rewardInfo,
    isLoading: isLoadingRewards,
    refresh: refreshRewards,
  } = useRewards({ token: stablecoin?.address });

  const [activeModal, setActiveModal] = useState<RewardsModal>(null);
  const [copiedRecipient, setCopiedRecipient] = useState(false);

  const decimals = stablecoin?.metadata?.decimals ?? 6;
  const isOptedIn = rewardInfo?.isOptedIn ?? false;
  const claimableBalance = rewardInfo?.rewardBalance ?? 0n;
  const formattedBalance = formatAmount(claimableBalance.toString(), decimals);
  const hasClaimableRewards = claimableBalance > 0n;

  const handleSuccess = (): void => {
    refreshRewards();
    refreshToken();
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

  if (isLoadingToken || isLoadingRewards) {
    return (
      <div className="animate-pulse">
        <div className="lg:flex lg:gap-6 lg:items-stretch">
          {/* Left Column Skeleton */}
          <div className="lg:flex-[3]">
            {/* Hero Section Skeleton */}
            <div className="bg-muted/30 rounded-2xl p-6 mb-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-muted" />
                  <div>
                    <div className="h-3 w-28 bg-muted rounded mb-2" />
                    <div className="h-8 w-24 bg-muted rounded mb-2" />
                    <div className="h-5 w-20 bg-muted rounded-full" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 h-11 bg-muted rounded-lg" />
                <div className="flex-1 h-11 bg-muted rounded-lg" />
              </div>
            </div>
            {/* Stats Grid Skeleton */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {[1, 2].map(i => (
                <div
                  key={i}
                  className="bg-white rounded-xl p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)]"
                >
                  <div className="h-3 w-20 bg-muted rounded mb-2" />
                  <div className="h-6 w-16 bg-muted rounded mb-1" />
                  <div className="h-3 w-12 bg-muted rounded" />
                </div>
              ))}
            </div>
            {/* How It Works Skeleton */}
            <div className="bg-white rounded-xl p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)]">
              <div className="h-4 w-40 bg-muted rounded mb-3" />
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-muted" />
                    <div>
                      <div className="h-3 w-28 bg-muted rounded mb-1" />
                      <div className="h-3 w-44 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column Skeleton */}
          <div className="lg:flex-[2] mt-6 lg:mt-0">
            <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] overflow-hidden h-full">
              <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.05)]">
                <div className="h-4 w-28 bg-muted rounded" />
              </div>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="p-4 border-b border-[rgba(0,0,0,0.03)] last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted" />
                    <div>
                      <div className="h-4 w-24 bg-muted rounded mb-1" />
                      <div className="h-3 w-36 bg-muted rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Two Column Layout - matching overview */}
      <div className="lg:flex lg:gap-6 lg:items-stretch">
        {/* Left Column - Main Content */}
        <div className="lg:flex-[3]">
          {/* Hero Section - Claimable Rewards */}
          <div className="bg-emerald-500/10 rounded-2xl p-6 mb-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                  <HandCoins className="h-8 w-8 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Claimable Rewards
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground">{formattedBalance}</span>
                    <span className="text-lg text-muted-foreground">{stablecoin?.symbol}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${
                        isOptedIn
                          ? 'text-emerald-600 bg-emerald-100'
                          : 'text-muted-foreground bg-muted'
                      }`}
                    >
                      {isOptedIn ? 'Opted In' : 'Not Opted In'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={() => setActiveModal('claim')}
                className="flex-1 h-11 bg-emerald-500 hover:bg-emerald-600"
              >
                <HandCoins className="h-4 w-4 mr-2" />
                Claim Rewards
              </Button>
              <Button
                onClick={() => setActiveModal(isOptedIn ? 'opt-out' : 'opt-in')}
                variant="outline"
                className="flex-1 h-11 bg-white"
              >
                {isOptedIn ? (
                  <>
                    <UserX className="h-4 w-4 mr-2" /> Opt Out
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" /> Opt In
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)]">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Your Balance
              </p>
              <p className="text-xl font-bold text-foreground mt-1">
                {stablecoin?.userBalance !== undefined
                  ? formatAmount(stablecoin.userBalance.toString(), decimals)
                  : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground">{stablecoin?.symbol}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)]">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Your Reward Status
              </p>
              <p
                className={`text-xl font-bold mt-1 ${isOptedIn ? 'text-emerald-600' : 'text-muted-foreground'}`}
              >
                {isOptedIn ? 'Active' : 'Inactive'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isOptedIn ? 'Receiving rewards' : 'Opt in to receive rewards'}
              </p>
            </div>
          </div>

          {/* Recipient Card (if opted in) */}
          {isOptedIn &&
            rewardInfo?.rewardRecipient &&
            rewardInfo.rewardRecipient !== ZERO_ADDRESS && (
              <div className="bg-white rounded-xl p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] mb-6">
                <h3 className="text-[13px] font-semibold text-foreground mb-3">Reward Recipient</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <UserCheck className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-foreground font-mono">
                        {formatAddress(rewardInfo.rewardRecipient, 8)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Rewards will be sent here</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={copyRecipientAddress}
                      className="p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                      title="Copy address"
                    >
                      {copiedRecipient ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <a
                      href={getExplorerAddressUrl(rewardInfo.rewardRecipient)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      title="View in explorer"
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  </div>
                </div>
              </div>
            )}

          {/* How It Works Card */}
          <div className="bg-white rounded-xl p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)]">
            <h3 className="text-[13px] font-semibold text-foreground mb-3">
              How TIP-20 Rewards Work
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[11px] font-semibold text-emerald-600">1</span>
                </div>
                <div>
                  <p className="text-[12px] font-medium text-foreground">Opt In to Rewards</p>
                  <p className="text-[11px] text-muted-foreground">
                    Set a recipient address to start receiving your share
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[11px] font-semibold text-emerald-600">2</span>
                </div>
                <div>
                  <p className="text-[12px] font-medium text-foreground">Earn Proportionally</p>
                  <p className="text-[11px] text-muted-foreground">
                    Rewards are split based on your token balance
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[11px] font-semibold text-emerald-600">3</span>
                </div>
                <div>
                  <p className="text-[12px] font-medium text-foreground">Claim Anytime</p>
                  <p className="text-[11px] text-muted-foreground">
                    Withdraw accumulated rewards whenever you want
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Actions */}
        <div className="lg:flex-[2] mt-6 lg:mt-0">
          {/* Reward Actions */}
          <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] overflow-hidden h-full">
            <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.05)]">
              <h2 className="text-[13px] font-semibold text-foreground">Reward Actions</h2>
            </div>
            <button
              onClick={() => setActiveModal('claim')}
              className="w-full flex items-center justify-between p-4 transition-colors hover:bg-muted/50 border-b border-[rgba(0,0,0,0.03)]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <HandCoins className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-left">
                  <p className="text-[13px] font-medium text-foreground">Claim Rewards</p>
                  <p className="text-[11px] text-muted-foreground">
                    {hasClaimableRewards
                      ? `${formattedBalance} ${stablecoin?.symbol} available`
                      : 'Check claimable rewards'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setActiveModal('opt-in')}
              className="w-full flex items-center justify-between p-4 transition-colors hover:bg-muted/50 border-b border-[rgba(0,0,0,0.03)]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UserCheck className="h-4 w-4 text-green-500" />
                </div>
                <div className="text-left">
                  <p className="text-[13px] font-medium text-foreground">
                    {isOptedIn ? 'Change Recipient' : 'Opt In'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {isOptedIn ? 'Update your reward recipient' : 'Start receiving rewards'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            {isOptedIn && (
              <button
                onClick={() => setActiveModal('opt-out')}
                className="w-full flex items-center justify-between p-4 transition-colors hover:bg-muted/50 border-b border-[rgba(0,0,0,0.03)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <UserX className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-[13px] font-medium text-foreground">Opt Out</p>
                    <p className="text-[11px] text-muted-foreground">Stop receiving rewards</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <button
              onClick={() => setActiveModal('start-reward')}
              className="w-full flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Gift className="h-4 w-4 text-green-500" />
                </div>
                <div className="text-left">
                  <p className="text-[13px] font-medium text-foreground">Distribute Rewards</p>
                  <p className="text-[11px] text-muted-foreground">
                    Send rewards to all opted-in holders
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <StartRewardModal
        isOpen={activeModal === 'start-reward'}
        selectedCoin={stablecoin ?? null}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <SetRecipientModal
        isOpen={activeModal === 'opt-in'}
        mode="opt-in"
        selectedCoin={stablecoin ?? null}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <SetRecipientModal
        isOpen={activeModal === 'opt-out'}
        mode="opt-out"
        selectedCoin={stablecoin ?? null}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <ClaimRewardsModal
        isOpen={activeModal === 'claim'}
        selectedCoin={stablecoin ?? null}
        claimableBalance={claimableBalance}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />
    </>
  );
}
