import type React from 'react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { Address, Hash } from 'viem';
import { toast } from 'sonner';
import {
  MonacoEditor,
  EditorToolbar,
  ErrorPanel,
  TemplateSelector,
  FileTree,
} from '@/components/editor';
import { DeployPanel, DeploySuccessModal } from '@/components/deploy';
import { ContractsPanel } from '@/components/interact/ContractsPanel';
import {
  useProject,
  useCreateFile,
  useUpdateFileContent,
  useRenamePath,
  useDeletePath,
} from '@/hooks/useProjects';
import { useCompiler } from '@/hooks/useCompiler';
import { useTempo } from '@/hooks/useTempo';
import { useSaveDeployedContract } from '@/hooks/useDeployedContracts';
import { getTemplate } from '@/lib/templates';
import { filesToMap } from '@/lib/projects-storage';
import type { CompiledContract } from '@/lib/compiler';

export const Route = createFileRoute('/portal/$projectId/editor')({
  component: EditorPage,
});

function EditorPage(): React.ReactElement {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const { data: project, isLoading: isLoadingProject } = useProject(projectId);

  // File mutations
  const createFileMutation = useCreateFile();
  const updateFileContentMutation = useUpdateFileContent();
  const renamePathMutation = useRenamePath();
  const deletePathMutation = useDeletePath();

  // Editor state
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);

  // Compiler
  const { compileFiles, result: compileResult, isCompiling, reset: resetCompiler } = useCompiler();

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

  // Convert files to map for compiler
  const filesMap = useMemo(() => {
    return project?.files ? filesToMap(project.files) : {};
  }, [project?.files]);

  // Memoize contracts to prevent infinite loops in DeployPanel
  const contracts = useMemo(() => {
    return compileResult?.contracts ?? [];
  }, [compileResult?.contracts]);

  // Select first file on project load
  useEffect(() => {
    if (project?.files?.length && !selectedPath) {
      // Find first .sol file
      const solFile = project.files.find(f => f.path.endsWith('.sol'));
      if (solFile) {
        setSelectedPath(solFile.path);
        setCode(solFile.content);
      }
    }
  }, [project, selectedPath]);

  // Load selected file content and reset compiler when file changes
  useEffect(() => {
    if (selectedPath && project?.files) {
      const file = project.files.find(f => f.path === selectedPath);
      if (file) {
        setCode(file.content);
      }
      // Reset compiler results when switching files
      resetCompiler();
      setDeployError(null);
    }
  }, [selectedPath, project?.files, resetCompiler]);

  // Auto-save on code change
  useEffect(() => {
    if (!project || !selectedPath || !code) return;
    const timeout = setTimeout(() => {
      updateFileContentMutation.mutate({
        projectId,
        path: selectedPath,
        content: code,
      });
    }, 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, projectId, selectedPath]);

  const handleCompile = useCallback(async () => {
    // Compile all files, passing the selected file as main
    await compileFiles(filesMap, selectedPath || 'contracts/Contract.sol');
  }, [filesMap, selectedPath, compileFiles]);

  const handleTemplateSelect = useCallback(
    async (templateId: string) => {
      const template = getTemplate(templateId);
      if (!template) return;

      // Multi-file template
      if (template.files && template.files.length > 0) {
        // Create all template files
        for (const file of template.files) {
          // Check if file exists, if so update, otherwise create
          const existingFile = project?.files.find(f => f.path === file.path);
          if (existingFile) {
            await updateFileContentMutation.mutateAsync({
              projectId,
              path: file.path,
              content: file.content,
            });
          } else {
            await createFileMutation.mutateAsync({
              projectId,
              path: file.path,
              content: file.content,
            });
          }
        }
        // Select the first file
        const firstFile = template.files[0];
        setSelectedPath(firstFile.path);
        setCode(firstFile.content);
        toast.success(`Loaded "${template.name}" template (${template.files.length} files)`);
      } else if (selectedPath) {
        // Single file template
        setCode(template.source);
        updateFileContentMutation.mutate({
          projectId,
          path: selectedPath,
          content: template.source,
        });
        toast.success(`Loaded "${template.name}" template`);
      }
    },
    [selectedPath, projectId, project?.files, updateFileContentMutation, createFileMutation]
  );

  // File tree handlers
  const handleSelectFile = useCallback((path: string) => {
    setSelectedPath(path);
  }, []);

  const handleCreateFile = useCallback(
    (path: string) => {
      createFileMutation.mutate(
        { projectId, path, content: '' },
        {
          onSuccess: () => {
            setSelectedPath(path);
            toast.success(`Created ${path}`);
          },
        }
      );
    },
    [projectId, createFileMutation]
  );

  const handleCreateFolder = useCallback(
    (path: string) => {
      // Create a placeholder file in the folder
      createFileMutation.mutate(
        { projectId, path: `${path}/.gitkeep`, content: '' },
        {
          onSuccess: () => {
            toast.success(`Created folder ${path}`);
          },
        }
      );
    },
    [projectId, createFileMutation]
  );

  const handleRename = useCallback(
    (oldPath: string, newPath: string) => {
      renamePathMutation.mutate(
        { projectId, oldPath, newPath },
        {
          onSuccess: () => {
            if (selectedPath === oldPath) {
              setSelectedPath(newPath);
            } else if (selectedPath?.startsWith(oldPath + '/')) {
              setSelectedPath(selectedPath.replace(oldPath, newPath));
            }
            toast.success(`Renamed to ${newPath.split('/').pop()}`);
          },
        }
      );
    },
    [projectId, renamePathMutation, selectedPath]
  );

  const handleDeletePath = useCallback(
    (path: string) => {
      deletePathMutation.mutate(
        { projectId, path },
        {
          onSuccess: () => {
            if (selectedPath === path || selectedPath?.startsWith(path + '/')) {
              // Select another file
              const remaining = project?.files?.filter(
                f => f.path !== path && !f.path.startsWith(path + '/')
              );
              const next = remaining?.find(f => f.path.endsWith('.sol'));
              setSelectedPath(next?.path || null);
              setCode(next?.content || '');
            }
            toast.success(`Deleted ${path.split('/').pop()}`);
          },
        }
      );
    },
    [projectId, deletePathMutation, selectedPath, project?.files]
  );

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
          sourcePath: selectedPath || undefined,
        });

        setDeploySuccess({
          name: contract.name,
          address: result.address,
          txHash: result.hash,
        });
      } catch (err) {
        setDeployError(err as Error);
      } finally {
        setIsDeploying(false);
      }
    },
    [deployContract, saveContract, projectId, selectedPath]
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
        <button className="text-primary underline" onClick={() => navigate({ to: '/portal' })}>
          Back to projects
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* File Tree */}
      <div className="w-56 border-r border-border bg-card/50 flex-shrink-0">
        <FileTree
          files={project.files}
          selectedPath={selectedPath}
          onSelectFile={handleSelectFile}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
          onRename={handleRename}
          onDelete={handleDeletePath}
          className="h-full"
        />
      </div>

      {/* Editor with Header */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Editor Header */}
        <EditorToolbar
          projectName={project.name}
          fileName={selectedPath?.split('/').pop()}
          isCompiling={isCompiling}
          onCompile={handleCompile}
          onOpenTemplates={() => setIsTemplateOpen(true)}
        />

        {/* Monaco Editor */}
        <div className="flex-1 min-h-0">
          {selectedPath ? (
            <MonacoEditor
              value={code}
              onChange={setCode}
              errors={compileResult?.errors ?? []}
              className="h-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p>Select a file to edit</p>
                <p className="text-sm mt-1">or create a new file from the file tree</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="flex w-72 flex-col overflow-y-auto border-l border-slate-200 bg-slate-50/50 flex-shrink-0">
        {/* Deploy Panel */}
        <div className="p-4">
          <DeployPanel
            contracts={contracts}
            isConnected={isConnected}
            onDeploy={handleDeploy}
            isDeploying={isDeploying}
            error={deployError}
          />
        </div>

        {/* Errors Panel */}
        {compileResult && (
          <>
            <div className="mx-4 border-t border-slate-200" />
            <div className="p-4">
              <ErrorPanel errors={compileResult.errors} warnings={compileResult.warnings} />
            </div>
          </>
        )}

        {/* Contracts Panel */}
        <div className="mx-4 border-t border-slate-200" />
        <div className="p-4">
          <ContractsPanel projectId={projectId} />
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
