/**
 * Public payment page — /pay/:id
 *
 * Aesthetic: "Certificate of Payment Due" — an engraved classical financial
 * document (think 19th-century treasury note / private-bank draft) reimagined
 * with contemporary restraint. The success state is its sibling: the same
 * paper, stamped and perforated into a receipt.
 *
 * - Fraunces (variable serif) for display, DM Sans (variable sans) for body
 *   — loaded in index.html.
 * - Warm cream paper palette with coral accent button, sage success state.
 * - Double engraved border via triple box-shadow, corner diamond marks,
 *   ornamental divider, and a letterspaced uppercase footer.
 */
import {
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, ExternalLink, ScrollText } from 'lucide-react';
import { useChainId, useSwitchChain, useWalletClient } from 'wagmi';

import { toast } from '@/lib/toast';
import { useTempo } from '@/hooks/useTempo';
import {
  getPublicPaymentLink,
  payPublicPaymentLink,
  type PublicPaymentLink,
} from '@/lib/payment-links-api';
import { createMppxFetch } from '@/lib/mpp';
import { copyToClipboard, formatAddress } from '@/lib/utils';
import { TIMING } from '@/lib/constants';
import { getTokenColors } from '@/lib/tokenlist';

export const Route = createFileRoute('/pay/$id')({
  component: PayPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Palette — warm near-white certificate on a payweave-style off-white page.
 *
 * The card is slightly lighter and warmer than the page, so it reads as a
 * gently elevated sheet rather than a clashing cream island. The footer
 * strip stays distinctly warmer to differentiate the stub from the body.
 */
const PAGE = '#FCF9F5';
const PAPER = '#FFFDF6';
const PAPER_EDGE = '#F8F2E0';
const INK = '#1B1510';
const INK_2 = '#6B5D4B';
const INK_3 = '#9E9080';
const HAIRLINE = '#E8E0CB';
const HAIRLINE_STRONG = '#CEC3A7';
const CORAL = '#E07A5F';
const SAGE = '#6B8F71';

const SERIF: CSSProperties = { fontFamily: '"Fraunces", Georgia, "Times New Roman", serif' };
const SANS: CSSProperties = {
  fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};
const MONO: CSSProperties = {
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
};

const CARD_SHADOW = `
  0 0 0 1px ${HAIRLINE},
  0 0 0 9px ${PAPER},
  0 0 0 10px ${HAIRLINE},
  0 34px 72px -32px rgba(27,21,16,0.22),
  0 2px 0 rgba(27,21,16,0.03)
`;

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

type PayState = 'idle' | 'paying' | 'success' | 'already-paid';

const CHAIN_ID_BY_NETWORK: Record<'testnet' | 'mainnet', number> = {
  testnet: 42431,
  mainnet: 4217,
};

const EXPLORER_BY_NETWORK: Record<'testnet' | 'mainnet', string> = {
  testnet: 'https://explore.testnet.tempo.xyz',
  mainnet: 'https://explore.tempo.xyz',
};

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * The Tempo tokenlist serves icons at a stable path keyed on chainId +
 * lowercased address. Reconstructing the URL client-side saves us from a
 * second round-trip just to look up a logo.
 */
function getTokenLogoURI(network: 'testnet' | 'mainnet', tokenAddress: string): string {
  const chainId = CHAIN_ID_BY_NETWORK[network];
  return `https://esm.sh/gh/tempoxyz/tempo-apps/apps/tokenlist/data/${chainId}/icons/${tokenAddress.toLowerCase()}.svg`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

function PayPage(): ReactElement {
  const { id } = Route.useParams();

  const [link, setLink] = useState<PublicPaymentLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payState, setPayState] = useState<PayState>('idle');
  const [paidAt, setPaidAt] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const { isConnected, isConnecting, address, connectTempoWallet } = useTempo();
  const { data: walletClient } = useWalletClient();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const loadLink = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await getPublicPaymentLink(id);
      setLink(data);
      if (!data.reusable && data.fulfilled && data.lastPayment) {
        setPaidAt(data.lastPayment.paidAt);
        setLastTxHash(data.lastPayment.txHash || null);
        setPayState('already-paid');
      }
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadLink();
  }, [loadLink]);

  const handlePay = useCallback(async (): Promise<void> => {
    if (!link) return;

    setPayState('paying');
    try {
      // Force-switch wallet chain to match the link's network before signing.
      const targetChainId = CHAIN_ID_BY_NETWORK[link.network];
      if (currentChainId !== targetChainId) {
        try {
          await switchChainAsync({ chainId: targetChainId });
        } catch {
          setPayState('idle');
          toast.error(`Switch to ${link.network === 'mainnet' ? 'Mainnet' : 'Testnet'}`, {
            description: `This link must be paid on Tempo ${
              link.network === 'mainnet' ? 'Mainnet' : 'Testnet'
            }. Please approve the network switch.`,
          });
          return;
        }
      }

      const mppxFetch = createMppxFetch(walletClient);
      if (!mppxFetch) {
        setPayState('idle');
        toast.error('Wallet not ready', { description: 'Reconnect your wallet and try again.' });
        return;
      }

      const result = await payPublicPaymentLink(link.id, mppxFetch);
      setPaidAt(result.payment.paidAt);
      setLastTxHash(result.payment.txHash || null);
      setPayState('success');
    } catch (err) {
      setPayState('idle');
      toast.error('Payment failed', { description: (err as Error).message });
    }
  }, [link, walletClient, currentChainId, switchChainAsync]);

  // ─── Loading / error / unavailable ─────────────────────────────────────

  if (loading) {
    return (
      <Shell>
        <NoteCard
          kicker="Fetching"
          title="Loading payment…"
          body="One moment while we retrieve this request."
        />
      </Shell>
    );
  }

  if (loadError || !link) {
    return (
      <Shell>
        <NoteCard
          kicker="Not found"
          title="Link not found"
          body={loadError ?? 'This payment link may have been removed or never existed.'}
        />
      </Shell>
    );
  }

  if (link.status === 'cancelled' || link.status === 'expired') {
    return (
      <Shell>
        <NoteCard
          kicker={link.status === 'cancelled' ? 'Cancelled' : 'Expired'}
          title="Link unavailable"
          body={
            link.status === 'cancelled'
              ? 'This payment link was cancelled by the creator.'
              : 'This payment link has expired.'
          }
        />
      </Shell>
    );
  }

  // ─── Success (fresh or historical) ─────────────────────────────────────

  if (payState === 'success' || payState === 'already-paid') {
    return (
      <Shell>
        <ReceiptCertificate
          link={link}
          paidAt={paidAt}
          txHash={lastTxHash}
          variant={payState === 'already-paid' ? 'historical' : 'fresh'}
        />
      </Shell>
    );
  }

  // ─── Idle / paying — the payment certificate ──────────────────────────

  const chainMismatch = isConnected && currentChainId !== CHAIN_ID_BY_NETWORK[link.network];

  const buttonLabel = !isConnected
    ? 'Connect Tempo Wallet'
    : payState === 'paying'
      ? 'Signing…'
      : chainMismatch
        ? `Sign on ${link.network === 'mainnet' ? 'Mainnet' : 'Testnet'}`
        : `Sign & Pay $${link.amountDecimal}`;

  const buttonAction = !isConnected
    ? async () => {
        try {
          await connectTempoWallet();
        } catch (err) {
          toast.error('Failed to connect', { description: (err as Error).message });
        }
      }
    : handlePay;

  return (
    <Shell>
      <PaymentCertificate
        link={link}
        isConnected={isConnected}
        isConnecting={isConnecting}
        address={address ?? null}
        payState={payState}
        chainMismatch={chainMismatch}
        buttonLabel={buttonLabel}
        onButtonClick={buttonAction}
      />
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell — the warm atmospheric background + centering frame
// ─────────────────────────────────────────────────────────────────────────────

function Shell({ children }: { children: ReactNode }): ReactElement {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-5 py-14 relative overflow-hidden"
      style={{ backgroundColor: '#FCF9F5' }}
    >
      {/* Subtle grid — borrowed from payweave login aesthetic */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
        aria-hidden
      />

      {/* Single soft coral glow — atmospheric, not a focal */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          backgroundColor: 'rgba(224,122,95,0.03)',
          filter: 'blur(120px)',
        }}
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
        className="w-full max-w-[440px] relative z-10"
      >
        <AnimatePresence mode="wait">{children}</AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment Certificate — the idle/paying state
// ─────────────────────────────────────────────────────────────────────────────

interface PaymentCertificateProps {
  link: PublicPaymentLink;
  isConnected: boolean;
  isConnecting: boolean;
  address: string | null;
  payState: PayState;
  chainMismatch: boolean;
  buttonLabel: string;
  onButtonClick: () => void | Promise<void>;
}

function PaymentCertificate(props: PaymentCertificateProps): ReactElement {
  const {
    link,
    isConnected,
    isConnecting,
    address,
    payState,
    chainMismatch,
    buttonLabel,
    onButtonClick,
  } = props;

  const loading = isConnecting || payState === 'paying';

  return (
    <motion.article
      key="certificate"
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative"
      style={{
        backgroundColor: PAPER,
        boxShadow: CARD_SHADOW,
        borderRadius: '2px',
      }}
    >
      <CornerDiamond position="tl" />
      <CornerDiamond position="tr" />
      <CornerDiamond position="bl" />
      <CornerDiamond position="br" />

      {link.network === 'testnet' && <TestnetRibbon />}

      {/* Hero block */}
      <div className="px-10 pt-10 pb-5 text-center relative">
        <Item delay={0.05}>
          <p
            style={{
              ...SANS,
              fontSize: '10px',
              letterSpacing: '0.34em',
              color: INK_3,
              fontWeight: 500,
              textTransform: 'uppercase',
            }}
          >
            Amount&nbsp;&nbsp;Due
          </p>
        </Item>

        <Item delay={0.14}>
          <h1
            className="mt-2.5"
            style={{
              ...SERIF,
              color: INK,
              fontSize: '72px',
              fontWeight: 500,
              lineHeight: 0.95,
              letterSpacing: '-0.025em',
              fontFeatureSettings: '"lnum" 1, "tnum" 1',
            }}
          >
            <span
              style={{
                fontSize: '50px',
                fontWeight: 400,
                verticalAlign: '0.18em',
                marginRight: '2px',
                color: INK,
              }}
            >
              $
            </span>
            {link.amountDecimal}
          </h1>
        </Item>

        <Item delay={0.22}>
          <div className="mt-3 flex items-center justify-center gap-2">
            <TokenIcon
              symbol={link.tokenSymbol}
              address={link.token}
              network={link.network}
              size={20}
            />
            <p
              style={{
                ...SANS,
                fontSize: '10.5px',
                letterSpacing: '0.28em',
                color: INK_2,
                fontWeight: 500,
                textTransform: 'uppercase',
              }}
            >
              {link.tokenSymbol}
            </p>
          </div>
        </Item>

        {(link.title || link.description) && (
          <Item delay={0.3}>
            <div className="mt-5">
              <OrnamentalDivider />
              {link.title && (
                <p
                  className="mt-3.5 px-4"
                  style={{
                    ...SERIF,
                    fontSize: '18px',
                    fontStyle: 'italic',
                    fontWeight: 500,
                    color: INK,
                    lineHeight: 1.35,
                    letterSpacing: '-0.005em',
                  }}
                >
                  {link.title}
                </p>
              )}
              {link.description && (
                <p
                  className="mt-2 max-w-[320px] mx-auto"
                  style={{
                    ...SANS,
                    fontSize: '12.5px',
                    color: INK_2,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {link.description}
                </p>
              )}
            </div>
          </Item>
        )}
      </div>

      {/* Hairline + facts */}
      <div className="mx-10" style={{ borderTop: `1px solid ${HAIRLINE}` }} />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.06, delayChildren: 0.38 },
          },
        }}
        className="px-10 py-4 space-y-2.5"
      >
        <FactRow
          label="Payable to"
          value={<span style={MONO}>{formatAddress(link.recipient, 5)}</span>}
        />
      </motion.div>

      {/* Signature zone */}
      <div className="mx-10" style={{ borderTop: `1px solid ${HAIRLINE}` }} />

      <Item delay={0.54}>
        <div className="px-10 pt-5 pb-6">
          {isConnected && (
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: SAGE }}
                />
                <span
                  style={{
                    ...SANS,
                    fontSize: '9.5px',
                    letterSpacing: '0.26em',
                    color: INK_3,
                    textTransform: 'uppercase',
                    fontWeight: 500,
                  }}
                >
                  Signing&nbsp;as
                </span>
                <span
                  className="truncate"
                  style={{
                    ...MONO,
                    fontSize: '11.5px',
                    color: INK,
                  }}
                >
                  {address ? formatAddress(address, 5) : '—'}
                </span>
              </div>
              {chainMismatch && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm shrink-0"
                  style={{
                    ...SANS,
                    fontSize: '9px',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    backgroundColor: '#F4E7D0',
                    color: '#8A6B2E',
                    fontWeight: 600,
                    border: `1px solid ${HAIRLINE_STRONG}`,
                  }}
                >
                  Switch chain
                </span>
              )}
            </div>
          )}

          <StampButton onClick={onButtonClick} loading={loading}>
            {buttonLabel}
          </StampButton>
        </div>
      </Item>

      {/* Footer wordmark */}
      <div
        className="py-3 text-center"
        style={{
          backgroundColor: PAPER_EDGE,
          borderTop: `1px solid ${HAIRLINE}`,
        }}
      >
        <p
          style={{
            ...SANS,
            fontSize: '11px',
            letterSpacing: '0.02em',
            color: INK_3,
            fontWeight: 500,
          }}
        >
          Powered by temporium
        </p>
      </div>
    </motion.article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt Certificate — success state (retains perforation + dotted rows)
// ─────────────────────────────────────────────────────────────────────────────

interface ReceiptCertificateProps {
  link: PublicPaymentLink;
  paidAt: string | null;
  txHash: string | null;
  variant: 'fresh' | 'historical';
}

function ReceiptCertificate({
  link,
  paidAt,
  txHash,
  variant,
}: ReceiptCertificateProps): ReactElement {
  const [copied, setCopied] = useState(false);
  const explorerBase = EXPLORER_BY_NETWORK[link.network];
  const dateStr = paidAt ? formatDateLong(paidAt) : formatDateLong(new Date().toISOString());

  const handleCopy = useCallback(async () => {
    if (!txHash) return;
    const ok = await copyToClipboard(txHash);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
    }
  }, [txHash]);

  const heading = variant === 'historical' ? 'Payment received' : 'Payment completed';
  const subline =
    variant === 'historical'
      ? 'This payment link has already been paid.'
      : 'Thank you — your payment was successful.';

  return (
    <motion.article
      key="receipt"
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative"
      style={{
        backgroundColor: PAPER,
        boxShadow: CARD_SHADOW,
        borderRadius: '2px',
      }}
    >
      <CornerDiamond position="tl" />
      <CornerDiamond position="tr" />
      <CornerDiamond position="bl" />
      <CornerDiamond position="br" />

      {/* Success crown */}
      <div className="px-10 pt-9 pb-6 text-center">
        <motion.div
          initial={{ scale: 0.55, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.08, type: 'spring', stiffness: 280, damping: 22 }}
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto relative"
          style={{
            backgroundColor: SAGE,
            boxShadow: `
              0 0 0 5px ${PAPER},
              0 0 0 6px ${HAIRLINE},
              0 10px 32px -8px rgba(107,143,113,0.45)
            `,
          }}
        >
          <Check className="w-7 h-7 text-white" strokeWidth={3} />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.4 }}
          className="mt-5"
          style={{
            ...SERIF,
            fontSize: '24px',
            fontWeight: 500,
            color: INK,
            letterSpacing: '-0.015em',
            lineHeight: 1.2,
          }}
        >
          {heading}
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.35 }}
          className="mt-1.5"
          style={{
            ...SANS,
            fontSize: '12.5px',
            color: INK_2,
            lineHeight: 1.5,
          }}
        >
          {subline}
        </motion.p>
      </div>

      {/* Perforated divider with side notches */}
      <div className="relative">
        <span
          className="absolute -left-[11px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full"
          style={{ backgroundColor: PAGE, border: `1px solid ${HAIRLINE}` }}
        />
        <span
          className="absolute -right-[11px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full"
          style={{ backgroundColor: PAGE, border: `1px solid ${HAIRLINE}` }}
        />
        <div className="mx-9" style={{ borderTop: `1px dashed ${HAIRLINE_STRONG}` }} />
      </div>

      {/* Receipt body */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05, delayChildren: 0.44 },
          },
        }}
        className="px-10 py-5 space-y-3"
      >
        <DottedRow
          label="Amount"
          value={
            <span className="inline-flex items-center gap-1.5">
              <TokenIcon
                symbol={link.tokenSymbol}
                address={link.token}
                network={link.network}
                size={18}
              />
              <span style={{ ...SERIF, fontSize: '16px', fontWeight: 600 }}>
                ${link.amountDecimal} {link.tokenSymbol}
              </span>
            </span>
          }
        />
        <DottedRow
          label="To"
          value={<span style={MONO}>{formatAddress(link.recipient, 5)}</span>}
        />
        {link.title && <DottedRow label="For" value={link.title} />}
        <DottedRow label="Date" value={dateStr} />

        {txHash && (
          <>
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 4 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
              }}
              className="flex items-center justify-between gap-4 pt-0.5"
            >
              <span
                style={{
                  ...SANS,
                  fontSize: '10px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: INK_3,
                  fontWeight: 500,
                }}
              >
                Transaction
              </span>
              <div className="flex items-center gap-1">
                <span style={{ ...MONO, fontSize: '11.5px', color: INK }}>
                  {formatAddress(txHash, 5)}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  title={copied ? 'Copied' : 'Copy transaction hash'}
                  className="ml-1 w-6 h-6 rounded-sm flex items-center justify-center transition-colors"
                  style={{ color: INK_3 }}
                  onMouseEnter={e => (e.currentTarget.style.color = INK)}
                  onMouseLeave={e => (e.currentTarget.style.color = INK_3)}
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5" style={{ color: SAGE }} strokeWidth={2.5} />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <a
                  href={`${explorerBase}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View on explorer"
                  className="w-6 h-6 rounded-sm flex items-center justify-center transition-colors"
                  style={{ color: INK_3 }}
                  onMouseEnter={e => (e.currentTarget.style.color = INK)}
                  onMouseLeave={e => (e.currentTarget.style.color = INK_3)}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </motion.div>
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 4 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
              }}
              className="flex items-center justify-between gap-4"
            >
              <span
                style={{
                  ...SANS,
                  fontSize: '10px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: INK_3,
                  fontWeight: 500,
                }}
              >
                Receipt
              </span>
              <a
                href={`${explorerBase}/receipt/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 transition-colors"
                style={{ ...SANS, fontSize: '12px', color: INK_2, fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget.style.color = INK)}
                onMouseLeave={e => (e.currentTarget.style.color = INK_2)}
              >
                <ScrollText className="w-3.5 h-3.5" style={{ color: INK_3 }} />
                View on-chain
                <ExternalLink className="w-3 h-3" style={{ color: INK_3 }} />
              </a>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Footer */}
      <div
        className="py-3 text-center"
        style={{
          backgroundColor: PAPER_EDGE,
          borderTop: `1px solid ${HAIRLINE}`,
        }}
      >
        <p
          style={{
            ...SANS,
            fontSize: '11px',
            letterSpacing: '0.02em',
            color: INK_3,
            fontWeight: 500,
          }}
        >
          Powered by temporium
        </p>
      </div>
    </motion.article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NoteCard — loading / error / unavailable states
// ─────────────────────────────────────────────────────────────────────────────

function NoteCard({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body: string;
}): ReactElement {
  return (
    <motion.div
      key={`note-${kicker}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative"
      style={{
        backgroundColor: PAPER,
        boxShadow: CARD_SHADOW,
        borderRadius: '2px',
      }}
    >
      <CornerDiamond position="tl" />
      <CornerDiamond position="tr" />
      <CornerDiamond position="bl" />
      <CornerDiamond position="br" />

      <div className="px-10 py-11 text-center">
        <p
          style={{
            ...SANS,
            fontSize: '10px',
            letterSpacing: '0.34em',
            color: INK_3,
            fontWeight: 500,
            textTransform: 'uppercase',
          }}
        >
          {kicker}
        </p>
        <h2
          className="mt-3"
          style={{
            ...SERIF,
            fontSize: '21px',
            fontWeight: 500,
            color: INK,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h2>
        <p
          className="mt-2.5 max-w-[280px] mx-auto"
          style={{
            ...SANS,
            fontSize: '12.5px',
            color: INK_2,
            lineHeight: 1.55,
          }}
        >
          {body}
        </p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Item({ delay, children }: { delay: number; children: ReactNode }): ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

function OrnamentalDivider(): ReactElement {
  return (
    <div className="flex items-center justify-center gap-3 select-none" aria-hidden>
      <div className="w-16 h-px" style={{ backgroundColor: HAIRLINE }} />
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 0 L12 6 L6 12 L0 6 Z" stroke={HAIRLINE_STRONG} strokeWidth="1.2" fill="none" />
        <circle cx="6" cy="6" r="1.1" fill={HAIRLINE_STRONG} />
      </svg>
      <div className="w-16 h-px" style={{ backgroundColor: HAIRLINE }} />
    </div>
  );
}

function CornerDiamond({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }): ReactElement {
  const offsets: Record<typeof position, CSSProperties> = {
    tl: { top: '-6px', left: '-6px' },
    tr: { top: '-6px', right: '-6px' },
    bl: { bottom: '-6px', left: '-6px' },
    br: { bottom: '-6px', right: '-6px' },
  };
  return (
    <svg
      className="absolute pointer-events-none z-10"
      style={offsets[position]}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path d="M6 0 L12 6 L6 12 L0 6 Z" fill={PAPER} stroke={HAIRLINE_STRONG} strokeWidth="1.2" />
      <circle cx="6" cy="6" r="1.2" fill={HAIRLINE_STRONG} />
    </svg>
  );
}

function TestnetRibbon(): ReactElement {
  return (
    <div
      className="absolute top-0 right-0 pointer-events-none select-none overflow-hidden z-20"
      style={{ width: '118px', height: '118px' }}
      aria-hidden
    >
      <div
        style={{
          position: 'absolute',
          top: '22px',
          right: '-38px',
          width: '160px',
          textAlign: 'center',
          transform: 'rotate(45deg)',
          backgroundColor: CORAL,
          color: 'white',
          padding: '5px 0',
          boxShadow: '0 4px 12px -2px rgba(224,122,95,0.45)',
          ...SANS,
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
        }}
      >
        Testnet
      </div>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: ReactNode }): ReactElement {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 4 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
      }}
      className="flex items-baseline justify-between gap-4"
    >
      <span
        style={{
          ...SANS,
          fontSize: '10px',
          letterSpacing: '0.26em',
          textTransform: 'uppercase',
          color: INK_3,
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        style={{
          ...SANS,
          fontSize: '13px',
          color: INK,
          fontWeight: 500,
        }}
      >
        {value}
      </span>
    </motion.div>
  );
}

/** Receipt dotted-leader row — label/value separated by a classic dotted line. */
function DottedRow({ label, value }: { label: string; value: ReactNode }): ReactElement {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 4 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
      }}
      className="flex items-baseline justify-between gap-3"
    >
      <span
        style={{
          ...SANS,
          fontSize: '10px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: INK_3,
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        className="flex-1"
        style={{
          borderBottom: `1px dotted ${HAIRLINE_STRONG}`,
          transform: 'translateY(-3px)',
        }}
      />
      <span
        style={{
          ...SANS,
          fontSize: '13px',
          color: INK,
          fontWeight: 500,
        }}
      >
        {value}
      </span>
    </motion.div>
  );
}

/**
 * Token icon that mirrors the portal's `TokenIcon`: a colored circle background
 * with the token's logo image, falling back to a typographic `$` glyph if the
 * image fails to load.
 */
function TokenIcon({
  symbol,
  address,
  network,
  size = 20,
}: {
  symbol: string;
  address: string;
  network: 'testnet' | 'mainnet';
  size?: number;
}): ReactElement {
  const colors = getTokenColors(symbol);
  const [errored, setErrored] = useState(false);
  const src = getTokenLogoURI(network, address);

  return (
    <span
      className="inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 align-middle"
      style={{
        width: size,
        height: size,
        backgroundColor: colors.bg,
      }}
    >
      {!errored ? (
        <img
          src={src}
          alt={symbol}
          width={size}
          height={size}
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <span
          style={{
            ...SERIF,
            fontSize: size * 0.62,
            fontWeight: 500,
            color: colors.text,
            lineHeight: 1,
          }}
        >
          $
        </span>
      )}
    </span>
  );
}

function StampButton({
  onClick,
  loading,
  children,
}: {
  onClick: () => void | Promise<void>;
  loading?: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <motion.button
      type="button"
      onClick={() => void onClick()}
      disabled={loading}
      whileTap={{ scale: 0.985 }}
      className="group w-full relative overflow-hidden disabled:cursor-wait transition-shadow"
      style={{
        height: '58px',
        backgroundColor: CORAL,
        borderRadius: '2px',
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.22),
          inset 0 -2px 0 rgba(0,0,0,0.1),
          0 1px 0 rgba(27,21,16,0.06),
          0 14px 32px -14px rgba(224,122,95,0.55)
        `,
      }}
    >
      {/* Inset hairline — gives the stamped-plate look */}
      <span
        className="absolute inset-[7px] pointer-events-none"
        style={{
          border: '1px solid rgba(255,255,255,0.22)',
          borderRadius: '1px',
        }}
        aria-hidden
      />

      {loading ? (
        <span
          className="relative flex items-center justify-center gap-2 text-white"
          style={{
            ...SANS,
            fontSize: '11.5px',
            fontWeight: 600,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
          }}
        >
          <LoadingDots />
        </span>
      ) : (
        <span
          className="relative inline-flex items-center justify-center gap-2.5 text-white"
          style={{
            ...SANS,
            fontSize: '11.5px',
            fontWeight: 600,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
          }}
        >
          {children}
          <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </span>
      )}
    </motion.button>
  );
}

function LoadingDots(): ReactElement {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-white"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            delay: i * 0.18,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  );
}
