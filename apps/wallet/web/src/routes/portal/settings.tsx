import { useState, type ReactElement } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check, DollarSign, Plus, Trash2, Search, Coins } from 'lucide-react';
import type { Address } from 'viem';
import type { Token } from '@/lib/tokenlist';
import { getTokenColors } from '@/lib/tokenlist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useTempo } from '@/hooks/useTempo';
import { useTokenList } from '@/hooks/useTokenList';
import { useFeePreference } from '@/hooks/useFeePreference';
import { useCustomTokens } from '@/hooks/useCustomTokens';
import { tempoChain, Actions, tempoPublicClient } from '@/lib/tempo-client';
import { toast } from '@/lib/toast';
import { cn, isValidAddress, formatAddress } from '@/lib/utils';

export const Route = createFileRoute('/portal/settings')({
  component: SettingsPage,
});

function TokenIcon({ token }: { token: Token }): ReactElement {
  const colors = getTokenColors(token.symbol);
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shrink-0"
      style={{ backgroundColor: colors.bg }}
    >
      {token.logoURI ? (
        <img
          src={token.logoURI}
          alt={token.symbol}
          className="w-8 h-8 rounded-full object-cover"
          onError={e => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      <DollarSign
        className={cn('h-4 w-4', token.logoURI && 'hidden')}
        style={{ color: colors.text }}
      />
    </div>
  );
}

function SettingsPage(): ReactElement | null {
  const { isConnected, address } = useTempo();
  const { tokens, officialTokens } = useTokenList();
  const { preferredFeeToken, isLoading: prefLoading, setFeePreference } = useFeePreference();
  const { customTokens, addToken, removeToken, isLoading: customLoading } = useCustomTokens();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);

  // Custom token add state
  const [tokenAddress, setTokenAddress] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (!isConnected || !address) return null;

  // Which address is currently active on-chain
  const onChainAddress = preferredFeeToken?.toLowerCase() ?? null;

  // What the user has picked (null = no change yet)
  const hasChanged = selectedAddress !== null && selectedAddress !== onChainAddress;

  const handleSave = async (): Promise<void> => {
    if (!selectedAddress) return;
    const token = officialTokens.find(t => t.address.toLowerCase() === selectedAddress);
    if (!token) return;
    setIsSaving(true);
    try {
      await setFeePreference(token.address);
      setSelectedAddress(null);
      toast.success('Fee token preference saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save preference';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCustomToken = async (): Promise<void> => {
    if (!isValidAddress(tokenAddress)) {
      toast.error('Invalid token address');
      return;
    }

    // Check if already in list
    const exists = tokens.some(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
    if (exists) {
      toast.error('Token is already in your list');
      return;
    }

    setIsLookingUp(true);
    try {
      // Look up on-chain metadata
      const metadata = await Actions.token.getMetadata(tempoPublicClient, {
        token: tokenAddress as Address,
      });

      if (!metadata || !metadata.symbol) {
        toast.error('Could not find token at this address');
        setIsLookingUp(false);
        return;
      }

      setIsLookingUp(false);
      setIsAdding(true);

      await addToken({
        address: tokenAddress.toLowerCase(),
        name: metadata.name || metadata.symbol,
        symbol: metadata.symbol,
        decimals: metadata.decimals ?? 6,
      });

      toast.success(`Added ${metadata.symbol} to your token list`);
      setTokenAddress('');
    } catch (err) {
      console.error('Failed to add token:', err);
      const message = err instanceof Error ? err.message : 'Failed to add token';
      toast.error(message);
    } finally {
      setIsLookingUp(false);
      setIsAdding(false);
    }
  };

  const handleRemoveToken = async (id: string): Promise<void> => {
    setRemovingId(id);
    try {
      await removeToken(id);
      toast.success('Token removed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove token';
      toast.error(message);
    } finally {
      setRemovingId(null);
    }
  };

  // Determine which row is visually selected
  const activeAddress = selectedAddress ?? onChainAddress;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[20px] font-bold text-[#2D3436]">Settings</h1>
        <p className="text-[13px] text-[#9B9590] mt-1">
          Manage your account preferences and custom tokens
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="fee-token">
        <TabsList className="bg-[#F5F2ED] rounded-xl p-1">
          <TabsTrigger
            value="fee-token"
            className="rounded-lg text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#2D3436] text-[#9B9590] px-4"
          >
            <DollarSign className="w-3.5 h-3.5 mr-1.5" />
            Fee Token
          </TabsTrigger>
          <TabsTrigger
            value="custom-tokens"
            className="rounded-lg text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#2D3436] text-[#9B9590] px-4"
          >
            <Coins className="w-3.5 h-3.5 mr-1.5" />
            Custom Tokens
            {customTokens.length > 0 && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[#E07A5F]/10 text-[#E07A5F] font-semibold">
                {customTokens.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Fee Token Tab */}
        <TabsContent value="fee-token" className="mt-4">
          <div className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm">
            <div className="p-5 pb-4">
              <h2 className="text-[15px] font-semibold text-[#2D3436]">Fee Token Preference</h2>
              <p className="text-[13px] text-[#9B9590] mt-1">
                Choose the default token used to pay network fees. This is stored on-chain and
                applies across all apps.
              </p>
            </div>

            {/* Token list */}
            <div className="px-3 pb-2">
              {prefLoading ? (
                <div className="flex items-center justify-center gap-2 py-8">
                  <Loader2 className="w-4 h-4 text-[#9B9590] animate-spin" />
                  <span className="text-[13px] text-[#9B9590]">Loading preference...</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {officialTokens.map(token => {
                    const addr = token.address.toLowerCase();
                    const isActive = activeAddress === addr;
                    const isOnChain = onChainAddress === addr;
                    const isChainDefault =
                      addr === tempoChain.feeToken.toLowerCase() && !onChainAddress;

                    return (
                      <button
                        key={token.address}
                        type="button"
                        onClick={() => setSelectedAddress(addr)}
                        disabled={isSaving}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all',
                          isActive
                            ? 'bg-[#E07A5F]/[0.07] ring-1 ring-[#E07A5F]/20'
                            : 'hover:bg-[#F5F2ED]'
                        )}
                      >
                        <TokenIcon token={token} />
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              'text-[13px] font-semibold leading-none',
                              isActive ? 'text-[#E07A5F]' : 'text-[#2D3436]'
                            )}
                          >
                            {token.symbol}
                          </p>
                          <p className="text-[11px] text-[#9B9590] mt-0.5 leading-none truncate">
                            {token.name}
                          </p>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isOnChain && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#5B9A6F]/10 text-[#5B9A6F] font-semibold uppercase tracking-wide">
                              Current
                            </span>
                          )}
                          {isChainDefault && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#9B9590]/10 text-[#9B9590] font-semibold uppercase tracking-wide">
                              Default
                            </span>
                          )}
                          {isActive && (
                            <div className="w-5 h-5 rounded-full bg-[#E07A5F] flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Save */}
            <div className="px-5 pb-5 pt-3">
              <Button
                disabled={!hasChanged || isSaving}
                onClick={handleSave}
                className={cn(
                  'w-full h-12 rounded-xl text-[14px] font-semibold transition-all',
                  hasChanged
                    ? 'bg-[#E07A5F] hover:bg-[#D4694F] text-white'
                    : 'bg-[#EDE9E3] text-[#9B9590] cursor-not-allowed'
                )}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Preference'
                )}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Custom Tokens Tab */}
        <TabsContent value="custom-tokens" className="mt-4">
          <div className="space-y-4">
            {/* Add token card */}
            <div className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm p-5">
              <h2 className="text-[15px] font-semibold text-[#2D3436] mb-1">Add Custom Token</h2>
              <p className="text-[13px] text-[#9B9590] mb-4">
                Paste a token contract address to look up its details on-chain. Custom tokens appear
                across all features — send, batch send, rewards, approvals, and more.
              </p>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#B5B0AA]" />
                  <Input
                    type="text"
                    placeholder="Token address (0x...)"
                    value={tokenAddress}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setTokenAddress(e.target.value.trim())
                    }
                    className="pl-9 text-[13px] h-10 rounded-xl border-[#EDE9E3] bg-[#FDFBF8] focus:border-[#E07A5F] focus:ring-1 focus:ring-[#E07A5F]/20 transition-all font-mono"
                  />
                </div>
                <Button
                  disabled={!isValidAddress(tokenAddress) || isLookingUp || isAdding}
                  onClick={handleAddCustomToken}
                  className="h-10 px-4 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D4694F] text-white transition-all"
                >
                  {isLookingUp || isAdding ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add
                    </>
                  )}
                </Button>
              </div>
              {tokenAddress && !isValidAddress(tokenAddress) && (
                <p className="text-[11px] text-red-500 mt-1.5">
                  Enter a valid address (0x followed by 40 hex characters)
                </p>
              )}
            </div>

            {/* Token list */}
            {customLoading ? (
              <div className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm">
                <div className="flex items-center justify-center gap-2 py-12">
                  <Loader2 className="w-4 h-4 text-[#9B9590] animate-spin" />
                  <span className="text-[13px] text-[#9B9590]">Loading tokens...</span>
                </div>
              </div>
            ) : customTokens.length === 0 ? (
              <div className="text-center py-16 bg-white border border-[#EDE9E3] rounded-2xl">
                <div className="w-12 h-12 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-3">
                  <Coins className="w-5 h-5 text-[#9B9590]" />
                </div>
                <p className="text-[14px] font-medium text-[#2D3436]">No custom tokens</p>
                <p className="text-[13px] text-[#9B9590] mt-1">
                  Tokens you add will appear here and across all features
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm overflow-hidden">
                <AnimatePresence initial={false}>
                  {customTokens.map((ct, index) => {
                    const isRemoving = removingId === ct.id;
                    return (
                      <motion.div
                        key={ct.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div
                          className={cn(
                            'flex items-center gap-3.5 px-5 py-4 hover:bg-[#FDFBF8] transition-colors',
                            index < customTokens.length - 1 && 'border-b border-[#EDE9E3]/40'
                          )}
                        >
                          <div className="w-9 h-9 rounded-full bg-[#F3F4F6] flex items-center justify-center shrink-0">
                            <DollarSign className="h-4 w-4 text-[#6B7280]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] font-semibold text-[#2D3436] leading-none">
                                {ct.symbol}
                              </p>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F5F2ED] text-[#9B9590] font-medium">
                                {ct.decimals} decimals
                              </span>
                            </div>
                            <p className="text-[11px] text-[#9B9590] mt-0.5 leading-none truncate">
                              {ct.name}
                            </p>
                            <p className="text-[10px] font-mono text-[#B5B0AA] mt-1 leading-none">
                              {formatAddress(ct.address, 8)}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={isRemoving}
                            onClick={() => handleRemoveToken(ct.id)}
                            className="p-2 rounded-lg text-[#B5B0AA] hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                          >
                            {isRemoving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
