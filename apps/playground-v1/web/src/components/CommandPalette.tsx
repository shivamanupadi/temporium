import { useState, useEffect, useRef, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  FileCode2,
  File,
  Play,
  FolderPlus,
  Settings,
  Rocket,
  Blocks,
  Terminal,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { ProjectFile } from '@/hooks/useProjects';

interface Command {
  id: string;
  label: string;
  icon: typeof Search;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  files: ProjectFile[];
  onOpenFile: (file: ProjectFile) => void;
  onCompile: () => void;
}

export function CommandPalette({
  open,
  onClose,
  files,
  onOpenFile,
  onCompile,
}: CommandPaletteProps): ReactElement | null {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    { id: 'compile', label: 'Compile Project', icon: Play, shortcut: '⌘⇧B', action: () => { onCompile(); onClose(); } },
    { id: 'new-file', label: 'New File', icon: FolderPlus, shortcut: '⌘⇧N', action: () => { onClose(); } },
    { id: 'toggle-explorer', label: 'Toggle File Explorer', icon: Eye, shortcut: '⌘B', action: () => { onClose(); } },
    { id: 'toggle-output', label: 'Toggle Bottom Panel', icon: Terminal, shortcut: '⌘J', action: () => { onClose(); } },
  ];

  const isCommandMode = query.startsWith('>');
  const searchQuery = isCommandMode ? query.slice(1).trim() : query.trim();

  const filteredFiles = searchQuery && !isCommandMode
    ? files.filter(f => f.path.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const filteredCommands = isCommandMode || !searchQuery
    ? commands.filter(c => c.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const items = isCommandMode
    ? filteredCommands
    : searchQuery
      ? filteredFiles.map(f => ({
          id: f.id,
          label: f.path,
          icon: f.path.endsWith('.sol') ? FileCode2 : File,
          action: () => { onOpenFile(f); onClose(); },
        }))
      : [
          ...files.slice(0, 5).map(f => ({
            id: f.id,
            label: f.path,
            icon: f.path.endsWith('.sol') ? FileCode2 : File,
            action: () => { onOpenFile(f); onClose(); },
          })),
          ...commands.slice(0, 3),
        ];

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, items.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && items[selectedIndex]) {
      items[selectedIndex].action();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          className="absolute top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg"
          onClick={e => e.stopPropagation()}
        >
          <div className="rounded-2xl bg-white shadow-2xl border border-[#EDE9E3] overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 px-4 h-12 border-b border-[#EDE9E3]">
              <Search className="w-4 h-4 text-[#B5B0AA] shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search files or type > for commands..."
                className="flex-1 text-[15px] text-[#2D3436] placeholder:text-[#B5B0AA] outline-none bg-transparent"
              />
            </div>

            {/* Results */}
            <div className="max-h-[360px] overflow-y-auto py-1">
              {items.length === 0 && (
                <p className="text-sm text-[#B5B0AA] text-center py-6">No results found</p>
              )}
              {items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => item.action()}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                      i === selectedIndex ? 'bg-[#F5F2ED]' : 'hover:bg-[#F5F2ED]/50'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-[#6B6560] shrink-0" />
                    <span className="flex-1 text-sm text-[#2D3436] truncate">{item.label}</span>
                    {'shortcut' in item && (item as Command).shortcut && (
                      <kbd className="text-[10px] font-mono text-[#B5B0AA] bg-white px-1.5 py-0.5 rounded border border-[#EDE9E3]">
                        {(item as Command).shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-[#EDE9E3] flex items-center gap-4 text-[10px] text-[#B5B0AA]">
              <span>↑↓ Navigate</span>
              <span>↵ Open</span>
              <span>esc Close</span>
              <span className="ml-auto">&gt; Commands</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
