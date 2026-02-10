import { createFileRoute } from '@tanstack/react-router';
import { useState, useRef, useEffect, useCallback, type ReactElement } from 'react';
import { useWalletClient } from 'wagmi';
import { type Address } from 'viem';
import { Actions } from 'viem/tempo';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUp,
  ArrowRight,
  ExternalLink,
  Loader2,
  Wallet,
  MessageSquare,
  Check,
  Sparkles,
  Copy,
  ChevronDown,
  DollarSign,
  Coins,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddressInput } from '@/components/AddressInput';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { useTempo } from '@/hooks/useTempo';
import { useTokensWithBalances } from '@/hooks/useTokenList';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { getTokenColors } from '@/lib/tokenlist';
import { DEFAULT_FEE_TOKEN_ADDRESS } from '@/lib/constants';
import {
  formatAddress,
  formatAmount,
  parseAmount,
  isValidAddress,
  copyToClipboard,
  cn,
} from '@/lib/utils';
import { addActivity } from '@/lib/activity';

export const Route = createFileRoute('/wallet/send')({
  component: SendPage,
});

type ModalState = 'confirm' | 'pending' | 'success' | null;

function SendPage(): ReactElement {
  const { address } = useTempo();
  const { data: walletClient } = useWalletClient();
  const { tokens, isLoading: tokensLoading } = useTokensWithBalances();

  const [selectedTokenAddress, setSelectedTokenAddress] =
    useState<Address>(DEFAULT_FEE_TOKEN_ADDRESS);
  const [feeTokenAddress, setFeeTokenAddress] = useState<Address>(DEFAULT_FEE_TOKEN_ADDRESS);
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const [showFeePicker, setShowFeePicker] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [modalState, setModalState] = useState<ModalState>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txCopied, setTxCopied] = useState(false);

  const pickerRef = useRef<HTMLDivElement>(null);
  const feePickerRef = useRef<HTMLDivElement>(null);

  // Close pickers on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent): void => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowTokenPicker(false);
      }
      if (feePickerRef.current && !feePickerRef.current.contains(e.target as Node)) {
        setShowFeePicker(false);
      }
    };
    if (showTokenPicker || showFeePicker) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showTokenPicker, showFeePicker]);

  const selectedToken = tokens.find(
    t => t.address.toLowerCase() === selectedTokenAddress.toLowerCase()
  );
  const feeToken = tokens.find(t => t.address.toLowerCase() === feeTokenAddress.toLowerCase());
  const feeSymbol = feeToken?.symbol ?? 'AlphaUSD';

  const balance = selectedToken?.balance ?? 0n;
  const decimals = selectedToken?.decimals ?? 6;
  const symbol = selectedToken?.symbol ?? 'USD';
  const parsedAmount = parseAmount(amount, decimals);
  const hasBalance = balance >= parsedAmount;
  const isValidForm = isValidAddress(recipient) && parsedAmount > 0n && hasBalance;

  const handleSelectToken = useCallback((tokenAddress: Address) => {
    setSelectedTokenAddress(tokenAddress);
    setShowTokenPicker(false);
    setAmount('');
  }, []);

  const handleSubmit = async (): Promise<void> => {
    if (!isValidForm || !walletClient) return;

    setModalState('pending');

    try {
      let encodedMemo: `0x${string}` | undefined;
      if (memo) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(memo);
        encodedMemo = `0x${Array.from(bytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')}` as `0x${string}`;
      }

      const hash = await Actions.token.transfer(walletClient, {
        token: selectedTokenAddress,
        to: recipient as Address,
        amount: parsedAmount,
        memo: encodedMemo,
        feeToken: feeTokenAddress,
      });

      setTxHash(hash);
      setModalState('success');

      addActivity({
        type: 'send_payment',
        status: 'success',
        appName: 'Temporium Wallet',
        appUrl: window.location.origin,
        txHash: hash,
        details: {
          to: recipient,
          amount: amount,
          memo: memo || undefined,
        },
      });
    } catch (err) {
      console.error('Payment failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to send payment');
      setModalState('confirm');

      addActivity({
        type: 'send_payment',
        status: 'failed',
        appName: 'Temporium Wallet',
        appUrl: window.location.origin,
        details: {
          to: recipient,
          amount: amount,
          error: err instanceof Error ? err.message : 'Failed',
        },
      });
    }
  };

  const resetForm = (): void => {
    setRecipient('');
    setAmount('');
    setMemo('');
    setTxHash(null);
    setTxCopied(false);
    setModalState(null);
  };

  const handleCloseModal = (): void => {
    if (modalState === 'success') {
      resetForm();
    } else if (modalState !== 'pending') {
      setModalState(null);
    }
  };

  const handleCopyTx = async (): Promise<void> => {
    if (!txHash) return;
    const ok = await copyToClipboard(txHash);
    if (ok) {
      setTxCopied(true);
      setTimeout(() => setTxCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ArrowUp className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[#2D3436]">Send</h1>
          <p className="text-[13px] text-muted-foreground">Transfer tokens to any wallet</p>
        </div>
      </motion.div>

      {/* Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden"
      >
        {/* Token & Amount Section */}
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              Amount
            </span>
            <button
              onClick={() => {
                if (balance > 0n) {
                  setAmount(formatAmount(balance.toString(), decimals));
                }
              }}
              className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors group"
            >
              <Wallet className="w-3 h-3 opacity-50 group-hover:opacity-80 transition-opacity" />
              <span className="tabular-nums">
                {tokensLoading ? '-.--' : formatAmount(balance.toString(), decimals)}
              </span>
              <span className="text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Max
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Amount input */}
            <div className="flex items-baseline gap-1 flex-1 min-w-0">
              <span className="text-[32px] font-extralight text-muted-foreground/40 select-none leading-none">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9.]/g, '');
                  if (val.split('.').length <= 2) setAmount(val);
                }}
                className="flex-1 text-[36px] font-semibold text-foreground bg-transparent border-none outline-none placeholder:text-border/60 tracking-tight leading-none min-w-0"
              />
            </div>

            {/* Token picker */}
            <div className="relative" ref={pickerRef}>
              <button
                onClick={() => setShowTokenPicker(!showTokenPicker)}
                className="flex items-center gap-2 h-10 pl-2.5 pr-2 rounded-xl border border-border/40 hover:border-border/60 bg-[#FDFBF8] hover:bg-[#F8F5F0] transition-all group"
              >
                <TokenIcon token={selectedToken} size="sm" />
                <span className="text-[13px] font-semibold text-[#2D3436] whitespace-nowrap">
                  {symbol}
                </span>
                <ChevronDown
                  className={cn(
                    'w-3.5 h-3.5 text-muted-foreground/50 transition-transform',
                    showTokenPicker && 'rotate-180'
                  )}
                />
              </button>

              {/* Dropdown */}
              <AnimatePresence>
                {showTokenPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1.5 z-50 w-[240px] bg-white border border-border/50 rounded-xl shadow-lg overflow-hidden"
                  >
                    <div className="px-3 py-2.5 border-b border-border/30">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                        Select token
                      </p>
                    </div>
                    <div className="max-h-[240px] overflow-y-auto py-1">
                      {tokens.length === 0 && tokensLoading ? (
                        <div className="px-3 py-4 flex items-center justify-center">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : tokens.length === 0 ? (
                        <div className="px-3 py-4 text-center">
                          <p className="text-[12px] text-muted-foreground">No tokens found</p>
                        </div>
                      ) : (
                        tokens.map(token => {
                          const isSelected =
                            token.address.toLowerCase() === selectedTokenAddress.toLowerCase();
                          return (
                            <button
                              key={token.address}
                              onClick={() => handleSelectToken(token.address)}
                              className={cn(
                                'w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#FDFBF8] transition-colors text-left',
                                isSelected && 'bg-[#FDFBF8]'
                              )}
                            >
                              <TokenIcon token={token} size="md" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-[#2D3436]">
                                  {token.symbol}
                                </p>
                                <p className="text-[11px] text-[#9B9590] truncate">{token.name}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[12px] font-semibold text-[#2D3436] tabular-nums">
                                  {formatAmount(token.balance.toString(), token.decimals)}
                                </p>
                              </div>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-[#5B9A6F] shrink-0" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <AnimatePresence>
            {amount && parsedAmount > 0n && !hasBalance && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-[12px] text-destructive mt-2 font-medium"
              >
                Insufficient balance
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="mx-6 border-t border-border/40" />

        {/* Recipient Section */}
        <div className="px-6 py-5">
          <AddressInput label="Recipient" value={recipient} onChange={setRecipient} />
        </div>

        {/* Divider */}
        <div className="mx-6 border-t border-border/40" />

        {/* Memo Section */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-1.5 mb-2">
            <MessageSquare className="w-3 h-3 text-muted-foreground/50" />
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              Memo
            </label>
            <span className="text-[10px] text-muted-foreground/40 font-normal normal-case ml-0.5">
              optional
            </span>
          </div>
          <Input
            placeholder="What's this for?"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            className="text-[13px] h-10 border-border/40"
          />
        </div>

        {/* Divider */}
        <div className="mx-6 border-t border-border/40" />

        {/* Fee Token Section */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Coins className="w-3 h-3 text-muted-foreground/50" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                Pay fee with
              </span>
            </div>

            <div className="relative" ref={feePickerRef}>
              <button
                onClick={() => setShowFeePicker(!showFeePicker)}
                className="flex items-center gap-1.5 h-8 pl-2 pr-2 rounded-lg border border-border/40 hover:border-border/60 bg-[#FDFBF8] hover:bg-[#F8F5F0] transition-all"
              >
                <TokenIcon token={feeToken} size="sm" />
                <span className="text-[12px] font-semibold text-[#2D3436]">{feeSymbol}</span>
                <ChevronDown
                  className={cn(
                    'w-3 h-3 text-muted-foreground/50 transition-transform',
                    showFeePicker && 'rotate-180'
                  )}
                />
              </button>

              <AnimatePresence>
                {showFeePicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 bottom-full mb-1.5 z-50 w-[200px] bg-white border border-border/50 rounded-xl shadow-lg overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-border/30">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                        Fee token
                      </p>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto py-1">
                      {tokens.map(token => {
                        const isSelected =
                          token.address.toLowerCase() === feeTokenAddress.toLowerCase();
                        return (
                          <button
                            key={token.address}
                            onClick={() => {
                              setFeeTokenAddress(token.address);
                              setShowFeePicker(false);
                            }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#FDFBF8] transition-colors text-left',
                              isSelected && 'bg-[#FDFBF8]'
                            )}
                          >
                            <TokenIcon token={token} size="sm" />
                            <span className="text-[12px] font-semibold text-[#2D3436] flex-1">
                              {token.symbol}
                            </span>
                            {isSelected && <Check className="w-3 h-3 text-[#5B9A6F] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="px-6 pb-6 pt-1">
          <Button
            className="w-full h-12 text-[14px] font-semibold rounded-xl"
            disabled={!isValidForm}
            onClick={() => setModalState('confirm')}
          >
            Review Payment
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </motion.div>

      {/* Modal */}
      <Dialog open={modalState !== null} onOpenChange={handleCloseModal}>
        <DialogContent
          hideClose={modalState === 'pending'}
          className="max-w-[360px] p-0 gap-0 overflow-hidden rounded-2xl border-border/40"
        >
          <AnimatePresence mode="wait">
            {/* ── CONFIRM STATE ── */}
            {modalState === 'confirm' && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
              >
                <DialogTitle className="sr-only">Confirm Payment</DialogTitle>
                <DialogDescription className="sr-only">
                  Review payment details before confirming
                </DialogDescription>

                {/* Header with amount hero */}
                <div className="relative px-6 pt-8 pb-6 text-center overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent pointer-events-none" />

                  <div className="relative">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                      You&apos;re sending
                    </p>
                    <div className="flex items-center justify-center gap-3 mb-1">
                      <TokenIcon token={selectedToken} size="lg" />
                      <p className="text-[40px] font-bold text-foreground tracking-tight leading-none">
                        {amount}
                      </p>
                    </div>
                    <p className="text-[13px] text-muted-foreground mt-1.5">{symbol}</p>
                  </div>
                </div>

                {/* Flow: from → to */}
                <div className="px-6 pb-5">
                  <div className="bg-[#FDFBF8] rounded-xl border border-border/30 overflow-hidden">
                    {/* From */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                          From
                        </p>
                        <p className="font-mono text-[13px] text-foreground truncate">
                          {address ? formatAddress(address, 8) : '---'}
                        </p>
                      </div>
                    </div>

                    {/* Arrow divider */}
                    <div className="relative h-0">
                      <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border border-border/40 flex items-center justify-center z-10">
                        <ArrowUp className="w-3 h-3 text-primary rotate-180" />
                      </div>
                      <div className="border-t border-border/30" />
                    </div>

                    {/* To */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <ArrowUp className="w-3.5 h-3.5 text-primary rotate-45" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                          To
                        </p>
                        <p className="font-mono text-[13px] text-foreground truncate">
                          {formatAddress(recipient, 8)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Memo (if present) */}
                  {memo && (
                    <div className="mt-3 flex items-start gap-2.5 px-1">
                      <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-0.5">
                          Memo
                        </p>
                        <p className="text-[13px] text-foreground break-words leading-relaxed">
                          {memo}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Network fee note */}
                <div className="mx-6 mb-5 px-3 py-2 rounded-lg bg-muted/40 flex items-center justify-center gap-1.5">
                  <Coins className="w-3 h-3 text-muted-foreground/50" />
                  <p className="text-[11px] text-muted-foreground">
                    Network fee paid in {feeSymbol}
                  </p>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 flex items-center gap-2.5">
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-xl text-[13px]"
                    onClick={() => setModalState(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 h-11 rounded-xl text-[13px] font-semibold"
                    onClick={handleSubmit}
                  >
                    Send Now
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── PENDING STATE ── */}
            {modalState === 'pending' && (
              <motion.div
                key="pending"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="relative overflow-hidden"
              >
                <DialogTitle className="sr-only">Processing</DialogTitle>
                <DialogDescription className="sr-only">Processing your payment</DialogDescription>

                <div className="px-6 py-14 text-center">
                  {/* Animated rings */}
                  <div className="relative inline-flex items-center justify-center mb-8">
                    <motion.div
                      animate={{ scale: [1, 1.6, 1.6], opacity: [0.3, 0, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                      className="absolute w-14 h-14 rounded-full border-2 border-[#5B9A6F]/30"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.4, 1.4], opacity: [0.2, 0, 0] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeOut',
                        delay: 0.3,
                      }}
                      className="absolute w-14 h-14 rounded-full border-2 border-[#5B9A6F]/20"
                    />
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="w-14 h-14 rounded-full border-2 border-[#5B9A6F]/20 border-t-[#5B9A6F] flex items-center justify-center"
                    >
                      <Loader2 className="w-5 h-5 text-[#5B9A6F] animate-spin" />
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                      Sending
                    </p>
                    <p className="text-[36px] font-bold text-foreground tracking-tight leading-none">
                      {amount}
                    </p>
                    <p className="text-[13px] text-muted-foreground mt-1">{symbol}</p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-muted/50 border border-border/30"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-[#5B9A6F] animate-pulse" />
                    <span className="font-mono text-[11px] text-muted-foreground">
                      to {formatAddress(recipient, 6)}
                    </span>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* ── SUCCESS STATE ── */}
            {modalState === 'success' && txHash && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="relative overflow-hidden"
              >
                <DialogTitle className="sr-only">Payment Sent</DialogTitle>
                <DialogDescription className="sr-only">
                  Your payment was sent successfully
                </DialogDescription>

                {/* Green gradient bg */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#5B9A6F]/[0.06] to-transparent pointer-events-none" />

                <div className="relative px-6 pt-10 pb-6 text-center">
                  {/* Animated success mark */}
                  <div className="relative inline-flex items-center justify-center mb-6">
                    {/* Burst particles */}
                    {[...Array(6)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0, opacity: 0.8 }}
                        animate={{
                          scale: [0, 1],
                          opacity: [0.8, 0],
                          x: [0, Math.cos((i * 60 * Math.PI) / 180) * 28],
                          y: [0, Math.sin((i * 60 * Math.PI) / 180) * 28],
                        }}
                        transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                        className="absolute w-1.5 h-1.5 rounded-full bg-[#5B9A6F]/60"
                      />
                    ))}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.05 }}
                      className="w-16 h-16 rounded-full bg-[#5B9A6F] flex items-center justify-center shadow-lg shadow-[#5B9A6F]/20"
                    >
                      <motion.div
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ delay: 0.25, duration: 0.3 }}
                      >
                        <Check className="w-7 h-7 text-white" strokeWidth={3} />
                      </motion.div>
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <p className="text-[15px] font-semibold text-foreground mb-1">Payment Sent</p>
                    <p className="text-[36px] font-bold text-foreground tracking-tight leading-none">
                      {amount}
                    </p>
                    <p className="text-[13px] text-muted-foreground mt-1">{symbol}</p>
                  </motion.div>

                  {/* Details card */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="mt-6 bg-[#FDFBF8] rounded-xl border border-border/30 overflow-hidden text-left"
                  >
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                        Recipient
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[12px] text-foreground">
                          {formatAddress(recipient, 6)}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-border/20" />

                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                        Transaction
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={handleCopyTx}
                          className="flex items-center gap-1 text-[12px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {txHash.slice(0, 6)}...{txHash.slice(-4)}
                          {txCopied ? (
                            <Check className="w-3 h-3 text-[#5B9A6F]" />
                          ) : (
                            <Copy className="w-3 h-3 opacity-40" />
                          )}
                        </button>
                        <button
                          onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                          className="p-0.5 text-muted-foreground/40 hover:text-primary transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {memo && (
                      <>
                        <div className="border-t border-border/20" />
                        <div className="flex items-start justify-between px-4 py-3">
                          <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider shrink-0">
                            Memo
                          </span>
                          <p className="text-[12px] text-foreground text-right ml-4 break-words leading-relaxed">
                            {memo}
                          </p>
                        </div>
                      </>
                    )}
                  </motion.div>
                </div>

                {/* Actions */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 }}
                  className="px-6 pb-6 flex items-center gap-2.5"
                >
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-xl text-[13px]"
                    onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Explorer
                  </Button>
                  <Button
                    className="flex-1 h-11 rounded-xl text-[13px] font-semibold"
                    onClick={resetForm}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Done
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Token icon with logo fallback */
function TokenIcon({
  token,
  size = 'md',
}: {
  token: { symbol: string; logoURI: string } | undefined;
  size?: 'sm' | 'md' | 'lg';
}): ReactElement {
  const sizeClasses = {
    sm: 'w-6 h-6 rounded-lg',
    md: 'w-8 h-8 rounded-xl',
    lg: 'w-10 h-10 rounded-xl',
  };
  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const colors = token ? getTokenColors(token.symbol) : { bg: '#F3F4F6', text: '#6B7280' };

  return (
    <div
      className={cn(sizeClasses[size], 'flex items-center justify-center overflow-hidden shrink-0')}
      style={{ backgroundColor: colors.bg }}
    >
      {token?.logoURI ? (
        <img
          src={token.logoURI}
          alt={token.symbol}
          className={cn(sizeClasses[size], 'object-cover')}
          onError={e => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      <DollarSign
        className={cn(iconSizes[size], token?.logoURI && 'hidden')}
        style={{ color: colors.text }}
      />
    </div>
  );
}
