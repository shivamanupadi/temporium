import { useState, type ReactElement } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, DollarSign, Plus, Trash2, Search, Coins, ExternalLink } from 'lucide-react';
import type { Address } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTempo } from '@/hooks/useTempo';
import { useCustomTokens } from '@/hooks/useCustomTokens';
import { Actions, tempoPublicClient } from '@/lib/tempo-client';
import { toast } from '@/lib/toast';
import { cn, isValidAddress, formatAddress } from '@/lib/utils';
import { LINKS } from '@/lib/constants';

export const Route = createFileRoute('/portal/settings/custom-tokens')({
  component: CustomTokensSettings,
});

function CustomTokensSettings(): ReactElement | null {
  const { isConnected, address } = useTempo();
  const { customTokens, addToken, removeToken, isLoading: customLoading } = useCustomTokens();

  const [tokenAddress, setTokenAddress] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (!isConnected || !address) return null;

  const handleAddCustomToken = async (): Promise<void> => {
    if (!isValidAddress(tokenAddress)) {
      toast.error('Invalid token address');
      return;
    }

    setIsLookingUp(true);
    try {
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

  return (
    <div className="space-y-4">
      {/* Add token card */}
      <div className="bg-white rounded-2xl border border-[#EDE9E3] p-5">
        <h2 className="text-[15px] font-semibold text-[#2D3436] mb-1">Add Custom Token</h2>
        <p className="text-[13px] text-[#9B9590] mb-4">
          Paste a token contract address to look up its details on-chain. Custom tokens appear
          across all features: send, batch payments, rewards, approvals, and more.
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
              className="pl-9 text-[13px] bg-[#FDFBF8] font-mono"
            />
          </div>
          <Button
            disabled={!isValidAddress(tokenAddress) || isLookingUp || isAdding}
            onClick={handleAddCustomToken}
            className="h-12 px-4 text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D4694F] text-white transition-all"
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
        <div className="bg-white rounded-2xl border border-[#EDE9E3]">
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
        <div className="bg-white rounded-2xl border border-[#EDE9E3] overflow-hidden">
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
                    <a
                      href={`${LINKS.explorer}/token/${ct.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-[#B5B0AA] hover:text-[#6B6560] transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
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
  );
}
