import { type ReactElement, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import * as Tabs from '@radix-ui/react-tabs';
import {
  Wifi,
  PenTool,
  Send,
  Coins,
  ArrowRightLeft,
  Droplets,
  Gift,
} from 'lucide-react';
import { useGateway } from '@/hooks/useGateway';
import { ConnectionPanel } from '@/components/panels/ConnectionPanel';
import { SigningPanel } from '@/components/panels/SigningPanel';
import { PaymentsPanel } from '@/components/panels/PaymentsPanel';
import { TokenMgmtPanel } from '@/components/panels/TokenMgmtPanel';
import { DexPanel } from '@/components/panels/DexPanel';
import { AmmPanel } from '@/components/panels/AmmPanel';
import { RewardsPanel } from '@/components/panels/RewardsPanel';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

const TABS = [
  { id: 'connection', label: 'Connection', icon: Wifi, requiresAuth: false },
  { id: 'signing', label: 'Signing', icon: PenTool, requiresAuth: true },
  { id: 'payments', label: 'Payments', icon: Send, requiresAuth: true },
  { id: 'tokens', label: 'Token Mgmt', icon: Coins, requiresAuth: true },
  { id: 'dex', label: 'DEX', icon: ArrowRightLeft, requiresAuth: true },
  { id: 'amm', label: 'AMM', icon: Droplets, requiresAuth: true },
  { id: 'rewards', label: 'Rewards', icon: Gift, requiresAuth: true },
] as const;

function IndexPage(): ReactElement {
  const { isConnected } = useGateway();
  const [activeTab, setActiveTab] = useState('connection');

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="flex gap-1 p-1 bg-white rounded-2xl border border-[#EDE9E3] mb-6 overflow-x-auto">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const disabled = tab.requiresAuth && !isConnected;
            return (
              <Tabs.Trigger
                key={tab.id}
                value={tab.id}
                disabled={disabled}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all whitespace-nowrap',
                  'data-[state=active]:bg-[#E07A5F] data-[state=active]:text-white data-[state=active]:shadow-sm',
                  'data-[state=inactive]:text-[#9B9590] data-[state=inactive]:hover:bg-[#F5F2ED]',
                  disabled && 'opacity-40 cursor-not-allowed'
                )}
              >
                <TabIcon className="w-3.5 h-3.5" />
                {tab.label}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>

        <div className="bg-white rounded-2xl border border-[#EDE9E3] p-6">
          <Tabs.Content value="connection">
            <ConnectionPanel />
          </Tabs.Content>
          <Tabs.Content value="signing">
            <SigningPanel />
          </Tabs.Content>
          <Tabs.Content value="payments">
            <PaymentsPanel />
          </Tabs.Content>
          <Tabs.Content value="tokens">
            <TokenMgmtPanel />
          </Tabs.Content>
          <Tabs.Content value="dex">
            <DexPanel />
          </Tabs.Content>
          <Tabs.Content value="amm">
            <AmmPanel />
          </Tabs.Content>
          <Tabs.Content value="rewards">
            <RewardsPanel />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </main>
  );
}
