import { type ReactElement } from 'react';
import { createFileRoute, Link, Outlet, useLocation, redirect } from '@tanstack/react-router';
import { DollarSign, Coins } from 'lucide-react';
import { useCustomTokens } from '@/hooks/useCustomTokens';

export const Route = createFileRoute('/portal/settings')({
  beforeLoad: ({ location }) => {
    if (location.pathname === '/portal/settings' || location.pathname === '/portal/settings/') {
      throw redirect({ to: '/portal/settings/fee-token' });
    }
  },
  component: SettingsLayout,
});

function SettingsLayout(): ReactElement {
  const location = useLocation();
  const { customTokens } = useCustomTokens();
  const isCustomTokens = location.pathname.endsWith('/custom-tokens');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Settings</h1>
        <p className="text-[14px] text-[#6B6560] mt-1">
          Manage your account preferences and custom tokens
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#F5F2ED] rounded-lg">
        <Link
          to="/portal/settings/fee-token"
          className={`px-4 py-2 text-[13px] font-medium rounded-md transition-colors flex items-center ${
            !isCustomTokens
              ? 'bg-white text-[#2D3436] shadow-sm'
              : 'text-[#9B9590] hover:text-[#6B6560]'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 mr-1.5" />
          Fee Token
        </Link>
        <Link
          to="/portal/settings/custom-tokens"
          className={`px-4 py-2 text-[13px] font-medium rounded-md transition-colors flex items-center ${
            isCustomTokens
              ? 'bg-white text-[#2D3436] shadow-sm'
              : 'text-[#9B9590] hover:text-[#6B6560]'
          }`}
        >
          <Coins className="w-3.5 h-3.5 mr-1.5" />
          Custom Tokens
          {customTokens.length > 0 && (
            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[#E07A5F]/10 text-[#E07A5F] font-semibold">
              {customTokens.length}
            </span>
          )}
        </Link>
      </div>

      {/* Child Routes */}
      <Outlet />
    </div>
  );
}
