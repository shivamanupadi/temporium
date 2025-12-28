import type React from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { FileCode2, Blocks, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    label: 'Editor',
    href: '/editor',
    icon: FileCode2,
  },
  {
    label: 'Contracts',
    href: '/contracts',
    icon: Blocks,
  },
];

export function Sidebar(): React.ReactElement {
  const location = useLocation();

  return (
    <aside className="flex w-16 flex-col items-center border-r border-border bg-card py-4 lg:w-56">
      <nav className="flex flex-1 flex-col gap-1 px-2">
        {navItems.map(item => {
          const isActive = location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-2">
        <Link
          to="/editor"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Folder className="h-5 w-5 shrink-0" />
          <span className="hidden lg:inline">Projects</span>
        </Link>
      </div>
    </aside>
  );
}
