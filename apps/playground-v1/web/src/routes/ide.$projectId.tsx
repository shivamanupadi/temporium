import { type ReactElement, useState, useCallback, useEffect, useRef } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Code2,
  Rocket,
  Blocks,
  ChevronDown,
  Search,
  Plus,
  X,
  Play,
  Loader2,
  FileCode2,
  File,
  Trash2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  LogOut,
} from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useProject, type ProjectFile } from '@/hooks/useProjects';
import { useCreateFile, useUpdateFile, useDeleteFile } from '@/hooks/useFiles';
import { useCompiler, type CompileResult } from '@/hooks/useCompiler';
import { useContracts, useSaveContract } from '@/hooks/useContracts';
import { useTempo } from '@/hooks/useTempo';
import { useEditorStore } from '@/stores/editor-store';
import { formatAddress } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { TIMING } from '@/lib/constants';
import { MonacoEditor } from '@/components/MonacoEditor';
import { DeployPanel } from '@/components/DeployPanel';
import { InteractPanel } from '@/components/InteractPanel';
import { CommandPalette } from '@/components/CommandPalette';

export const Route = createFileRoute('/ide/$projectId')({
  component: IdePage,
});

function IdePage(): ReactElement {
  useAuthGuard();
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId);
  const { address, disconnect } = useTempo();
  const { compile, isCompiling, result: compileResult } = useCompiler();
  const createFile = useCreateFile();
  const updateFile = useUpdateFile();
  const deleteFile = useDeleteFile();

  const {
    openTabs, activeTabId, showRightPanel, showBottomPanel,
    rightPanelTab, bottomPanelTab,
    openTab, closeTab, setActiveTab, markDirty,
    toggleRightPanel, toggleBottomPanel,
    setRightPanelTab, setBottomPanelTab,
    setCompileResult,
  } = useEditorStore();

  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fileContentRef = useRef<Record<string, string>>({});

  // Track active file
  const activeFile = project?.files?.find(f => f.id === activeTabId);

  // Init file contents from project
  useEffect(() => {
    if (project?.files) {
      for (const file of project.files) {
        if (!(file.id in fileContentRef.current)) {
          fileContentRef.current[file.id] = file.content;
        }
      }
    }
  }, [project?.files]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === 'k') { e.preventDefault(); setShowCommandPalette(true); }
      if (meta && e.key === 'b') { e.preventDefault(); /* explorer always visible */ }
      if (meta && e.key === 'j') { e.preventDefault(); toggleBottomPanel(); }
      if (meta && e.shiftKey && e.key === 'B') { e.preventDefault(); handleCompile(); }
      if (meta && e.shiftKey && e.key === 'N') { e.preventDefault(); setCreatingFile(true); }
      if (meta && e.key === 'w') { e.preventDefault(); if (activeTabId) closeTab(activeTabId); }
      if (meta && e.key === 's') { e.preventDefault(); if (activeTabId) savefile(activeTabId); }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId]);

  // Auto-save debounced
  const handleContentChange = useCallback((fileId: string, content: string) => {
    fileContentRef.current[fileId] = content;
    markDirty(fileId, true);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      savefile(fileId);
    }, TIMING.AUTOSAVE_DEBOUNCE_MS);
  }, []);

  const savefile = useCallback(async (fileId: string) => {
    const content = fileContentRef.current[fileId];
    if (content === undefined) return;
    try {
      await updateFile.mutateAsync({ projectId, fileId, content });
      markDirty(fileId, false);
    } catch {
      // silent fail — will retry on next save
    }
  }, [projectId, updateFile]);

  const handleCompile = useCallback(async () => {
    if (!project?.files) return;
    const sources: Record<string, string> = {};
    for (const file of project.files) {
      if (file.path.endsWith('.sol')) {
        sources[file.path] = fileContentRef.current[file.id] ?? file.content;
      }
    }
    if (Object.keys(sources).length === 0) {
      toast.warning('No Solidity files to compile');
      return;
    }
    const result = await compile(sources);
    setCompileResult(result);
    if (result.success) {
      toast.success('Compilation successful', {
        description: `${result.contracts.length} contract(s) compiled`,
      });
    } else {
      const errorCount = result.errors.filter(e => e.severity === 'error').length;
      toast.error('Compilation failed', {
        description: `${errorCount} error(s)`,
      });
    }
  }, [project?.files, compile, setCompileResult]);

  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;
    let path = newFileName.trim();
    if (!path.includes('/')) path = `contracts/${path}`;
    if (!path.endsWith('.sol') && !path.includes('.')) path += '.sol';
    try {
      const file = await createFile.mutateAsync({ projectId, path, content: '' });
      setCreatingFile(false);
      setNewFileName('');
      openTab({ id: file.id, path: file.path, isDirty: false });
    } catch {
      toast.error('Failed to create file');
    }
  };

  const handleDeleteFile = async (file: ProjectFile) => {
    try {
      await deleteFile.mutateAsync({ projectId, fileId: file.id });
      closeTab(file.id);
      toast.success('File deleted');
    } catch {
      toast.error('Failed to delete file');
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    navigate({ to: '/' });
  };

  const errorCount = compileResult?.errors?.filter(e => e.severity === 'error').length ?? 0;
  const warningCount = compileResult?.errors?.filter(e => e.severity === 'warning').length ?? 0;

  // File icon helper
  const getFileIcon = (path: string) => {
    if (path.endsWith('.sol')) return <FileCode2 className="w-4 h-4 text-[#E07A5F]" />;
    return <File className="w-4 h-4 text-[#6B8EAD]" />;
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-[#E07A5F]" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* ============ Top Bar (48px) ============ */}
      <div className="h-12 bg-white border-b border-[#EDE9E3] flex items-center px-3 shrink-0">
        {/* Left: Logo + Project */}
        <div className="flex items-center gap-2 mr-4">
          <button onClick={() => navigate({ to: '/portal' })} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer">
            <Code2 className="w-4.5 h-4.5 text-[#E07A5F]" />
            <span className="font-bold text-sm text-[#2D3436]">Temporium</span>
          </button>
          <div className="w-px h-5 bg-[#EDE9E3]" />
          <button
            onClick={() => navigate({ to: '/portal' })}
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-[#F5F2ED] transition-colors cursor-pointer"
          >
            <span className="text-sm font-medium text-[#2D3436] max-w-[150px] truncate">
              {project?.name || 'Untitled'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#6B6560]" />
          </button>
        </div>

        {/* Center: Command Palette trigger */}
        <button
          onClick={() => setShowCommandPalette(true)}
          className="flex-1 max-w-xs mx-auto flex items-center gap-2 px-3 h-8 rounded-lg bg-[#F5F2ED] hover:bg-[#EDE9E3] transition-colors cursor-pointer"
        >
          <Search className="w-3.5 h-3.5 text-[#6B6560]" />
          <span className="text-xs text-[#B5B0AA] flex-1 text-left">Search or run a command...</span>
          <kbd className="text-[10px] font-mono text-[#B5B0AA] bg-white px-1.5 py-0.5 rounded border border-[#EDE9E3]">
            ⌘K
          </kbd>
        </button>

        {/* Right: Network + Wallet */}
        <div className="flex items-center gap-2 ml-4">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F5F2ED] text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-[#5B9A6F]" />
            <span className="text-[#6B6560]">Tempo Testnet</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F5F2ED] text-xs text-[#2D3436]">
            {address && formatAddress(address)}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleDisconnect} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#F5F2ED] transition-colors cursor-pointer">
                <LogOut className="w-3.5 h-3.5 text-[#6B6560]" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Disconnect</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ============ Main Area ============ */}
      <div className="flex-1 flex overflow-hidden">
        {/* Resizable Panels */}
        <PanelGroup direction="horizontal" className="flex-1">
          {/* File Explorer */}
              <Panel defaultSize={18} minSize={12} maxSize={30}>
                <div className="h-full bg-[#FAF8F5] border-r border-[#EDE9E3] flex flex-col">
                  {/* Explorer header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#EDE9E3]">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-[#6B6560]">
                      Explorer
                    </span>
                    <div className="flex gap-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setCreatingFile(true)}
                            className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#EDE9E3] transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-[#6B6560]" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>New File</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {/* New file input */}
                  {creatingFile && (
                    <div className="px-2 py-1.5 border-b border-[#EDE9E3]">
                      <Input
                        value={newFileName}
                        onChange={e => setNewFileName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleCreateFile();
                          if (e.key === 'Escape') { setCreatingFile(false); setNewFileName(''); }
                        }}
                        placeholder="contracts/MyContract.sol"
                        className="h-7 text-xs"
                        autoFocus
                      />
                    </div>
                  )}

                  {/* File tree */}
                  <div className="flex-1 overflow-y-auto py-1">
                    {project?.files?.map(file => (
                      <button
                        key={file.id}
                        onClick={() => {
                          openTab({ id: file.id, path: file.path, isDirty: false });
                          fileContentRef.current[file.id] = fileContentRef.current[file.id] ?? file.content;
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors cursor-pointer group ${
                          activeTabId === file.id
                            ? 'bg-[#E07A5F]/10 border-l-2 border-[#E07A5F]'
                            : 'hover:bg-[#EDE9E3]/50 border-l-2 border-transparent'
                        }`}
                      >
                        {getFileIcon(file.path)}
                        <span className="flex-1 truncate text-[#2D3436]">
                          {file.path.split('/').pop()}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteFile(file); }}
                          className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center hover:bg-[#E5484D]/10 transition-all"
                        >
                          <Trash2 className="w-3 h-3 text-[#6B6560] hover:text-[#E5484D]" />
                        </button>
                      </button>
                    ))}
                  </div>
                </div>
              </Panel>
              <PanelResizeHandle className="w-px bg-[#EDE9E3] hover:bg-[#E07A5F] transition-colors" />

          {/* Center: Editor + Bottom Panel */}
          <Panel defaultSize={55}>
            <PanelGroup direction="vertical">
              {/* Editor */}
              <Panel defaultSize={70} minSize={30}>
                <div className="h-full flex flex-col bg-white">
                  {/* Tab Bar */}
                  <div className="h-9 bg-[#FAF8F5] border-b border-[#EDE9E3] flex items-center shrink-0">
                    <div className="flex-1 flex items-center overflow-x-auto">
                      {openTabs.map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          onMouseDown={e => { if (e.button === 1) { e.preventDefault(); closeTab(tab.id); } }}
                          className={`flex items-center gap-1.5 px-3 h-full text-[13px] border-r border-[#EDE9E3] transition-colors cursor-pointer group ${
                            activeTabId === tab.id
                              ? 'bg-white text-[#2D3436]'
                              : 'text-[#6B6560] hover:bg-white/50'
                          }`}
                          style={activeTabId === tab.id ? { boxShadow: 'inset 0 -2px 0 0 #E07A5F' } : undefined}
                        >
                          {getFileIcon(tab.path)}
                          <span className="truncate max-w-[120px]">{tab.path.split('/').pop()}</span>
                          {tab.isDirty ? (
                            <div className="w-2 h-2 rounded-full bg-[#E07A5F]" />
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                              className="w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[#EDE9E3] transition-all"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </button>
                      ))}
                    </div>
                    {/* Compile button */}
                    <div className="px-2 shrink-0">
                      <button
                        onClick={handleCompile}
                        disabled={isCompiling}
                        className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-[#E07A5F] text-white text-[12px] font-medium hover:bg-[#E07A5F]/90 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {isCompiling ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        {isCompiling ? 'Compiling...' : 'Compile'}
                      </button>
                    </div>
                  </div>

                  {/* Monaco Editor */}
                  <div className="flex-1">
                    {activeFile ? (
                      <MonacoEditor
                        key={activeTabId}
                        fileId={activeFile.id}
                        path={activeFile.path}
                        defaultValue={fileContentRef.current[activeFile.id] ?? activeFile.content}
                        onChange={(value) => handleContentChange(activeFile.id, value)}
                        compileErrors={compileResult?.errors}
                      />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-[#6B6560]">
                        <Code2 className="w-12 h-12 text-[#EDE9E3] mb-4" />
                        <p className="text-sm">Select a file from the explorer to start editing</p>
                        <p className="text-xs text-[#B5B0AA] mt-1">or press ⌘+Shift+N to create a new file</p>
                      </div>
                    )}
                  </div>
                </div>
              </Panel>

              {/* Bottom Panel */}
              {showBottomPanel && (
                <>
                  <PanelResizeHandle className="h-px bg-[#EDE9E3] hover:bg-[#E07A5F] transition-colors" />
                  <Panel defaultSize={30} minSize={10} maxSize={50}>
                    <div className="h-full bg-white border-t border-[#EDE9E3] flex flex-col">
                      {/* Bottom tabs */}
                      <div className="flex items-center gap-1 px-3 h-8 border-b border-[#EDE9E3] shrink-0">
                        <BottomTab
                          label="Problems"
                          active={bottomPanelTab === 'problems'}
                          onClick={() => setBottomPanelTab('problems')}
                          badge={errorCount > 0 ? errorCount : warningCount > 0 ? warningCount : undefined}
                          badgeColor={errorCount > 0 ? '#E5484D' : '#D4A574'}
                        />
                        <BottomTab
                          label="Output"
                          active={bottomPanelTab === 'output'}
                          onClick={() => setBottomPanelTab('output')}
                        />
                        <BottomTab
                          label="Console"
                          active={bottomPanelTab === 'console'}
                          onClick={() => setBottomPanelTab('console')}
                        />
                      </div>
                      {/* Content */}
                      <div className="flex-1 overflow-y-auto p-2">
                        {bottomPanelTab === 'problems' && (
                          <div className="space-y-1">
                            {(!compileResult?.errors || compileResult.errors.length === 0) && (
                              <p className="text-xs text-[#B5B0AA] px-2 py-4 text-center">No problems detected</p>
                            )}
                            {compileResult?.errors?.map((err, i) => (
                              <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-[#F5F2ED] text-xs">
                                {err.severity === 'error' ? (
                                  <AlertCircle className="w-3.5 h-3.5 text-[#E5484D] shrink-0 mt-0.5" />
                                ) : (
                                  <AlertTriangle className="w-3.5 h-3.5 text-[#D4A574] shrink-0 mt-0.5" />
                                )}
                                <span className="text-[#2D3436] whitespace-pre-wrap break-all">{err.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {bottomPanelTab === 'output' && (
                          <pre className="text-[12px] font-mono text-[#2D3436] bg-[#FAF8F5] rounded-lg p-3 whitespace-pre-wrap">
                            {compileResult?.output || 'No output yet. Compile to see results.'}
                          </pre>
                        )}
                        {bottomPanelTab === 'console' && (
                          <pre className="text-[12px] font-mono text-[#2D3436] bg-[#FAF8F5] rounded-lg p-3 whitespace-pre-wrap">
                            {useEditorStore.getState().consoleOutput.join('\n') || 'Console is empty.'}
                          </pre>
                        )}
                      </div>
                    </div>
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {/* Right Panel */}
          {showRightPanel && (
            <>
              <PanelResizeHandle className="w-px bg-[#EDE9E3] hover:bg-[#E07A5F] transition-colors" />
              <Panel defaultSize={27} minSize={20} maxSize={40}>
                <div className="h-full bg-white border-l border-[#EDE9E3] flex flex-col">
                  {/* Segmented tabs */}
                  <div className="p-2 shrink-0">
                    <div className="flex bg-[#F5F2ED] rounded-lg p-1">
                      <button
                        onClick={() => setRightPanelTab('deploy')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          rightPanelTab === 'deploy' ? 'bg-white text-[#2D3436] shadow-sm' : 'text-[#6B6560]'
                        }`}
                      >
                        <Rocket className="w-3.5 h-3.5" />
                        Deploy
                      </button>
                      <button
                        onClick={() => setRightPanelTab('interact')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          rightPanelTab === 'interact' ? 'bg-white text-[#2D3436] shadow-sm' : 'text-[#6B6560]'
                        }`}
                      >
                        <Blocks className="w-3.5 h-3.5" />
                        Interact
                      </button>
                    </div>
                  </div>
                  {/* Panel content */}
                  <div className="flex-1 overflow-y-auto">
                    {rightPanelTab === 'deploy' && (
                      <DeployPanel
                        compileResult={compileResult}
                        isCompiling={isCompiling}
                        projectId={projectId}
                        onCompile={handleCompile}
                      />
                    )}
                    {rightPanelTab === 'interact' && (
                      <InteractPanel />
                    )}
                  </div>
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {/* ============ Status Bar (28px) ============ */}
      <div className="h-7 bg-[#F5F2ED] border-t border-[#EDE9E3] flex items-center px-3 text-[11px] shrink-0">
        <div className="flex items-center gap-3 flex-1">
          {compileResult?.success ? (
            <span className="flex items-center gap-1 text-[#5B9A6F]">
              <CheckCircle2 className="w-3 h-3" /> Compiled
            </span>
          ) : compileResult && !compileResult.success ? (
            <span className="flex items-center gap-1 text-[#E5484D]">
              <AlertCircle className="w-3 h-3" /> {errorCount} error{errorCount !== 1 ? 's' : ''}
              {warningCount > 0 && `, ${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
            </span>
          ) : (
            <span className="text-[#B5B0AA]">Ready</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[#6B6560]">
          {activeFile && <span>{activeFile.path}</span>}
          <span>solc 0.8.28</span>
          <span>UTF-8</span>
          <span>Spaces: 4</span>
        </div>
      </div>

      {/* ============ Command Palette ============ */}
      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        files={project?.files || []}
        onOpenFile={(file) => {
          openTab({ id: file.id, path: file.path, isDirty: false });
          fileContentRef.current[file.id] = fileContentRef.current[file.id] ?? file.content;
        }}
        onCompile={handleCompile}
      />
    </div>
  );
}

// ============ Bottom Tab ============
function BottomTab({
  label,
  active,
  onClick,
  badge,
  badgeColor,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  badgeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 h-full text-[11px] font-medium transition-colors cursor-pointer border-b-2 ${
        active ? 'border-[#E07A5F] text-[#2D3436]' : 'border-transparent text-[#6B6560] hover:text-[#2D3436]'
      }`}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white"
          style={{ background: badgeColor }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
