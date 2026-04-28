import { type ReactElement, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  ShieldCheck,
  Wallet,
  Check,
  ArrowRight,
  Link as LinkIcon,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { Button } from '@/components/ui/button';
import { MasterAlreadyRegisteredError, useVirtualMaster } from '@/hooks/useVirtualAddresses';
import { copyToClipboard } from '@/lib/utils';
import { TIMING } from '@/lib/constants';
import { toast } from '@/lib/toast';

interface RegisterMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchToLookup?: () => void;
  onComplete?: () => void;
}

type Step = 'intro' | 'setup' | 'sign' | 'confirming' | 'done' | 'already' | 'error';

// Steps that contribute to the progress bar (intro/already/error are off-flow).
const FLOW: Step[] = ['intro', 'setup', 'sign', 'confirming', 'done'];

// Per-step subtitle that animates in the header.
const SUBTITLES: Record<Step, string> = {
  intro: 'Register your master ID',
  setup: 'Preparing… this takes 1–2 minutes',
  sign: 'One quick signature',
  confirming: 'Landing on-chain',
  done: 'You’re all set',
  already: 'Already registered',
  error: 'Something went wrong',
};

/**
 * Wizard for the one-time master setup. Mirrors the visual language of the
 * "Sign in with Tempo" flow: fixed-height body, AnimatePresence step
 * transitions, animated header subtitle + progress bar.
 */
export function RegisterMasterDialog({
  open,
  onOpenChange,
  onSwitchToLookup,
  onComplete,
}: RegisterMasterDialogProps): ReactElement {
  const { register, pendingMaster } = useVirtualMaster();
  const [step, setStep] = useState<Step>('intro');
  const [masterId, setMasterId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedRef = useRef(false);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  // Reset on close.
  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      setStep('intro');
      setMasterId(null);
      setErrorMessage(null);
      setElapsedMs(0);
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }
  }, [open]);

  // Auto-resume into the sign step when a pending master already exists.
  useEffect(() => {
    if (open && pendingMaster && !startedRef.current) {
      setMasterId(pendingMaster.masterId);
      startedRef.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingMaster]);

  const run = (): void => {
    const startedAt = Date.now();
    setStep(s => (s === 'intro' ? 'setup' : s));
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setElapsedMs(Date.now() - startedAt), 250);

    register({
      onProgress: phase => {
        if (phase === 'mining') setStep(s => (s === 'sign' || s === 'confirming' ? s : 'setup'));
        else if (phase === 'signing') {
          if (tickRef.current) {
            clearInterval(tickRef.current);
            tickRef.current = null;
          }
          setStep('sign');
        } else if (phase === 'confirming' || phase === 'saving') setStep('confirming');
      },
    })
      .then(saved => {
        setMasterId(saved.masterId);
        setStep('done');
      })
      .catch((err: Error) => {
        if (tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
        }
        if (err instanceof MasterAlreadyRegisteredError) {
          setStep('already');
          return;
        }
        setErrorMessage(err.message || 'Setup failed');
        setStep('error');
        toast.error('Setup failed', { description: err.message });
      });
  };

  const begin = (): void => {
    if (startedRef.current) return;
    startedRef.current = true;
    run();
  };

  const handleSwitchToLookup = (): void => {
    onOpenChange(false);
    setTimeout(() => onSwitchToLookup?.(), 0);
  };

  const handleContinue = (): void => {
    onComplete?.();
    onOpenChange(false);
  };

  // Setup, sign, and confirming are blocking — the user shouldn't be able to
  // dismiss the dialog mid-flow. Their state is persisted server-side, but
  // the UX shouldn't tempt cancellation.
  const blockClose = step === 'setup' || step === 'sign' || step === 'confirming';

  const stepIndex = FLOW.indexOf(step);
  const progress =
    step === 'done'
      ? 100
      : step === 'intro' || stepIndex < 0
        ? 0
        : (stepIndex / (FLOW.length - 1)) * 100;
  const isSuccess = step === 'done';
  // Off-flow states (already, error) shouldn't display the step progress bar —
  // the user isn't progressing through setup, they're being redirected.
  const showProgress = step !== 'already' && step !== 'error';

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next && blockClose) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-w-[420px] p-0 gap-0 rounded-3xl overflow-hidden border-none shadow-[0_20px_50px_-20px_rgba(45,52,54,0.2)]"
        hideClose={blockClose}
      >
        <DialogTitle className="sr-only">Register your master ID</DialogTitle>
        <DialogDescription className="sr-only">
          Register a TIP-1022 master ID for your wallet so you can hand out unlimited virtual
          deposit addresses.
        </DialogDescription>

        {/* Header */}
        <div className="px-6 pt-6 pb-5 bg-[#FDFBF8] border-b border-[#EDE9E3]">
          <div className="pr-10">
            <p className="text-[15px] font-semibold text-[#2D3436] tracking-tight leading-tight">
              Master ID setup
            </p>
            <motion.p
              key={SUBTITLES[step]}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-[12px] text-[#9B9590] mt-0.5"
            >
              {SUBTITLES[step]}
            </motion.p>
          </div>

          {/* Progress bar — hidden on off-flow states (already / error) so we
              don't imply the user is at "step 0 of 4" when they aren't. */}
          {showProgress && (
            <div className="relative mt-5 h-[5px] rounded-full bg-[#EDE9E3] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: isSuccess ? '#6B8F71' : '#E07A5F' }}
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          )}
        </div>

        {/* Body — fixed min-height so children don't reflow on transition */}
        <div className="relative min-h-[320px]">
          <AnimatePresence mode="wait">
            {step === 'intro' && (
              <StepShell key="intro">
                <IntroStep onBegin={begin} onLookup={handleSwitchToLookup} />
              </StepShell>
            )}
            {step === 'setup' && (
              <StepShell key="setup" centered>
                <SetupStep elapsedMs={elapsedMs} />
              </StepShell>
            )}
            {step === 'sign' && masterId && (
              <StepShell key="sign">
                <SignStep masterId={masterId} />
              </StepShell>
            )}
            {step === 'confirming' && (
              <StepShell key="confirming" centered>
                <ConfirmingStep />
              </StepShell>
            )}
            {step === 'done' && masterId && (
              <StepShell key="done" centered>
                <DoneStep masterId={masterId} onContinue={handleContinue} />
              </StepShell>
            )}
            {step === 'already' && (
              <StepShell key="already">
                <AlreadyStep onCancel={() => onOpenChange(false)} onLookup={handleSwitchToLookup} />
              </StepShell>
            )}
            {step === 'error' && (
              <StepShell key="error">
                <ErrorStep
                  message={errorMessage}
                  onClose={() => onOpenChange(false)}
                  onRetry={() => {
                    startedRef.current = false;
                    begin();
                  }}
                />
              </StepShell>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Step shell — consistent padding + transition for every step.
// =============================================================================

function StepShell({
  children,
  centered = false,
}: {
  children: ReactElement;
  centered?: boolean;
}): ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className={centered ? 'px-6 py-10 flex flex-col items-center text-center' : 'px-6 pt-5 pb-6'}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// Steps
// =============================================================================

function IntroStep({
  onBegin,
  onLookup,
}: {
  onBegin: () => void;
  onLookup: () => void;
}): ReactElement {
  return (
    <>
      <button
        onClick={onBegin}
        className="group w-full flex items-center gap-3.5 p-3.5 rounded-2xl border border-[#EDE9E3] bg-white hover:border-[#E07A5F] hover:bg-[#FDFBF8] transition-all text-left cursor-pointer"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#E07A5F18' }}
        >
          <ShieldCheck className="w-[18px] h-[18px] text-[#E07A5F]" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold text-[#2D3436]">Register a new master ID</p>
          <p className="text-[11.5px] text-[#9B9590] mt-0.5">Takes 1–2 minutes. One-time setup.</p>
        </div>
        <ArrowRight className="w-4 h-4 text-[#B5B0AA] group-hover:text-[#E07A5F] group-hover:translate-x-0.5 transition-all shrink-0" />
      </button>

      <div className="mt-3 rounded-2xl bg-[#F5F2ED]/60 border border-[#EDE9E3] px-3.5 py-3 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-[#9B9590] shrink-0 mt-0.5" strokeWidth={2.2} />
        <p className="text-[12px] text-[#6B6560] leading-relaxed">
          Setup runs in your browser.{' '}
          <span className="font-semibold text-[#2D3436]">Please keep this tab open.</span> If you
          close it by accident, your progress is saved and you can resume.
        </p>
      </div>

      <p className="text-[11.5px] text-center text-[#9B9590] mt-5">
        Already have a master ID?{' '}
        <button
          type="button"
          onClick={onLookup}
          className="font-semibold text-[#9B72CF] hover:text-[#8A62BF] transition-colors"
        >
          Link it →
        </button>
      </p>
    </>
  );
}

function SetupStep({ elapsedMs }: { elapsedMs: number }): ReactElement {
  const totalSec = Math.floor(elapsedMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = String(totalSec % 60).padStart(2, '0');
  return (
    <>
      <div className="relative w-20 h-20 mb-5">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: '#E07A5F', opacity: 0.12 }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.18, 0.06, 0.18] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-2 rounded-full"
          style={{ backgroundColor: '#E07A5F', opacity: 0.2 }}
          animate={{ scale: [1, 1.12, 1], opacity: [0.25, 0.12, 0.25] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.25 }}
        />
        <div
          className="absolute inset-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#E07A5F' }}
        >
          <Loader2 className="w-5 h-5 text-white animate-spin" strokeWidth={2.5} />
        </div>
      </div>
      <p className="text-[14px] font-semibold text-[#2D3436]">Preparing your master ID</p>
      <p className="text-[12px] text-[#9B9590] mt-1.5 max-w-[260px] leading-relaxed">
        Please keep this tab open. We&apos;re saving your progress as we go.
      </p>
      <p className="mt-4 text-[11px] text-[#B5B0AA] font-mono tabular-nums">
        {m}:{s} elapsed
      </p>
    </>
  );
}

function SignStep({ masterId }: { masterId: string }): ReactElement {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );
  const onCopy = async (): Promise<void> => {
    const ok = await copyToClipboard(masterId);
    if (!ok) return;
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
  };

  return (
    <>
      <div className="mb-3 px-1">
        <p className="text-[12.5px] text-[#6B6560] leading-relaxed">
          Your master ID is ready. Approve the transaction in your wallet to register it on-chain. A
          small one-time fee applies.
        </p>
      </div>

      <button
        onClick={onCopy}
        className="group w-full flex items-center gap-3.5 p-3.5 rounded-2xl border border-[#EDE9E3] bg-white hover:border-[#9B72CF] hover:bg-[#FDFBF8] transition-all text-left cursor-pointer"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#9B72CF18' }}
        >
          <Wallet className="w-[18px] h-[18px] text-[#9B72CF]" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-[#9B9590] uppercase tracking-wider">
            Master ID
          </p>
          <p className="font-mono text-[14px] text-[#2D3436] mt-0.5">{masterId}</p>
        </div>
        {copied ? (
          <Check className="w-4 h-4 text-[#6B8F71] shrink-0" />
        ) : (
          <Copy className="w-4 h-4 text-[#B5B0AA] group-hover:text-[#9B72CF] transition-colors shrink-0" />
        )}
      </button>

      <p className="text-[11.5px] text-center text-[#9B9590] mt-5">
        If you don&apos;t see the wallet popup, check your browser extension.
      </p>
    </>
  );
}

function ConfirmingStep(): ReactElement {
  return (
    <>
      <div className="relative w-20 h-20 mb-5">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: '#E07A5F', opacity: 0.12 }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.18, 0.06, 0.18] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div
          className="absolute inset-3 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#E07A5F' }}
        >
          <Loader2 className="w-5 h-5 text-white animate-spin" strokeWidth={2.5} />
        </div>
      </div>
      <p className="text-[14px] font-semibold text-[#2D3436]">Confirming on-chain</p>
      <p className="text-[12px] text-[#9B9590] mt-1.5 max-w-[260px] leading-relaxed">
        Just a moment while your master ID lands on the network.
      </p>
    </>
  );
}

function DoneStep({
  masterId,
  onContinue,
}: {
  masterId: string;
  onContinue: () => void;
}): ReactElement {
  return (
    <>
      <div className="relative w-20 h-20 mb-5">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: '#6B8F71', opacity: 0.15 }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0, 0.2] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
        />
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16 }}
          className="absolute inset-3 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#6B8F71' }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 14 }}
          >
            <Check className="w-7 h-7 text-white" strokeWidth={3} />
          </motion.div>
        </motion.div>
      </div>
      <p className="text-[15px] font-bold text-[#2D3436]">You&apos;re set up</p>

      <div className="mt-4 w-full rounded-2xl border border-[#6B8F71]/20 bg-[#6B8F71]/5 px-4 py-3">
        <p className="text-[10px] font-semibold text-[#6B8F71] uppercase tracking-wider">
          Your master ID
        </p>
        <p className="font-mono text-[14px] text-[#2D3436] mt-0.5">{masterId}</p>
      </div>

      <Button
        onClick={onContinue}
        className="mt-5 w-full h-10 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white"
      >
        Create your first virtual address
      </Button>
    </>
  );
}

function AlreadyStep({
  onCancel,
  onLookup,
}: {
  onCancel: () => void;
  onLookup: () => void;
}): ReactElement {
  return (
    <>
      <div className="mb-3 px-1">
        <p className="text-[12.5px] text-[#6B6560] leading-relaxed">
          This wallet is already registered on-chain (likely from another tool). Link your existing
          master ID to start using it here.
        </p>
      </div>
      <button
        onClick={onLookup}
        className="group w-full flex items-center gap-3.5 p-3.5 rounded-2xl border border-[#EDE9E3] bg-white hover:border-[#9B72CF] hover:bg-[#FDFBF8] transition-all text-left cursor-pointer"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#9B72CF18' }}
        >
          <LinkIcon className="w-[18px] h-[18px] text-[#9B72CF]" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold text-[#2D3436]">Link my master ID</p>
          <p className="text-[11.5px] text-[#9B9590] mt-0.5">
            Paste your masterId — we&apos;ll verify on-chain.
          </p>
        </div>
        <ArrowRight className="w-4 h-4 text-[#B5B0AA] group-hover:text-[#9B72CF] group-hover:translate-x-0.5 transition-all shrink-0" />
      </button>
      <p className="text-[11.5px] text-center text-[#9B9590] mt-5">
        <button type="button" onClick={onCancel} className="hover:text-[#6B6560] transition-colors">
          Cancel
        </button>
      </p>
    </>
  );
}

function ErrorStep({
  message,
  onClose,
  onRetry,
}: {
  message: string | null;
  onClose: () => void;
  onRetry: () => void;
}): ReactElement {
  return (
    <>
      <div className="mb-3 px-1 rounded-xl bg-[#E07A5F]/8 border border-[#E07A5F]/20 px-3 py-2.5">
        <p className="text-[12px] text-[#B5614A] text-center">
          {message ?? 'Something went wrong. You can try again.'}
        </p>
      </div>
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onClose}
          className="flex-1 h-10 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560]"
        >
          Close
        </Button>
        <Button
          onClick={onRetry}
          className="flex-1 h-10 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white"
        >
          Try again
        </Button>
      </div>
    </>
  );
}
