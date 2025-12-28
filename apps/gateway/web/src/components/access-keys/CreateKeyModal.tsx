import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import {
  Loader2,
  Key,
  Lock,
  AlertTriangle,
  Copy,
  Check,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAccessKeys } from '@/hooks/useAccessKeys';
import { useTokenList } from '@/hooks/useTokenList';
import {
  generateSecp256k1Key,
  generateP256Key,
  getSignatureTypeNumber,
  type Secp256k1KeyPair,
  type P256KeyPair,
} from '@/lib/access-keys-utils';
import { copyToClipboard, formatAddress } from '@/lib/utils';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { TIMING } from '@/lib/constants';
import type { Token } from '@/lib/tokenlist';

import type { Address } from 'viem';
import { parseUnits } from 'viem';

type GeneratedKey = Secp256k1KeyPair | P256KeyPair;
type KeyType = 'secp256k1' | 'p256';

interface CreateKeyModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

type Step = 'type' | 'config' | 'save' | 'confirm';

interface SpendingLimit {
  token: Address;
  amount: string;
  symbol: string;
  decimals: number;
}

const STEPS: Step[] = ['type', 'config', 'save', 'confirm'];

const STEP_LABELS: Record<Step, string> = {
  type: 'Type',
  config: 'Configure',
  save: 'Save Key',
  confirm: 'Confirm',
};

export function CreateKeyModal({ isOpen, onSuccess, onClose }: CreateKeyModalProps): ReactElement {
  const { authorizeKey } = useAccessKeys();
  const { tokens } = useTokenList();

  const [currentStep, setCurrentStep] = useState<Step>('type');
  const [keyType, setKeyType] = useState<KeyType>('secp256k1');
  const [enforceLimits, setEnforceLimits] = useState(false);
  const [expiryDays, setExpiryDays] = useState('30');
  const [neverExpires, setNeverExpires] = useState(false);
  const [spendingLimits, setSpendingLimits] = useState<SpendingLimit[]>([]);
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [generatedKey, setGeneratedKey] = useState<GeneratedKey | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedTxHash, setCopiedTxHash] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const isCreatingRef = useRef(false);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('type');
      setKeyType('secp256k1');
      setEnforceLimits(false);
      setExpiryDays('30');
      setNeverExpires(false);
      setSpendingLimits([]);
      setFeeToken(null);
      setGeneratedKey(null);
      setIsCreating(false);
      setIsSuccess(false);
      setCopied(false);
      setCopiedTxHash(false);
      setTxHash(null);
    }
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, [isOpen]);

  const handleCopyPrivateKey = useCallback(async () => {
    if (generatedKey && 'privateKey' in generatedKey) {
      const success = await copyToClipboard(generatedKey.privateKey);
      if (success) {
        setCopied(true);
        copyTimeoutRef.current = setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
      }
    }
  }, [generatedKey]);

  const addSpendingLimit = useCallback(() => {
    if (tokens.length === 0) return;
    const firstToken = tokens[0];
    setSpendingLimits(prev => [
      ...prev,
      {
        token: firstToken.address as Address,
        amount: '',
        symbol: firstToken.symbol,
        decimals: firstToken.decimals,
      },
    ]);
  }, [tokens]);

  const removeSpendingLimit = useCallback((index: number) => {
    setSpendingLimits(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateSpendingLimit = useCallback(
    (index: number, field: 'token' | 'amount', value: string) => {
      setSpendingLimits(prev =>
        prev.map((limit, i) => {
          if (i !== index) return limit;
          if (field === 'token') {
            const token = tokens.find(t => t.address === value);
            return {
              ...limit,
              token: value as Address,
              symbol: token?.symbol ?? '',
              decimals: token?.decimals ?? 6,
            };
          }
          return { ...limit, amount: value };
        })
      );
    },
    [tokens]
  );

  const handleGenerateKey = useCallback(() => {
    try {
      const key = keyType === 'secp256k1' ? generateSecp256k1Key() : generateP256Key();
      setGeneratedKey(key);
      setCurrentStep('save');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate key';
      toast.error(message);
    }
  }, [keyType]);

  const calculateExpiry = useCallback((): number => {
    if (neverExpires) return 0;
    const days = parseInt(expiryDays, 10) || 30;
    return Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
  }, [neverExpires, expiryDays]);

  const handleSubmit = useCallback(async () => {
    if (!generatedKey) return;

    setIsCreating(true);
    isCreatingRef.current = true;

    try {
      const limits = spendingLimits
        .filter(l => l.amount && parseFloat(l.amount) > 0)
        .map(l => ({
          token: l.token,
          amount: parseUnits(l.amount, l.decimals),
        }));

      const result = await authorizeKey({
        keyId: generatedKey.keyId,
        signatureType: getSignatureTypeNumber(keyType),
        expiry: calculateExpiry(),
        enforceLimits: enforceLimits && limits.length > 0,
        limits,
        feeToken: feeToken?.address,
      });

      setTxHash(result.transactionHash);

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        ticks: 50,
        gravity: 3,
        decay: 0.9,
        scalar: 0.8,
      });

      setIsSuccess(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create access key';
      toast.error(message);
    } finally {
      setIsCreating(false);
      isCreatingRef.current = false;
    }
  }, [
    generatedKey,
    spendingLimits,
    keyType,
    calculateExpiry,
    enforceLimits,
    feeToken,
    authorizeKey,
  ]);

  const handleClose = useCallback(() => {
    if (!isCreating && !isCreatingRef.current) {
      if (isSuccess) {
        onSuccess();
      }
      onClose();
    }
  }, [isCreating, isSuccess, onSuccess, onClose]);

  const goToStep = (step: Step): void => {
    const currentIndex = STEPS.indexOf(currentStep);
    const targetIndex = STEPS.indexOf(step);

    // Can only go back freely, or forward if validation passes
    if (targetIndex < currentIndex) {
      setCurrentStep(step);
    } else if (targetIndex === currentIndex + 1) {
      handleNext();
    }
  };

  const handleNext = (): void => {
    if (currentStep === 'type') {
      setCurrentStep('config');
    } else if (currentStep === 'config') {
      handleGenerateKey();
    } else if (currentStep === 'save') {
      setCurrentStep('confirm');
    }
  };

  const handleBack = (): void => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1]);
    }
  };

  const getKeyTypeIcon = (type: 'secp256k1' | 'p256'): ReactElement => {
    return type === 'secp256k1' ? <Key className="h-5 w-5" /> : <Lock className="h-5 w-5" />;
  };

  const currentStepIndex = STEPS.indexOf(currentStep);

  const handleCopyTxHash = async (): Promise<void> => {
    if (txHash) {
      const success = await copyToClipboard(txHash);
      if (success) {
        setCopiedTxHash(true);
        setTimeout(() => setCopiedTxHash(false), TIMING.COPY_FEEDBACK_MS);
      }
    }
  };

  // Success state
  if (isSuccess && generatedKey) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl">
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-emerald-600" />
            </div>
            <DialogTitle className="text-lg font-semibold">Access Key Created!</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Your access key is now authorized
            </DialogDescription>
          </div>
          <div className="px-6 pb-6 space-y-3">
            <div className="bg-muted/50 rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Key ID</p>
              <p className="font-mono text-sm break-all">{generatedKey.keyId}</p>
            </div>
            {txHash && (
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Transaction</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm break-all flex-1">{formatAddress(txHash, 10)}</p>
                  <button
                    onClick={handleCopyTxHash}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
                  >
                    {copiedTxHash ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <a
                    href={getExplorerTxUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </a>
                </div>
              </div>
            )}
            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle className="text-lg font-semibold">Create Access Key</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {currentStep === 'type' && 'Choose the type of key to create'}
            {currentStep === 'config' && 'Set expiry and spending limits'}
            {currentStep === 'save' && 'Save your private key securely'}
            {currentStep === 'confirm' && 'Review and authorize the key'}
          </DialogDescription>
          {currentStep === 'type' && (
            <div className="mt-3 bg-muted/50 border border-border rounded-lg p-2.5">
              <p className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Note:</span> This feature is only
                available for Passkey wallets.
              </p>
            </div>
          )}
        </div>

        {/* Step Pills */}
        <div className="px-6 pb-4 flex-shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {STEPS.map((step, index) => (
              <div key={step} className="flex items-center">
                <button
                  onClick={() => goToStep(step)}
                  disabled={index > currentStepIndex + 1}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-all duration-200 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed ${
                    currentStep === step
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {index + 1}. {STEP_LABELS[step]}
                </button>
                {index < STEPS.length - 1 && <div className="w-2 h-px bg-slate-200 mx-0.5" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content with Slide Animation */}
        <div className="overflow-hidden flex-1">
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{
              transform: `translateX(-${currentStepIndex * 25}%)`,
              width: '400%',
            }}
          >
            {/* Step 1: Type Selection */}
            <div className="w-1/4 flex-shrink-0 px-6 pb-4">
              <div className="space-y-3">
                {(['secp256k1', 'p256'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setKeyType(type)}
                    className={`w-full p-4 rounded-xl transition-colors text-left cursor-pointer ${
                      keyType === type
                        ? 'bg-primary/5'
                        : 'border border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          keyType === type
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {getKeyTypeIcon(type)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {type === 'secp256k1' && 'Secp256k1'}
                          {type === 'p256' && 'P256'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {type === 'secp256k1' && 'Standard Ethereum key'}
                          {type === 'p256' && 'Modern elliptic curve'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Configuration */}
            <div className="w-1/4 flex-shrink-0 px-6 pb-4">
              <div className="space-y-4">
                {/* Expiry */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Expiry
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      placeholder="30"
                      value={expiryDays}
                      onChange={e => setExpiryDays(e.target.value)}
                      disabled={neverExpires}
                      className="h-10 flex-1"
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Switch checked={neverExpires} onCheckedChange={setNeverExpires} />
                    <span className="text-xs text-muted-foreground">Never expires</span>
                  </div>
                </div>

                {/* Enforce Limits */}
                <div className="flex items-center justify-between py-3 border-t border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Spending Limits</p>
                    <p className="text-xs text-muted-foreground">Restrict token spending</p>
                  </div>
                  <Switch checked={enforceLimits} onCheckedChange={setEnforceLimits} />
                </div>

                {/* Spending Limits List */}
                {enforceLimits && (
                  <div className="space-y-2">
                    {spendingLimits.map((limit, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <select
                          value={limit.token}
                          onChange={e => updateSpendingLimit(index, 'token', e.target.value)}
                          className="h-9 px-2 rounded-md border border-input bg-background text-xs flex-1"
                        >
                          {tokens.map(token => (
                            <option key={token.address} value={token.address}>
                              {token.symbol}
                            </option>
                          ))}
                        </select>
                        <Input
                          type="number"
                          placeholder="Amount"
                          value={limit.amount}
                          onChange={e => updateSpendingLimit(index, 'amount', e.target.value)}
                          className="h-9 flex-1 text-xs"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSpendingLimit(index)}
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addSpendingLimit}
                      className="w-full h-8 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Limit
                    </Button>
                  </div>
                )}

                <FeeTokenSelector
                  value={feeToken}
                  onChange={setFeeToken}
                  className="pt-3 border-t border-border"
                />
              </div>
            </div>

            {/* Step 3: Save Key */}
            <div className="w-1/4 flex-shrink-0 px-6 pb-4">
              {generatedKey && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-amber-800">
                          Save this key securely!
                        </p>
                        <p className="text-[10px] text-amber-700 mt-0.5">
                          You will not see it again.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                      Private Key
                    </label>
                    <div className="relative">
                      <div className="p-3 bg-muted rounded-lg font-mono text-[10px] break-all pr-10 leading-relaxed">
                        {generatedKey.privateKey}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCopyPrivateKey}
                        className="absolute right-1 top-1 h-7 w-7"
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                      Key ID (Address)
                    </label>
                    <div className="p-3 bg-muted rounded-lg font-mono text-xs break-all">
                      {generatedKey.keyId}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 4: Confirm */}
            <div className="w-1/4 flex-shrink-0 px-6 pb-4">
              {generatedKey && (
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Key Type</span>
                      <span className="text-xs font-medium text-foreground capitalize">
                        {keyType}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Key ID</span>
                      <span className="text-xs font-medium text-foreground font-mono">
                        {formatAddress(generatedKey.keyId, 6)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Expiry</span>
                      <span className="text-xs font-medium text-foreground">
                        {neverExpires ? 'Never' : `${expiryDays} days`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Spending Limits</span>
                      <span className="text-xs font-medium text-foreground">
                        {enforceLimits && spendingLimits.length > 0
                          ? `${spendingLimits.length} token(s)`
                          : 'None'}
                      </span>
                    </div>
                    {feeToken && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Fee Token</span>
                        <span className="text-xs font-medium text-foreground">
                          {feeToken.symbol}
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground text-center">
                    Click &quot;Authorize&quot; to sign and create the access key on-chain.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex-shrink-0 flex gap-2">
          {currentStep === 'type' ? (
            <>
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleNext} className="flex-1">
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          ) : currentStep === 'confirm' ? (
            <>
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isCreating}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={isCreating} className="flex-1">
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Authorizing...
                  </>
                ) : (
                  'Authorize Key'
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleBack} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleNext} className="flex-1">
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
