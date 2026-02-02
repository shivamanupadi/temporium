import { createFileRoute } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';
import { useReadContract, useWalletClient } from 'wagmi';
import { erc20Abi } from 'viem';
import { type Address } from 'viem';
import { Actions } from 'viem/tempo';
import { motion } from 'framer-motion';
import {
  Send,
  ExternalLink,
  Loader2,
  DollarSign,
  Wallet,
  StickyNote,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddressInput } from '@/components/AddressInput';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useTempo } from '@/hooks/useTempo';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { DEFAULT_FEE_TOKEN_ADDRESS } from '@/lib/constants';
import { formatAddress, formatAmount, parseAmount, isValidAddress } from '@/lib/utils';
import { addActivity } from '@/lib/activity';

export const Route = createFileRoute('/wallet/send')({
  component: SendPage,
});

type ModalState = 'confirm' | 'pending' | 'success' | null;

function SendPage(): ReactElement {
  const { address } = useTempo();
  const { data: walletClient } = useWalletClient();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [modalState, setModalState] = useState<ModalState>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { data: rawBalance, isLoading: balanceLoading } = useReadContract({
    address: DEFAULT_FEE_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const balance = rawBalance ? { value: rawBalance, decimals: 6 } : undefined;

  const decimals = balance?.decimals || 6;
  const parsedAmount = parseAmount(amount, decimals);
  const hasBalance = balance?.value && balance.value >= parsedAmount;
  const isValidForm = isValidAddress(recipient) && parsedAmount > 0n && hasBalance;

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
        token: DEFAULT_FEE_TOKEN_ADDRESS,
        to: recipient as Address,
        amount: parsedAmount,
        memo: encodedMemo,
        feeToken: DEFAULT_FEE_TOKEN_ADDRESS,
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
    setModalState(null);
  };

  const handleCloseModal = (): void => {
    if (modalState === 'success') {
      resetForm();
    } else if (modalState !== 'pending') {
      setModalState(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Send</h1>
        <p className="text-sm text-muted-foreground mt-1">Send USD to any address</p>
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-border/50 rounded-2xl p-6 shadow-sm space-y-5"
      >
        {/* Amount Input */}
        <div>
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-4xl font-light text-border">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={e => {
                const val = e.target.value.replace(/[^0-9.]/g, '');
                if (val.split('.').length <= 2) setAmount(val);
              }}
              className="w-full text-4xl font-light text-foreground bg-transparent border-none outline-none pl-7 placeholder:text-border"
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[12px] text-muted-foreground">USD</span>
            <button
              onClick={() => {
                if (balance?.value) {
                  setAmount(formatAmount(balance.value.toString(), decimals));
                }
              }}
              className="text-[12px] text-primary hover:text-primary/80 transition-colors font-medium min-w-[80px] text-right"
            >
              {balanceLoading ? '-.--' : formatAmount(balance?.value.toString() || '0', decimals)}{' '}
              available
            </button>
          </div>
          {amount && parsedAmount > 0n && !hasBalance && (
            <p className="text-[12px] text-destructive mt-1">Insufficient balance</p>
          )}
        </div>

        <div className="border-t border-border/50" />

        {/* Recipient */}
        <AddressInput label="Recipient" value={recipient} onChange={setRecipient} />

        {/* Memo */}
        <div>
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
            Memo <span className="text-muted-foreground/60 normal-case">(optional)</span>
          </label>
          <Input
            placeholder="Add a note..."
            value={memo}
            onChange={e => setMemo(e.target.value)}
            className="text-[13px] h-10"
          />
        </div>

        {/* Submit */}
        <Button
          className="w-full h-11 text-[14px] font-medium"
          disabled={!isValidForm}
          onClick={() => setModalState('confirm')}
        >
          <Send className="w-4 h-4 mr-2" />
          Review Payment
        </Button>
      </motion.div>

      {/* Modal */}
      <Dialog open={modalState !== null} onOpenChange={handleCloseModal}>
        <DialogContent
          hideClose={modalState === 'pending'}
          className="max-w-sm p-0 gap-0 overflow-hidden rounded-2xl"
        >
          {/* CONFIRM STATE */}
          {modalState === 'confirm' && (
            <>
              <div className="px-6 pt-6 pb-4">
                <DialogTitle className="text-lg font-semibold">Confirm Payment</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Review the details before confirming
                </DialogDescription>
              </div>

              <div className="px-6 pb-6">
                <div className="bg-muted/50 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Amount</p>
                      <p className="text-lg font-semibold text-foreground">{amount} USD</p>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Recipient</p>
                      <p className="font-mono text-sm text-foreground truncate">
                        {formatAddress(recipient, 10)}
                      </p>
                    </div>
                  </div>
                </div>

                {memo && (
                  <div className="bg-muted/50 rounded-xl p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
                        <StickyNote className="h-4 w-4 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Memo</p>
                        <p className="text-sm text-foreground mt-0.5 break-words">{memo}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 pb-6 flex items-center gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setModalState(null)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleSubmit}>
                  Confirm
                </Button>
              </div>
            </>
          )}

          {/* PENDING STATE */}
          {modalState === 'pending' && (
            <div className="relative overflow-hidden">
              <DialogTitle className="sr-only">Processing</DialogTitle>
              <DialogDescription className="sr-only">Processing your payment</DialogDescription>

              <div className="px-6 py-12 text-center">
                <div className="relative inline-flex items-center justify-center mb-6">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-14 h-14 rounded-full flex items-center justify-center bg-emerald-50"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    >
                      <Loader2 className="w-6 h-6 text-emerald-500" />
                    </motion.div>
                  </motion.div>
                </div>

                <p className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Sending
                </p>
                <p className="text-[32px] font-semibold text-foreground tracking-tight leading-none">
                  {amount}
                  <span className="text-[20px] font-medium text-muted-foreground ml-2">USD</span>
                </p>

                <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/60">
                  <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-mono text-[12px] text-muted-foreground">
                    {formatAddress(recipient, 6)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* SUCCESS STATE */}
          {modalState === 'success' && txHash && (
            <div className="relative overflow-hidden bg-white">
              <DialogTitle className="sr-only">Success</DialogTitle>
              <DialogDescription className="sr-only">Payment completed</DialogDescription>

              <div className="relative px-6 pt-10 pb-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6"
                >
                  <CheckCircle className="w-7 h-7 text-white" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <p className="text-foreground text-sm font-semibold mb-1">Payment Successful</p>
                  <p className="text-3xl font-semibold text-foreground mb-6">
                    {amount}
                    <span className="text-lg text-muted-foreground ml-1.5">USD</span>
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-muted/50 rounded-xl p-4 space-y-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">To</span>
                    <div className="flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs text-foreground">
                        {formatAddress(recipient, 8)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Transaction</span>
                    <button
                      onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      <span className="font-mono">
                        {txHash.slice(0, 8)}...{txHash.slice(-4)}
                      </span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="px-6 pb-6"
              >
                <Button className="w-full" onClick={resetForm}>
                  Done
                </Button>
              </motion.div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
