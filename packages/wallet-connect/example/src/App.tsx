import { useState, useEffect, useCallback } from 'react';
import { WalletConnect } from '@temporium/wallet-connect';
import type { ConnectionResult, TransactionResult } from '@temporium/wallet-connect';

// Initialize wallet client
const wallet = new WalletConnect({
  appName: 'Wallet Connect Example',
  appDescription: 'Demo app for @temporium/wallet-connect SDK',
  appIcon: 'https://temporium.xyz/favicon.svg',
  // Local wallet for development
  walletUrl: 'http://localhost:4004',
});

// Test addresses for demo
const TEST_RECIPIENT = '0x0000000000000000000000000000000000000001';

type Step = 'idle' | 'connecting' | 'connected' | 'sending' | 'success' | 'error';

export default function App() {
  const [step, setStep] = useState<Step>('idle');
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  // Form state
  const [recipient, setRecipient] = useState(TEST_RECIPIENT);
  const [amount, setAmount] = useState('1.00');
  const [memo, setMemo] = useState('Test payment');

  // Check if already connected on mount (restored from previous session)
  useEffect(() => {
    console.log('[Example] App mounted, checking connection status...');

    // Check if already connected (from localStorage)
    if (wallet.isConnected()) {
      const status = wallet.getConnectionStatus();
      console.log('[Example] Restored connection:', status);
      setAddress(status.address);
      setChainId(status.chainId);
      setStep('connected');
      setRestored(true);
    }

    // Listen for connection events
    const handleConnect = ({ address: addr, chainId: chain }: { address: string | null; chainId: number | null }) => {
      console.log('[Example] Connect event:', addr, chain);
      if (addr) setAddress(addr);
      if (chain) setChainId(chain);
      setStep('connected');
    };

    const handleDisconnect = () => {
      console.log('[Example] Disconnect event');
      setAddress(null);
      setChainId(null);
      setStep('idle');
    };

    wallet.on('connect', handleConnect);
    wallet.on('disconnect', handleDisconnect);

    return () => {
      wallet.off('connect', handleConnect);
      wallet.off('disconnect', handleDisconnect);
    };
  }, []);

  // Connect to wallet
  const handleConnect = useCallback(async () => {
    setStep('connecting');
    setError(null);
    setRestored(false);

    try {
      const result: ConnectionResult = await wallet.connect();
      setAddress(result.address);
      setChainId(result.chainId);
      setStep('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setStep('error');
    }
  }, []);

  // Disconnect
  const handleDisconnect = useCallback(() => {
    wallet.disconnect();
    setAddress(null);
    setChainId(null);
    setTxHash(null);
    setRestored(false);
    setStep('idle');
  }, []);

  // Send payment
  const handleSendPayment = useCallback(async () => {
    if (!recipient || !amount) {
      setError('Please enter recipient and amount');
      return;
    }

    setStep('sending');
    setError(null);
    setTxHash(null);

    try {
      // Convert amount to smallest units (6 decimals for USD)
      const amountInSmallestUnits = BigInt(Math.floor(parseFloat(amount) * 1_000_000));

      const result: TransactionResult = await wallet.sendPayment({
        to: recipient as `0x${string}`,
        amount: amountInSmallestUnits,
        memo: memo || undefined,
      });

      setTxHash(result.hash);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send payment');
      setStep('error');
    }
  }, [recipient, amount, memo]);

  // Reset to try again
  const handleReset = useCallback(() => {
    setTxHash(null);
    setError(null);
    setStep('connected');
  }, []);

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>Wallet Connect</h1>
        <p style={styles.subtitle}>Send Payment Demo</p>
      </header>

      {/* Step Indicator */}
      <div style={styles.steps}>
        <StepIndicator number={1} label="Connect" active={step === 'connecting'} completed={['connected', 'sending', 'success'].includes(step)} />
        <div style={styles.stepLine} />
        <StepIndicator number={2} label="Enter Details" active={step === 'connected'} completed={['sending', 'success'].includes(step)} />
        <div style={styles.stepLine} />
        <StepIndicator number={3} label="Confirm" active={step === 'sending'} completed={step === 'success'} />
      </div>

      {/* Main Content */}
      <div style={styles.card}>
        {/* Step 1: Not Connected */}
        {step === 'idle' && (
          <div style={styles.section}>
            <p style={styles.description}>
              Connect your Temporium Wallet to send a test payment.
            </p>
            <button style={{ ...styles.button, ...styles.primaryButton }} onClick={handleConnect}>
              Connect Wallet
            </button>
          </div>
        )}

        {/* Connecting */}
        {step === 'connecting' && (
          <div style={styles.section}>
            <div style={styles.spinner} />
            <p style={styles.statusText}>Connecting to wallet...</p>
            <p style={styles.hint}>Approve the connection in the popup window</p>
          </div>
        )}

        {/* Step 2: Connected - Enter Payment Details */}
        {step === 'connected' && (
          <div style={styles.section}>
            <div style={styles.connectedBadge}>
              <span style={styles.dot} />
              {restored ? 'Restored' : 'Connected'}: {address?.slice(0, 8)}...{address?.slice(-6)}
            </div>
            {restored && (
              <p style={styles.restoredHint}>
                Connection restored from previous session
              </p>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label}>Recipient Address</label>
              <input
                style={styles.input}
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
              />
            </div>

            <div style={styles.row}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Amount (USD)</label>
                <input
                  style={styles.input}
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Memo (optional)</label>
                <input
                  style={styles.input}
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Payment for..."
                />
              </div>
            </div>

            <button
              style={{ ...styles.button, ...styles.primaryButton }}
              onClick={handleSendPayment}
              disabled={!recipient || !amount}
            >
              Send ${amount || '0.00'}
            </button>

            <button
              style={{ ...styles.button, ...styles.textButton }}
              onClick={handleDisconnect}
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Sending */}
        {step === 'sending' && (
          <div style={styles.section}>
            <div style={styles.spinner} />
            <p style={styles.statusText}>Confirming payment...</p>
            <p style={styles.hint}>Approve the transaction in the wallet popup</p>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div style={styles.section}>
            <div style={styles.successIcon}>✓</div>
            <h2 style={styles.successTitle}>Payment Sent!</h2>
            <div style={styles.txDetails}>
              <div style={styles.txRow}>
                <span style={styles.txLabel}>Amount:</span>
                <span style={styles.txValue}>${amount} USD</span>
              </div>
              <div style={styles.txRow}>
                <span style={styles.txLabel}>To:</span>
                <span style={styles.txValue}>{recipient.slice(0, 10)}...{recipient.slice(-8)}</span>
              </div>
              {memo && (
                <div style={styles.txRow}>
                  <span style={styles.txLabel}>Memo:</span>
                  <span style={styles.txValue}>{memo}</span>
                </div>
              )}
              <div style={styles.txRow}>
                <span style={styles.txLabel}>Tx Hash:</span>
                <span style={{ ...styles.txValue, ...styles.mono }}>{txHash?.slice(0, 14)}...{txHash?.slice(-12)}</span>
              </div>
            </div>
            <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={handleReset}>
              Send Another Payment
            </button>
            <button style={{ ...styles.button, ...styles.textButton }} onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div style={styles.section}>
            <div style={styles.errorIcon}>✕</div>
            <h2 style={styles.errorTitle}>Error</h2>
            <p style={styles.errorMessage}>{error}</p>
            <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={address ? handleReset : handleConnect}>
              {address ? 'Try Again' : 'Reconnect'}
            </button>
          </div>
        )}
      </div>

      {/* Code Example */}
      <div style={styles.codeCard}>
        <h3 style={styles.codeTitle}>Integration Code</h3>
        <pre style={styles.code}>
{`import { WalletConnect } from '@temporium/wallet-connect';

const wallet = new WalletConnect({
  appName: 'My App',
  walletUrl: 'http://localhost:4004',
});

// Check if already connected (from previous session)
if (wallet.isConnected()) {
  const address = wallet.getAddress();
  console.log('Already connected:', address);
}

// Listen for connection events
wallet.on('connect', ({ address }) => {
  console.log('Connected:', address);
});

// Connect (uses cached connection if available)
const { address } = await wallet.connect();

// Force new connection (ignores cache)
// const { address } = await wallet.connect({ force: true });

// Send payment
const { hash } = await wallet.sendPayment({
  to: '${recipient || '0x...'}',
  amount: ${amount ? BigInt(Math.floor(parseFloat(amount) * 1_000_000)).toString() : '1000000'}n,${memo ? `
  memo: '${memo}',` : ''}
});`}
        </pre>
      </div>

      {/* Footer */}
      <footer style={styles.footer}>
        <p>Chain ID: {chainId || 'Not connected'}</p>
        <p>Wallet: localhost:4004</p>
      </footer>
    </div>
  );
}

// Step indicator component
function StepIndicator({ number, label, active, completed }: { number: number; label: string; active: boolean; completed: boolean }) {
  return (
    <div style={styles.stepItem}>
      <div style={{
        ...styles.stepCircle,
        ...(completed ? styles.stepCompleted : active ? styles.stepActive : {}),
      }}>
        {completed ? '✓' : number}
      </div>
      <span style={{
        ...styles.stepLabel,
        ...(active || completed ? styles.stepLabelActive : {}),
      }}>
        {label}
      </span>
    </div>
  );
}

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '32px 20px',
    minHeight: '100vh',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    marginBottom: '4px',
    color: '#fff',
  },
  subtitle: {
    color: '#888',
    fontSize: '14px',
  },
  steps: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '24px',
    gap: '8px',
  },
  stepItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  stepCircle: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '600',
    background: '#262626',
    color: '#666',
    transition: 'all 0.2s',
  },
  stepActive: {
    background: '#3b82f6',
    color: '#fff',
  },
  stepCompleted: {
    background: '#22c55e',
    color: '#fff',
  },
  stepLabel: {
    fontSize: '11px',
    color: '#666',
    transition: 'color 0.2s',
  },
  stepLabelActive: {
    color: '#fff',
  },
  stepLine: {
    width: '40px',
    height: '2px',
    background: '#262626',
    marginBottom: '20px',
  },
  card: {
    background: '#171717',
    borderRadius: '16px',
    padding: '28px',
    border: '1px solid #262626',
    marginBottom: '20px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  description: {
    color: '#aaa',
    fontSize: '14px',
    textAlign: 'center',
    marginBottom: '8px',
  },
  button: {
    width: '100%',
    padding: '14px 20px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '600',
    transition: 'all 0.2s',
  },
  primaryButton: {
    background: '#3b82f6',
    color: 'white',
  },
  secondaryButton: {
    background: '#262626',
    color: 'white',
  },
  textButton: {
    background: 'transparent',
    color: '#888',
    padding: '10px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #262626',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  statusText: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#fff',
  },
  hint: {
    fontSize: '13px',
    color: '#666',
  },
  connectedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: '#052e16',
    border: '1px solid #166534',
    borderRadius: '8px',
    color: '#4ade80',
    fontSize: '13px',
    width: '100%',
    justifyContent: 'center',
  },
  restoredHint: {
    fontSize: '12px',
    color: '#666',
    textAlign: 'center',
    margin: '0',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#4ade80',
  },
  formGroup: {
    width: '100%',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    color: '#888',
    marginBottom: '6px',
    fontWeight: '500',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #333',
    background: '#0a0a0a',
    color: 'white',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  row: {
    display: 'flex',
    gap: '12px',
    width: '100%',
  },
  successIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: '#052e16',
    border: '2px solid #22c55e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    color: '#22c55e',
  },
  successTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#fff',
    margin: '0',
  },
  txDetails: {
    width: '100%',
    background: '#0a0a0a',
    borderRadius: '10px',
    padding: '16px',
  },
  txRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #1a1a1a',
  },
  txLabel: {
    color: '#666',
    fontSize: '13px',
  },
  txValue: {
    color: '#fff',
    fontSize: '13px',
    fontWeight: '500',
  },
  mono: {
    fontFamily: 'monospace',
  },
  errorIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: '#2d1515',
    border: '2px solid #dc2626',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    color: '#dc2626',
  },
  errorTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#fff',
    margin: '0',
  },
  errorMessage: {
    color: '#f87171',
    fontSize: '14px',
    textAlign: 'center',
  },
  codeCard: {
    background: '#0a0a0a',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #1a1a1a',
    marginBottom: '20px',
  },
  codeTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#666',
    marginTop: '0',
    marginBottom: '12px',
  },
  code: {
    fontSize: '12px',
    color: '#a8a29e',
    fontFamily: 'monospace',
    lineHeight: '1.6',
    margin: '0',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  footer: {
    textAlign: 'center',
    color: '#444',
    fontSize: '11px',
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
  },
};

// Add keyframes for spinner animation
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #0a0a0a;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  input:focus { outline: none; border-color: #3b82f6 !important; }
  button:hover { opacity: 0.9; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
`;
document.head.appendChild(styleSheet);
