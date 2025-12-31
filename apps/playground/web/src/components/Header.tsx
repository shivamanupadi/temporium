import type React from 'react';
import { useState } from 'react';
import { Zap } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { WalletButton } from './WalletButton';
import { ProjectSwitcher } from './ProjectSwitcher';
import { CreateProjectModal } from './projects/CreateProjectModal';

export function Header(): React.ReactElement {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex h-14 items-center justify-between px-4">
          {/* Left side - Logo and Project Switcher */}
          <div className="flex items-center gap-1">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 mr-2">
              <Zap className="w-6 h-6 text-slate-900" strokeWidth={2} />
              <span className="font-bold text-foreground">
                Temporium
                <span className="text-muted-foreground font-normal hidden sm:inline">
                  {' '}
                  | Playground
                </span>
              </span>
            </Link>

            {/* Separator */}
            <div className="h-6 w-px bg-border mx-2 hidden sm:block" />

            {/* Project Switcher */}
            <div className="hidden sm:block">
              <ProjectSwitcher onNewProject={() => setShowCreateModal(true)} />
            </div>
          </div>

          {/* Right side - Wallet */}
          <div className="flex items-center gap-4">
            <WalletButton />
          </div>
        </div>
      </header>

      <CreateProjectModal open={showCreateModal} onOpenChange={setShowCreateModal} />
    </>
  );
}
