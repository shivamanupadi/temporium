import type React from 'react';
import { Code2 } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { WalletButton } from './WalletButton';
import { LINKS } from '@/lib/constants';

export function Header(): React.ReactElement {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <Code2 className="h-5 w-5 text-primary" />
          <span className="font-semibold">Tempo Playground</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <nav className="hidden items-center gap-4 sm:flex">
            <a
              href={LINKS.docs}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Docs
            </a>
            <a
              href={LINKS.gateway}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Gateway
            </a>
          </nav>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
