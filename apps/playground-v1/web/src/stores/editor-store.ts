import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CompileResult } from '@/hooks/useCompiler';

export interface EditorTab {
  id: string; // fileId
  path: string;
  isDirty: boolean;
}

interface PanelSizes {
  explorer: number;
  rightPanel: number;
  bottomPanel: number;
}

interface EditorState {
  // Tabs
  openTabs: EditorTab[];
  activeTabId: string | null;

  // Panels
  showExplorer: boolean;
  showRightPanel: boolean;
  showBottomPanel: boolean;
  rightPanelTab: 'deploy' | 'interact';
  bottomPanelTab: 'problems' | 'output' | 'console';
  panelSizes: PanelSizes;

  // Compile
  compileResult: CompileResult | null;
  consoleOutput: string[];

  // Actions
  openTab: (tab: EditorTab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  markDirty: (id: string, dirty: boolean) => void;
  toggleExplorer: () => void;
  toggleRightPanel: () => void;
  toggleBottomPanel: () => void;
  setRightPanelTab: (tab: 'deploy' | 'interact') => void;
  setBottomPanelTab: (tab: 'problems' | 'output' | 'console') => void;
  setPanelSizes: (sizes: Partial<PanelSizes>) => void;
  setCompileResult: (result: CompileResult | null) => void;
  addConsoleOutput: (line: string) => void;
  clearConsole: () => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      openTabs: [],
      activeTabId: null,

      showExplorer: true,
      showRightPanel: true,
      showBottomPanel: true,
      rightPanelTab: 'deploy',
      bottomPanelTab: 'problems',
      panelSizes: {
        explorer: 220,
        rightPanel: 320,
        bottomPanel: 200,
      },

      compileResult: null,
      consoleOutput: [],

      openTab: (tab) => {
        const { openTabs } = get();
        const exists = openTabs.find(t => t.id === tab.id);
        if (!exists) {
          set({ openTabs: [...openTabs, tab], activeTabId: tab.id });
        } else {
          set({ activeTabId: tab.id });
        }
      },

      closeTab: (id) => {
        const { openTabs, activeTabId } = get();
        const filtered = openTabs.filter(t => t.id !== id);
        let nextActive = activeTabId;
        if (activeTabId === id) {
          const idx = openTabs.findIndex(t => t.id === id);
          nextActive = filtered[Math.min(idx, filtered.length - 1)]?.id ?? null;
        }
        set({ openTabs: filtered, activeTabId: nextActive });
      },

      setActiveTab: (id) => set({ activeTabId: id }),

      markDirty: (id, dirty) => {
        const { openTabs } = get();
        set({
          openTabs: openTabs.map(t => (t.id === id ? { ...t, isDirty: dirty } : t)),
        });
      },

      toggleExplorer: () => set(s => ({ showExplorer: !s.showExplorer })),
      toggleRightPanel: () => set(s => ({ showRightPanel: !s.showRightPanel })),
      toggleBottomPanel: () => set(s => ({ showBottomPanel: !s.showBottomPanel })),
      setRightPanelTab: (tab) => set({ rightPanelTab: tab, showRightPanel: true }),
      setBottomPanelTab: (tab) => set({ bottomPanelTab: tab, showBottomPanel: true }),
      setPanelSizes: (sizes) =>
        set(s => ({ panelSizes: { ...s.panelSizes, ...sizes } })),

      setCompileResult: (result) => set({ compileResult: result }),
      addConsoleOutput: (line) =>
        set(s => ({ consoleOutput: [...s.consoleOutput, line] })),
      clearConsole: () => set({ consoleOutput: [] }),
    }),
    {
      name: 'playground-editor-store',
      partialize: (state) => ({
        showExplorer: state.showExplorer,
        showRightPanel: state.showRightPanel,
        showBottomPanel: state.showBottomPanel,
        rightPanelTab: state.rightPanelTab,
        bottomPanelTab: state.bottomPanelTab,
        panelSizes: state.panelSizes,
      }),
    }
  )
);
