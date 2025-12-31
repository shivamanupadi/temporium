/**
 * Modal for creating a new project with beautiful styling and animations.
 */

import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderPlus, ArrowRight, X, Code, FileCode2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateProject } from '@/hooks/useProjects';
import { modalAnimation } from '@/lib/utils';

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectModal({
  open,
  onOpenChange,
}: CreateProjectModalProps): React.ReactElement | null {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const createProject = useCreateProject();

  useEffect(() => {
    if (open) {
      setName('');
    }
  }, [open]);

  const handleClose = (): void => {
    if (!createProject.isPending) {
      setName('');
      onOpenChange(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!name.trim() || createProject.isPending) return;

    const project = await createProject.mutateAsync({ name: name.trim() });
    setName('');
    onOpenChange(false);
    navigate({ to: '/portal/editor/$projectId', params: { projectId: project.id } });
  };

  const isValidName = name.trim().length > 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            {...modalAnimation.backdrop}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <motion.div
            {...modalAnimation.content}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[400px] z-50 px-4"
          >
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-2xl overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">New Project</h2>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={createProject.isPending}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 pb-4">
                <div className="space-y-5">
                  {/* Icon & Description */}
                  <div className="text-center py-2">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <FolderPlus className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-gray-900 mb-1">
                      Create a New Project
                    </h3>
                    <p className="text-[13px] text-gray-500">
                      Start building your Solidity smart contract
                    </p>
                  </div>

                  {/* Project Name Input */}
                  <div>
                    <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                      Project Name <span className="text-red-400">*</span>
                    </label>
                    <Input
                      placeholder="e.g., MyToken, NFTMarketplace, DeFiProtocol..."
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="text-[14px] h-12"
                      maxLength={50}
                      disabled={createProject.isPending}
                      autoFocus
                    />
                  </div>

                  {/* Features */}
                  <div className="space-y-1">
                    {[
                      { icon: FileCode2, text: 'Starts with a sample contract', color: '#7c5cff' },
                      { icon: Code, text: 'Full Solidity syntax highlighting', color: '#10b981' },
                      { icon: Sparkles, text: 'One-click compile & deploy', color: '#f59e0b' },
                    ].map(feature => (
                      <div key={feature.text} className="flex items-center gap-3 py-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${feature.color}15` }}
                        >
                          <feature.icon className="h-4 w-4" style={{ color: feature.color }} />
                        </div>
                        <span className="text-[13px] text-gray-700">{feature.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 flex gap-3 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={createProject.isPending}
                  className="flex-1 h-11"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!isValidName || createProject.isPending}
                  isLoading={createProject.isPending}
                  className="flex-1 h-11"
                >
                  <FolderPlus className="h-4 w-4" />
                  Create Project
                  {!createProject.isPending && <ArrowRight className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
