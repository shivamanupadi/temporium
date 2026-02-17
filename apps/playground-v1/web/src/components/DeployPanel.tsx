import { useState, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Blocks,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { CompileResult, CompiledContract } from '@/hooks/useCompiler';
import { useTempo } from '@/hooks/useTempo';
import { useSaveContract } from '@/hooks/useContracts';
import { useEditorStore } from '@/stores/editor-store';
import { getExplorerTxUrl, getExplorerAddressUrl } from '@/lib/tempo-client';
import { copyToClipboard, formatAddress } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { TEMPO_NETWORK } from '@/lib/constants';

interface DeployPanelProps {
  compileResult: CompileResult | null;
  isCompiling: boolean;
  projectId: string;
  onCompile: () => void;
}

export function DeployPanel({ compileResult, isCompiling, projectId, onCompile }: DeployPanelProps): ReactElement {
  const { isConnected, address, deployContract } = useTempo();
  const saveContract = useSaveContract();
  const { setRightPanelTab } = useEditorStore();

  const [selectedContract, setSelectedContract] = useState<CompiledContract | null>(null);
  const [constructorArgs, setConstructorArgs] = useState<string[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [deployResult, setDeployResult] = useState<{ address: string; txHash: string; name: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const contracts = compileResult?.contracts ?? [];

  // Get constructor inputs from ABI
  const constructorAbi = selectedContract?.abi?.find((item: any) => item.type === 'constructor');
  const constructorInputs = constructorAbi?.inputs ?? [];

  const handleSelectContract = (c: CompiledContract) => {
    setSelectedContract(c);
    setConstructorArgs(new Array(c.abi?.find((a: any) => a.type === 'constructor')?.inputs?.length ?? 0).fill(''));
  };

  const handleDeploy = async () => {
    if (!selectedContract || !isConnected) return;

    setIsDeploying(true);
    try {
      const args = constructorInputs.map((input: any, i: number) => {
        const val = constructorArgs[i] || '';
        if (input.type.startsWith('uint') || input.type.startsWith('int')) return BigInt(val);
        if (input.type === 'bool') return val.toLowerCase() === 'true';
        return val;
      });

      const result = await deployContract({
        abi: selectedContract.abi,
        bytecode: selectedContract.bytecode as `0x${string}`,
        args: args.length > 0 ? args : undefined,
      });

      // Save to API
      await saveContract.mutateAsync({
        projectId,
        name: selectedContract.name,
        address: result.address,
        abi: JSON.stringify(selectedContract.abi),
        bytecode: selectedContract.bytecode,
        txHash: result.txHash,
        constructorArgs: args.length > 0 ? JSON.stringify(args.map(String)) : undefined,
        network: TEMPO_NETWORK,
      });

      setDeployResult({ address: result.address, txHash: result.txHash, name: selectedContract.name });
      setShowSuccess(true);

      // Confetti
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.5 },
        colors: ['#E07A5F', '#9B72CF', '#5B9A6F'],
      });

      toast.success('Deployment successful!');
    } catch (err) {
      toast.error('Deployment failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    await copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-3 space-y-4">
      {/* Compile Status */}
      <div className="space-y-2">
        <label className="text-[11px] uppercase tracking-wider font-semibold text-[#6B6560]">
          Compile Status
        </label>
        {!compileResult && !isCompiling && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-[#EDE9E3] text-[#B5B0AA]">
            <div className="w-2 h-2 rounded-full border border-[#B5B0AA]" />
            <span className="text-xs">Not compiled yet</span>
            <Button size="sm" variant="outline" className="ml-auto text-xs h-7" onClick={onCompile}>
              Compile
            </Button>
          </div>
        )}
        {isCompiling && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-[#EDE9E3] bg-[#F5F2ED]">
            <Loader2 className="w-4 h-4 animate-spin text-[#E07A5F]" />
            <span className="text-xs text-[#6B6560]">Compiling...</span>
          </div>
        )}
        {compileResult?.success && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-[#5B9A6F]/20 bg-[#5B9A6F]/5">
            <CheckCircle2 className="w-4 h-4 text-[#5B9A6F]" />
            <span className="text-xs text-[#5B9A6F] font-medium">
              {contracts.length} contract{contracts.length !== 1 ? 's' : ''} compiled
            </span>
          </div>
        )}
        {compileResult && !compileResult.success && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-[#E5484D]/20 bg-[#E5484D]/5">
            <AlertCircle className="w-4 h-4 text-[#E5484D]" />
            <span className="text-xs text-[#E5484D] font-medium">Compilation errors</span>
          </div>
        )}
      </div>

      {/* Contract Selector */}
      {contracts.length > 0 && (
        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-wider font-semibold text-[#6B6560]">
            Select Contract
          </label>
          <div className="space-y-1.5">
            {contracts.map(c => (
              <button
                key={c.name}
                onClick={() => handleSelectContract(c)}
                className={`w-full p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedContract?.name === c.name
                    ? 'border-[#E07A5F] bg-[#E07A5F]/5'
                    : 'border-[#EDE9E3] hover:border-[#E07A5F]/30'
                }`}
              >
                <div className="text-sm font-medium text-[#2D3436]">{c.name}</div>
                <div className="text-[10px] text-[#B5B0AA] mt-0.5 font-mono truncate">
                  {c.bytecode.slice(0, 20)}...
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Constructor Args */}
      {selectedContract && constructorInputs.length > 0 && (
        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-wider font-semibold text-[#6B6560]">
            Constructor Arguments
          </label>
          {constructorInputs.map((input: any, i: number) => (
            <div key={i}>
              <Label className="text-xs text-[#6B6560] mb-1">{input.name} ({input.type})</Label>
              <Input
                value={constructorArgs[i] || ''}
                onChange={e => {
                  const next = [...constructorArgs];
                  next[i] = e.target.value;
                  setConstructorArgs(next);
                }}
                placeholder={input.type}
                className="h-8 text-xs font-mono"
              />
            </div>
          ))}
        </div>
      )}

      {/* Deploy Button */}
      <div className="space-y-2">
        {!isConnected ? (
          <Button disabled className="w-full h-12 rounded-xl text-sm">
            Connect Wallet to Deploy
          </Button>
        ) : !selectedContract ? (
          <Button disabled className="w-full h-12 rounded-xl text-sm">
            Select a Contract
          </Button>
        ) : (
          <Button
            onClick={handleDeploy}
            disabled={isDeploying}
            className="w-full h-12 rounded-xl text-sm shadow-md shadow-[#E07A5F]/20"
          >
            {isDeploying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                Deploy to Tempo
              </>
            )}
          </Button>
        )}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#B5B0AA]">
          <div className="w-1.5 h-1.5 rounded-full bg-[#5B9A6F]" />
          Tempo Testnet
        </div>
      </div>

      {/* Success Modal */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="max-w-sm p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
          >
            <CheckCircle2 className="w-16 h-16 text-[#5B9A6F] mx-auto mb-4" />
          </motion.div>
          <DialogTitle className="text-xl font-bold mb-2">Deployment Successful!</DialogTitle>
          <DialogDescription className="text-sm text-[#6B6560] mb-4">
            Your contract has been deployed to Tempo
          </DialogDescription>

          {deployResult && (
            <div className="space-y-3 text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#5B9A6F]/10 text-[#5B9A6F] text-xs font-medium">
                <Sparkles className="w-3 h-3" />
                {deployResult.name}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F5F2ED]">
                  <div>
                    <div className="text-[10px] text-[#B5B0AA]">Address</div>
                    <div className="text-xs font-mono text-[#2D3436]">{formatAddress(deployResult.address, 8)}</div>
                  </div>
                  <button onClick={() => handleCopy(deployResult.address, 'address')} className="p-1.5 rounded hover:bg-[#EDE9E3] cursor-pointer">
                    {copied === 'address' ? <Check className="w-3.5 h-3.5 text-[#5B9A6F]" /> : <Copy className="w-3.5 h-3.5 text-[#6B6560]" />}
                  </button>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F5F2ED]">
                  <div>
                    <div className="text-[10px] text-[#B5B0AA]">Transaction</div>
                    <div className="text-xs font-mono text-[#2D3436]">{formatAddress(deployResult.txHash, 8)}</div>
                  </div>
                  <button onClick={() => handleCopy(deployResult.txHash, 'tx')} className="p-1.5 rounded hover:bg-[#EDE9E3] cursor-pointer">
                    {copied === 'tx' ? <Check className="w-3.5 h-3.5 text-[#5B9A6F]" /> : <Copy className="w-3.5 h-3.5 text-[#6B6560]" />}
                  </button>
                </div>
              </div>

              <a
                href={getExplorerTxUrl(deployResult.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-[#E07A5F] hover:underline"
              >
                View on Explorer <ExternalLink className="w-3 h-3" />
              </a>

              <Button
                className="w-full"
                onClick={() => {
                  setShowSuccess(false);
                  setRightPanelTab('interact');
                }}
              >
                <Blocks className="w-4 h-4" />
                Interact with Contract
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
