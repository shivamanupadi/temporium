import { useState, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Blocks,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Send,
  Eye,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContracts, type DeployedContract } from '@/hooks/useContracts';
import { tempoPublicClient } from '@/lib/tempo-client';
import { getExplorerAddressUrl } from '@/lib/tempo-client';
import { formatAddress, copyToClipboard } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useAccount, useWalletClient } from 'wagmi';

export function InteractPanel(): ReactElement {
  const { data: contracts, isLoading } = useContracts();

  if (isLoading) {
    return (
      <div className="p-3 flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-[#E07A5F]" />
      </div>
    );
  }

  if (!contracts || contracts.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-center py-16">
        <div className="w-12 h-12 rounded-xl border-2 border-dashed border-[#EDE9E3] flex items-center justify-center mb-3">
          <Blocks className="w-5 h-5 text-[#B5B0AA]" />
        </div>
        <p className="text-sm font-medium text-[#6B6560] mb-1">No contracts deployed yet</p>
        <p className="text-xs text-[#B5B0AA]">Deploy a contract to interact with it</p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1.5">
      {contracts.map(contract => (
        <ContractAccordion key={contract.id} contract={contract} />
      ))}
    </div>
  );
}

function ContractAccordion({ contract }: { contract: DeployedContract }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'read' | 'write'>('read');
  const abi = JSON.parse(contract.abi) as any[];

  const readFunctions = abi.filter(
    (item: any) => item.type === 'function' && (item.stateMutability === 'view' || item.stateMutability === 'pure')
  );
  const writeFunctions = abi.filter(
    (item: any) => item.type === 'function' && item.stateMutability !== 'view' && item.stateMutability !== 'pure'
  );

  return (
    <div className="rounded-lg border border-[#EDE9E3] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-3 hover:bg-[#F5F2ED] transition-colors cursor-pointer"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-[#6B6560]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[#6B6560]" />
        )}
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-[#2D3436]">{contract.name}</div>
          <div className="text-[10px] text-[#B5B0AA] font-mono">{formatAddress(contract.address, 6)}</div>
        </div>
        <a
          href={getExplorerAddressUrl(contract.address)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="p-1 rounded hover:bg-[#EDE9E3]"
        >
          <ExternalLink className="w-3 h-3 text-[#B5B0AA]" />
        </a>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#EDE9E3] p-2">
              {/* Read/Write tabs */}
              <div className="flex bg-[#F5F2ED] rounded-md p-0.5 mb-2">
                <button
                  onClick={() => setActiveTab('read')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    activeTab === 'read' ? 'bg-white text-[#2D3436] shadow-sm' : 'text-[#6B6560]'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  Read ({readFunctions.length})
                </button>
                <button
                  onClick={() => setActiveTab('write')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    activeTab === 'write' ? 'bg-white text-[#2D3436] shadow-sm' : 'text-[#6B6560]'
                  }`}
                >
                  <Send className="w-3 h-3" />
                  Write ({writeFunctions.length})
                </button>
              </div>

              {/* Functions */}
              <div className="space-y-1.5">
                {(activeTab === 'read' ? readFunctions : writeFunctions).map((fn: any, i: number) => (
                  <FunctionCard
                    key={`${fn.name}-${i}`}
                    fn={fn}
                    contractAddress={contract.address}
                    isRead={activeTab === 'read'}
                  />
                ))}
                {(activeTab === 'read' ? readFunctions : writeFunctions).length === 0 && (
                  <p className="text-xs text-[#B5B0AA] text-center py-3">
                    No {activeTab} functions
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FunctionCard({
  fn,
  contractAddress,
  isRead,
}: {
  fn: any;
  contractAddress: string;
  isRead: boolean;
}) {
  const [args, setArgs] = useState<string[]>(new Array(fn.inputs?.length ?? 0).fill(''));
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { data: walletClient } = useWalletClient();

  const handleCall = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const parsedArgs = fn.inputs?.map((input: any, i: number) => {
        const val = args[i] || '';
        if (input.type.startsWith('uint') || input.type.startsWith('int')) return BigInt(val);
        if (input.type === 'bool') return val.toLowerCase() === 'true';
        return val;
      }) ?? [];

      if (isRead) {
        const data = await tempoPublicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: [fn],
          functionName: fn.name,
          args: parsedArgs,
        });
        setResult(String(data));
      } else {
        if (!walletClient) throw new Error('Wallet not connected');
        const hash = await walletClient.writeContract({
          address: contractAddress as `0x${string}`,
          abi: [fn],
          functionName: fn.name,
          args: parsedArgs,
        } as any);
        setResult(`tx: ${hash}`);
      }
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-md border border-[#EDE9E3] p-2.5">
      <div className="text-xs font-mono font-medium text-[#2D3436] mb-1.5">{fn.name}</div>

      {fn.inputs?.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {fn.inputs.map((input: any, i: number) => (
            <Input
              key={i}
              value={args[i] || ''}
              onChange={e => {
                const next = [...args];
                next[i] = e.target.value;
                setArgs(next);
              }}
              placeholder={`${input.name} (${input.type})`}
              className="h-7 text-[11px] font-mono"
            />
          ))}
        </div>
      )}

      <Button
        size="sm"
        variant={isRead ? 'secondary' : 'default'}
        onClick={handleCall}
        disabled={isLoading}
        className="w-full h-7 text-[11px]"
      >
        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : isRead ? 'Call' : 'Send'}
      </Button>

      {result && (
        <div className="mt-2 p-2 rounded-md bg-[#FAF8F5] text-[11px] font-mono text-[#2D3436] break-all">
          {result}
        </div>
      )}
    </div>
  );
}
