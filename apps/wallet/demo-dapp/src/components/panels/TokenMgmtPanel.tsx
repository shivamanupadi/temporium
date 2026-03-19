import { type ReactElement, useState } from 'react';
import { ShieldCheck, Sparkles, CirclePlus, Flame } from 'lucide-react';
import type { Address } from 'viem';
import { Actions } from 'viem/tempo';
import { useGateway } from '@/hooks/useGateway';
import { ResultDisplay } from '@/components/layout/ResultDisplay';
import { parseAmount } from '@/lib/utils';

export function TokenMgmtPanel(): ReactElement {
  const { walletClient } = useGateway();
  const [result, setResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Approve
  const [appToken, setAppToken] = useState('');
  const [appSpender, setAppSpender] = useState('');
  const [appAmount, setAppAmount] = useState('1000');

  // Create
  const [createName, setCreateName] = useState('');
  const [createSymbol, setCreateSymbol] = useState('');
  const [createCurrency, setCreateCurrency] = useState('USD');
  const [createAdmin, setCreateAdmin] = useState('');
  const [createQuoteToken, setCreateQuoteToken] = useState('');

  // Mint
  const [mintToken, setMintToken] = useState('');
  const [mintTo, setMintTo] = useState('');
  const [mintAmount, setMintAmount] = useState('100');

  // Burn
  const [burnToken, setBurnToken] = useState('');
  const [burnAmount, setBurnAmount] = useState('10');

  const exec = async (label: string, fn: () => Promise<unknown>) => {
    setLoading(label);
    setResult(null);
    try {
      const data = await fn();
      setResult({ success: true, data });
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(null);
    }
  };

  const inputCls = "w-full px-3 py-2 rounded-lg bg-white border border-[#EDE9E3] text-[12px] text-[#2D3436] focus:border-[#E07A5F] transition-colors";
  const btnCls = "w-full px-4 py-2.5 rounded-xl bg-[#E07A5F] hover:bg-[#D4694F] text-white text-[12px] font-semibold transition-colors disabled:opacity-50";

  return (
    <div className="space-y-6">
      {/* Approve Token */}
      <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-[#6B8F71]" />
          <span className="text-[13px] font-semibold text-[#2D3436]">Actions.token.approve</span>
          <span className="text-[11px] text-[#9B9590]">token, spender, amount</span>
        </div>
        <div className="space-y-2">
          <input value={appToken} onChange={(e) => setAppToken(e.target.value)} placeholder="Token address" className={inputCls} />
          <input value={appSpender} onChange={(e) => setAppSpender(e.target.value)} placeholder="Spender address" className={inputCls} />
          <input value={appAmount} onChange={(e) => setAppAmount(e.target.value)} placeholder="Amount" className={inputCls} />
          <button
            onClick={() => exec('approve', () => Actions.token.approve(walletClient!, { token: appToken as Address, spender: appSpender as Address, amount: parseAmount(appAmount) }))}
            disabled={loading !== null}
            className={btnCls}
          >
            {loading === 'approve' ? 'Approving...' : 'Approve Token'}
          </button>
        </div>
      </div>

      {/* Create Token */}
      <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-[#6B8F71]" />
          <span className="text-[13px] font-semibold text-[#2D3436]">Actions.token.createSync</span>
          <span className="text-[11px] text-[#9B9590]">name, symbol, currency, admin?, quoteToken?</span>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Token name" className={inputCls} />
            <input value={createSymbol} onChange={(e) => setCreateSymbol(e.target.value)} placeholder="Symbol" className={inputCls} />
          </div>
          <input value={createCurrency} onChange={(e) => setCreateCurrency(e.target.value)} placeholder="Currency code (e.g. USD)" className={inputCls} />
          <input value={createAdmin} onChange={(e) => setCreateAdmin(e.target.value)} placeholder="Admin address (optional)" className={inputCls} />
          <input value={createQuoteToken} onChange={(e) => setCreateQuoteToken(e.target.value)} placeholder="Quote token address (optional)" className={inputCls} />
          <button
            onClick={() => exec('create', () => Actions.token.createSync(walletClient!, {
              name: createName,
              symbol: createSymbol,
              currency: createCurrency,
              admin: createAdmin ? (createAdmin as Address) : undefined,
              quoteToken: createQuoteToken ? (createQuoteToken as Address) : undefined,
            }))}
            disabled={loading !== null}
            className={btnCls}
          >
            {loading === 'create' ? 'Creating...' : 'Create Token'}
          </button>
        </div>
      </div>

      {/* Mint Token */}
      <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
        <div className="flex items-center gap-2 mb-3">
          <CirclePlus className="w-4 h-4 text-[#6B8F71]" />
          <span className="text-[13px] font-semibold text-[#2D3436]">Actions.token.mint</span>
          <span className="text-[11px] text-[#9B9590]">token, to, amount</span>
        </div>
        <div className="space-y-2">
          <input value={mintToken} onChange={(e) => setMintToken(e.target.value)} placeholder="Token address" className={inputCls} />
          <input value={mintTo} onChange={(e) => setMintTo(e.target.value)} placeholder="Recipient address" className={inputCls} />
          <input value={mintAmount} onChange={(e) => setMintAmount(e.target.value)} placeholder="Amount" className={inputCls} />
          <button
            onClick={() => exec('mint', () => Actions.token.mint(walletClient!, { token: mintToken as Address, to: mintTo as Address, amount: parseAmount(mintAmount) }))}
            disabled={loading !== null}
            className={btnCls}
          >
            {loading === 'mint' ? 'Minting...' : 'Mint Tokens'}
          </button>
        </div>
      </div>

      {/* Burn Token */}
      <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-4 h-4 text-[#E07A5F]" />
          <span className="text-[13px] font-semibold text-[#2D3436]">Actions.token.burn</span>
          <span className="text-[11px] text-[#9B9590]">token, amount</span>
        </div>
        <div className="space-y-2">
          <input value={burnToken} onChange={(e) => setBurnToken(e.target.value)} placeholder="Token address" className={inputCls} />
          <input value={burnAmount} onChange={(e) => setBurnAmount(e.target.value)} placeholder="Amount" className={inputCls} />
          <button
            onClick={() => exec('burn', () => Actions.token.burn(walletClient!, { token: burnToken as Address, amount: parseAmount(burnAmount) }))}
            disabled={loading !== null}
            className={btnCls}
          >
            {loading === 'burn' ? 'Burning...' : 'Burn Tokens'}
          </button>
        </div>
      </div>

      <ResultDisplay result={result} />
    </div>
  );
}
