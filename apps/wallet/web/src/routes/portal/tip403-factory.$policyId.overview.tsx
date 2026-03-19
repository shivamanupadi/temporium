import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';
import { toast } from '@/lib/toast';
import {
  ShieldCheck,
  ShieldX,
  UserPlus,
  UserMinus,
  Search,
  UserCog,
  Link2,
  Unlink,
  Trash2,
  ChevronRight,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ModifyListModal,
  CheckAuthorizationModal,
  TransferAdminModal,
  LinkTokenModal,
  UnlinkTokenModal,
  RemovePolicyModal,
} from '@/components/policies';
import { usePolicy } from '@/hooks/usePolicies';
import { useTempo } from '@/hooks/useTempo';
import { formatAddress } from '@/lib/utils';

export const Route = createFileRoute('/portal/tip403-factory/$policyId/overview')({
  component: Tip403FactoryOverview,
});

type DashboardModal =
  | 'add-address'
  | 'remove-address'
  | 'transfer-admin'
  | 'check-auth'
  | 'link-token'
  | 'unlink-token'
  | 'remove'
  | null;

function Tip403FactoryOverview(): ReactElement {
  const { policyId } = Route.useParams();
  const navigate = useNavigate();
  const { address: userAddress } = useTempo();

  const { policy, isLoading, removePolicy, refresh } = usePolicy(policyId);

  const [activeModal, setActiveModal] = useState<DashboardModal>(null);
  const [copied, setCopied] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const closeModal = (): void => {
    setActiveModal(null);
  };

  const handleSuccess = (): void => {
    refresh();
  };

  const handleRemove = async (): Promise<void> => {
    if (!policy) return;
    setIsRemoving(true);
    try {
      await removePolicy(policy.id);
      toast.success('Removed from list');
      navigate({ to: '/portal/tip403-factory' });
    } finally {
      setIsRemoving(false);
    }
  };

  const copyPolicyId = async (): Promise<void> => {
    await navigator.clipboard.writeText(policyId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading || !policy) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 text-[#E07A5F] animate-spin" />
      </div>
    );
  }

  const isWhitelist = policy.type === 'whitelist';
  const isAdmin = policy.admin?.toLowerCase() === userAddress?.toLowerCase();

  return (
    <>
      {/* Two Column Layout */}
      <div className="lg:flex lg:gap-6 lg:items-stretch">
        {/* Left Column - Main Content */}
        <div className="lg:flex-[3]">
          {/* Hero Section */}
          <div
            className={`rounded-2xl overflow-hidden mb-6 ${isWhitelist ? 'bg-[#6B8F71]/5' : 'bg-coral/5'}`}
          >
            <div className="p-6">
              <div className="flex items-start gap-4 mb-5">
                {/* Icon */}
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isWhitelist ? 'bg-[#6B8F71]/8' : 'bg-coral/8'}`}
                >
                  {isWhitelist ? (
                    <ShieldCheck className="h-7 w-7 text-[#6B8F71]" />
                  ) : (
                    <ShieldX className="h-7 w-7 text-coral" />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-xl font-bold text-[#2D3436] tracking-tight">
                      Policy #{policy.policyId}
                    </h1>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${isWhitelist ? 'text-[#6B8F71] bg-[#6B8F71]/10' : 'text-coral bg-coral/10'}`}
                    >
                      {isWhitelist ? 'Whitelist' : 'Blacklist'}
                    </span>
                    {isAdmin && (
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${isWhitelist ? 'text-[#6B8F71] bg-[#6B8F71]/10' : 'text-coral bg-coral/10'}`}
                      >
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-[#9B9590] mt-1.5">
                    {isWhitelist
                      ? 'Only listed addresses can transact'
                      : 'Listed addresses are blocked'}
                  </p>

                  {/* Copyable ID */}
                  <button
                    onClick={copyPolicyId}
                    className={`mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${isWhitelist ? 'text-[#6B8F71]/70 hover:text-[#6B8F71] bg-[#6B8F71]/8 hover:bg-[#6B8F71]/12' : 'text-coral/70 hover:text-coral bg-coral/8 hover:bg-coral/12'}`}
                  >
                    ID: {policyId}
                    {copied ? (
                      <Check
                        className={`h-3 w-3 ${isWhitelist ? 'text-[#6B8F71]' : 'text-coral'}`}
                      />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={() => setActiveModal('add-address')}
                  className={`flex-1 h-11 text-[13px] font-semibold text-white shadow-lg ${isWhitelist ? 'bg-[#6B8F71] hover:bg-[#5A7D60] shadow-[#6B8F71]/15' : 'bg-[#E07A5F] hover:bg-[#D4694F] shadow-[#E07A5F]/15'}`}
                >
                  <UserPlus className="h-4 w-4 mr-2" /> Add Address
                </Button>
                <Button
                  onClick={() => setActiveModal('check-auth')}
                  variant="outline"
                  className="flex-1 h-11 text-[13px] font-medium border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                >
                  <Search className="h-4 w-4 mr-2" /> Check Address
                </Button>
              </div>
            </div>
          </div>

          {/* Policy Details Card */}
          <div className="bg-[#FDFBF8] rounded-2xl border border-[#EDE9E3] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#EDE9E3]/60">
              <h3 className="text-[13px] font-semibold text-[#2D3436]">Policy Details</h3>
            </div>

            <div className="p-5 space-y-0">
              <div className="flex justify-between items-center py-2.5">
                <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                  Policy ID
                </span>
                <span className="text-[13px] font-medium font-mono text-[#2D3436]">
                  {policy.policyId}
                </span>
              </div>
              <div className="h-px bg-[#EDE9E3]/50" />
              <div className="flex justify-between items-center py-2.5">
                <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                  Type
                </span>
                <span className="text-[13px] font-medium text-[#2D3436]">
                  {isWhitelist ? 'Whitelist' : 'Blacklist'}
                </span>
              </div>
              <div className="h-px bg-[#EDE9E3]/50" />
              <div className="flex justify-between items-center py-2.5">
                <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                  Admin
                </span>
                <span className="text-[13px] font-medium font-mono text-[#2D3436]">
                  {formatAddress(policy.admin, 8)}
                </span>
              </div>
              <div className="h-px bg-[#EDE9E3]/50" />
              <div className="flex justify-between items-center py-2.5">
                <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                  Your Role
                </span>
                <span className="text-[11px] font-medium text-[#2D3436] bg-[#F5F2ED] px-2.5 py-0.5 rounded-full">
                  {isAdmin ? 'Admin' : 'Viewer'}
                </span>
              </div>
              <div className="h-px bg-[#EDE9E3]/50" />
              <div className="flex justify-between items-center py-2.5">
                <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                  Tx Hash
                </span>
                {policy.txHash ? (
                  <span className="text-[13px] font-medium font-mono text-[#2D3436]">
                    {policy.txHash.slice(0, 10)}...{policy.txHash.slice(-4)}
                  </span>
                ) : (
                  <span className="text-[11px] text-[#B5B0AA]">Imported policy</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Settings */}
        <div className="lg:flex-[2] mt-6 lg:mt-0">
          <div className="bg-white rounded-2xl border border-[#EDE9E3]/80 overflow-hidden h-full shadow-sm">
            <div className="px-5 py-4 border-b border-[#EDE9E3]/50">
              <h2 className="text-[13px] font-semibold text-[#2D3436] tracking-wide uppercase">
                Settings
              </h2>
            </div>

            {/* Address Management */}
            <div className="px-4 pt-4 pb-1">
              <p className="text-[10px] font-semibold text-[#B5B0AA] uppercase tracking-widest px-1 mb-1">
                Address Management
              </p>
            </div>
            <SettingsRow
              icon={<UserPlus className="h-4 w-4 text-[#6B6560]" />}
              title={isWhitelist ? 'Add to Whitelist' : 'Add to Blacklist'}
              description={
                isWhitelist ? 'Allow an address to transact' : 'Block an address from transacting'
              }
              onClick={() => setActiveModal('add-address')}
            />
            <SettingsRow
              icon={<UserMinus className="h-4 w-4 text-[#6B6560]" />}
              title={isWhitelist ? 'Remove from Whitelist' : 'Remove from Blacklist'}
              description={isWhitelist ? 'Revoke transfer permission' : 'Unblock an address'}
              onClick={() => setActiveModal('remove-address')}
            />
            <SettingsRow
              icon={<Search className="h-4 w-4 text-[#6B6560]" />}
              title="Check Authorization"
              description="Check if an address is authorized"
              onClick={() => setActiveModal('check-auth')}
              isLast
            />

            {/* Policy Management */}
            <div className="px-4 pt-4 pb-1 border-t border-[#EDE9E3]/50">
              <p className="text-[10px] font-semibold text-[#B5B0AA] uppercase tracking-widest px-1 mb-1">
                Policy Management
              </p>
            </div>
            <SettingsRow
              icon={<UserCog className="h-4 w-4 text-[#6B6560]" />}
              title="Transfer Admin"
              description="Transfer admin rights to another address"
              onClick={() => setActiveModal('transfer-admin')}
            />
            <SettingsRow
              icon={<Link2 className="h-4 w-4 text-[#6B6560]" />}
              title="Link to Token"
              description="Attach this policy to a TIP20 token"
              onClick={() => setActiveModal('link-token')}
            />
            <SettingsRow
              icon={<Unlink className="h-4 w-4 text-[#6B6560]" />}
              title="Unlink from Token"
              description="Detach this policy from a token"
              onClick={() => setActiveModal('unlink-token')}
              isLast
            />

            {/* Danger Zone */}
            <div className="px-4 pt-4 pb-1 border-t border-[#EDE9E3]/50">
              <p className="text-[10px] font-semibold text-coral/60 uppercase tracking-widest px-1 mb-1">
                Danger Zone
              </p>
            </div>
            <SettingsRow
              icon={<Trash2 className="h-4 w-4 text-coral" />}
              title="Remove from List"
              description="Remove from your local storage only"
              onClick={() => setActiveModal('remove')}
              variant="danger"
              isLast
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <ModifyListModal
        isOpen={activeModal === 'add-address'}
        mode="add"
        policyType={policy.type}
        policyId={BigInt(policy.policyId)}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <ModifyListModal
        isOpen={activeModal === 'remove-address'}
        mode="remove"
        policyType={policy.type}
        policyId={BigInt(policy.policyId)}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <TransferAdminModal
        isOpen={activeModal === 'transfer-admin'}
        policyId={BigInt(policy.policyId)}
        policyType={policy.type}
        currentAdmin={policy.admin}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <CheckAuthorizationModal
        isOpen={activeModal === 'check-auth'}
        policyId={BigInt(policy.policyId)}
        policyType={policy.type}
        onClose={closeModal}
      />

      <LinkTokenModal
        isOpen={activeModal === 'link-token'}
        policyId={BigInt(policy.policyId)}
        policyType={policy.type}
        policyAdmin={policy.admin}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <UnlinkTokenModal
        isOpen={activeModal === 'unlink-token'}
        policyId={BigInt(policy.policyId)}
        policyType={policy.type}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <RemovePolicyModal
        isOpen={activeModal === 'remove'}
        isLoading={isRemoving}
        onConfirm={handleRemove}
        onCancel={closeModal}
      />
    </>
  );
}

interface SettingsRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  isLast?: boolean;
}

function SettingsRow({
  icon,
  title,
  description,
  onClick,
  variant = 'default',
  isLast = false,
}: SettingsRowProps): ReactElement {
  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center justify-between px-5 py-3 transition-all cursor-pointer ${
        variant === 'danger' ? 'hover:bg-coral/4' : 'hover:bg-[#F5F2ED]/50'
      } ${!isLast ? 'border-b border-[#EDE9E3]/30' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            variant === 'danger' ? 'bg-coral/6' : 'bg-[#F5F2ED]'
          }`}
        >
          {icon}
        </div>
        <div className="text-left">
          <p
            className={`text-[13px] font-medium leading-tight ${variant === 'danger' ? 'text-coral' : 'text-[#2D3436]'}`}
          >
            {title}
          </p>
          <p className="text-[11px] text-[#B5B0AA] leading-tight mt-0.5">{description}</p>
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-[#D1CCC7] group-hover:text-[#9B9590] transition-colors" />
    </button>
  );
}
