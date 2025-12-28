import type React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { Address, Hash } from 'viem';
import { toast } from 'sonner';
import { MonacoEditor, EditorToolbar, ErrorPanel, TemplateSelector } from '@/components/editor';
import { DeployPanel, DeploySuccessModal } from '@/components/deploy';
import { useProject, useUpdateProjectSource } from '@/hooks/useProjects';
import { useCompiler } from '@/hooks/useCompiler';
import { useTempo } from '@/hooks/useTempo';
import { useSaveDeployedContract } from '@/hooks/useDeployedContracts';
import { getTemplate } from '@/lib/templates';
import type { CompiledContract } from '@/lib/compiler';

export const Route = createFileRoute('/editor/$projectId')({
  component: EditorPage,
});

function EditorPage(): React.ReactElement {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const { data: project, isLoading: isLoadingProject } = useProject(projectId);
  const updateSource = useUpdateProjectSource();

  // Editor state
  const [code, setCode] = useState('');
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);

  // Compiler
  const { compile, result: compileResult, isCompiling } = useCompiler();

  // Wallet & deploy
  const { isConnected, deployContract } = useTempo();
  const saveContract = useSaveDeployedContract();
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployError, setDeployError] = useState<Error | null>(null);

  // Deploy success modal
  const [deploySuccess, setDeploySuccess] = useState<{
    name: string;
    address: Address;
    txHash: Hash;
  } | null>(null);

  // Load project source
  useEffect(() => {
    if (project?.files?.[0]) {
      setCode(project.files[0].content);
    }
  }, [project]);

  // Auto-save on code change
  useEffect(() => {
    if (!project || !code) return;
    const timeout = setTimeout(() => {
      updateSource.mutate({
        id: projectId,
        fileName: 'Contract.sol',
        content: code,
      });
    }, 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, projectId]);

  const handleCompile = useCallback(async () => {
    const result = await compile(code);
    if (result.success) {
      toast.success('Compilation successful', {
        description: `${result.contracts.length} contract(s) compiled`,
      });
    } else {
      toast.error('Compilation failed', {
        description: `${result.errors.length} error(s)`,
      });
    }
  }, [code, compile]);

  const handleTemplateSelect = useCallback((templateId: string) => {
    const template = getTemplate(templateId);
    if (template) {
      setCode(template.source);
      toast.success(`Loaded "${template.name}" template`);
    }
  }, []);

  const handleDeploy = useCallback(
    async (contract: CompiledContract, args: unknown[]) => {
      setIsDeploying(true);
      setDeployError(null);

      try {
        const result = await deployContract({
          abi: contract.abi,
          bytecode: contract.bytecode,
          args,
        });

        // Save to IndexedDB
        await saveContract.mutateAsync({
          address: result.address,
          name: contract.name,
          abi: contract.abi,
          bytecode: contract.bytecode,
          deployedAt: new Date(),
          txHash: result.hash,
          projectId,
        });

        setDeploySuccess({
          name: contract.name,
          address: result.address,
          txHash: result.hash,
        });

        toast.success('Contract deployed!', {
          description: `${contract.name} deployed successfully`,
        });
      } catch (err) {
        setDeployError(err as Error);
        toast.error('Deployment failed', {
          description: (err as Error).message,
        });
      } finally {
        setIsDeploying(false);
      }
    },
    [deployContract, saveContract, projectId]
  );

  if (isLoadingProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-muted-foreground">Project not found</div>
        <button className="text-primary underline" onClick={() => navigate({ to: '/editor' })}>
          Back to projects
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar
        projectName={project.name}
        isCompiling={isCompiling}
        onCompile={handleCompile}
        onOpenTemplates={() => setIsTemplateOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        {/* Editor */}
        <div className="flex-1">
          <MonacoEditor
            value={code}
            onChange={setCode}
            errors={compileResult?.errors ?? []}
            className="h-full"
          />
        </div>

        {/* Sidebar */}
        <div className="flex w-80 flex-col gap-4 overflow-y-auto border-l border-border bg-card p-4">
          {/* Deploy Panel */}
          <DeployPanel
            contracts={compileResult?.contracts ?? []}
            isConnected={isConnected}
            onDeploy={handleDeploy}
            isDeploying={isDeploying}
            error={deployError}
          />

          {/* Errors Panel */}
          {compileResult && (
            <ErrorPanel
              errors={compileResult.errors}
              warnings={compileResult.warnings}
              className="flex-1"
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <TemplateSelector
        open={isTemplateOpen}
        onOpenChange={setIsTemplateOpen}
        onSelect={handleTemplateSelect}
      />

      {deploySuccess && (
        <DeploySuccessModal
          open={!!deploySuccess}
          onOpenChange={() => setDeploySuccess(null)}
          contractName={deploySuccess.name}
          contractAddress={deploySuccess.address}
          txHash={deploySuccess.txHash}
        />
      )}
    </div>
  );
}
