import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Shield,
  UserPlus,
  UserMinus,
  UserCog,
  Search,
  Link2,
  Unlink,
  Trash2,
  ChevronRight,
  Loader2,
  Copy,
  Check,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ModifyListModal,
  TransferAdminModal,
  CheckAuthorizationModal,
  LinkTokenModal,
  UnlinkTokenModal,
  RemovePolicyModal,
} from '@/components/policies';
import { usePolicy } from '@/hooks/usePolicies';
import { formatAddress } from '@/lib/utils';

export const Route = createFileRoute('/portal/tip403-factory/$policyId')({
  component: Tip403FactoryDashboard,
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

function Tip403FactoryDashboard(): ReactElement {
  const { policyId } = Route.useParams();
  const navigate = useNavigate();

  const { policy, isLoading, removePolicy, refresh } = usePolicy(policyId);

  // Modal state
  const [activeModal, setActiveModal] = useState<DashboardModal>(null);

  // Copy state
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

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => navigate({ to: '/portal/tip403-factory' })}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <h1 className="text-[15px] font-medium text-foreground">Loading...</h1>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  // Not found state
  if (!policy) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => navigate({ to: '/portal/tip403-factory' })}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <h1 className="text-[15px] font-medium text-foreground">TIP403 Factory</h1>
        </div>
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Policy Not Found</h2>
          <p className="text-muted-foreground mb-4">This policy is not in your list</p>
          <Button onClick={() => navigate({ to: '/portal/tip403-factory' })}>
            Back to TIP403 Factory
          </Button>
        </div>
      </div>
    );
  }

  const isWhitelist = policy.type === 'whitelist';
  const policyBigInt = BigInt(policy.policyId);

  return (
    <div className="max-w-5xl mx-auto -mt-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => navigate({ to: '/portal/tip403-factory' })}
          className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-medium text-foreground">TIP403 Factory</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-[12px] text-muted-foreground font-mono">Policy #{policyId}</span>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="lg:flex lg:gap-6 lg:items-stretch">
        {/* Left Column - Main Content */}
        <div className="lg:flex-[3]">
          {/* Hero Section */}
          <div
            className={`rounded-2xl p-6 mb-6 ${
              isWhitelist
                ? 'bg-gradient-to-br from-emerald-500/5 via-emerald-500/10 to-emerald-500/5'
                : 'bg-gradient-to-br from-rose-500/5 via-rose-500/10 to-rose-500/5'
            }`}
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-2xl shadow-sm flex items-center justify-center ${
                    isWhitelist ? 'bg-emerald-50' : 'bg-rose-50'
                  }`}
                >
                  {isWhitelist ? (
                    <ShieldCheck className="h-8 w-8 text-emerald-600" />
                  ) : (
                    <ShieldX className="h-8 w-8 text-rose-600" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-foreground">
                      Policy #{policy.policyId}
                    </h1>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        isWhitelist
                          ? 'text-emerald-600 bg-emerald-100'
                          : 'text-rose-600 bg-rose-100'
                      }`}
                    >
                      {isWhitelist ? 'Whitelist' : 'Blacklist'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">
                      {isWhitelist
                        ? 'Only listed addresses can transact'
                        : 'Listed addresses are blocked'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={copyPolicyId}
                      className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground font-mono transition-colors"
                    >
                      Policy ID: {policyId}
                      {copied ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={() => setActiveModal('add-address')}
                className={`flex-1 h-11 ${isWhitelist ? 'bg-emerald-600 hover:bg-emerald-700 shadow-[0_1px_2px_0_rgba(0,0,0,0.05),0_0_0_1px_rgba(5,150,105,1)] hover:shadow-[0_3px_8px_0_rgba(5,150,105,0.25),0_0_0_1px_rgba(5,150,105,1)]' : 'bg-rose-600 hover:bg-rose-700 shadow-[0_1px_2px_0_rgba(0,0,0,0.05),0_0_0_1px_rgba(225,29,72,1)] hover:shadow-[0_3px_8px_0_rgba(225,29,72,0.25),0_0_0_1px_rgba(225,29,72,1)]'}`}
              >
                <UserPlus className="h-4 w-4 mr-2" /> Add Address
              </Button>
              <Button
                onClick={() => setActiveModal('check-auth')}
                variant="outline"
                className={`flex-1 h-11 bg-white ${isWhitelist ? 'border-emerald-300 hover:border-emerald-400 shadow-[0_1px_2px_0_rgba(0,0,0,0.04),0_0_0_1px_rgba(167,243,208,0.5)] hover:shadow-[0_3px_8px_0_rgba(5,150,105,0.1),0_0_0_1px_rgba(110,231,183,0.6)]' : 'border-rose-300 hover:border-rose-400 shadow-[0_1px_2px_0_rgba(0,0,0,0.04),0_0_0_1px_rgba(254,205,211,0.5)] hover:shadow-[0_3px_8px_0_rgba(225,29,72,0.1),0_0_0_1px_rgba(253,164,175,0.6)]'}`}
              >
                <Search className="h-4 w-4 mr-2" /> Check Address
              </Button>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-white rounded-xl p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] mb-6">
            <h3 className="text-[13px] font-semibold text-foreground mb-3">Policy Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-muted-foreground">Policy ID</span>
                <span className="text-[12px] font-mono text-foreground">{policy.policyId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-muted-foreground">Type</span>
                <span
                  className={`text-[12px] font-medium ${isWhitelist ? 'text-emerald-600' : 'text-rose-600'}`}
                >
                  {isWhitelist ? 'Whitelist' : 'Blacklist'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-muted-foreground">Admin</span>
                <span className="text-[12px] font-mono text-foreground">
                  {formatAddress(policy.admin, 8)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-muted-foreground">Your Role</span>
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    policy.isAdmin
                      ? 'text-purple-600 bg-purple-100'
                      : 'text-muted-foreground bg-muted'
                  }`}
                >
                  {policy.isAdmin ? 'Admin' : 'Viewer'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Settings */}
        <div className="lg:flex-[2] mt-6 lg:mt-0">
          {/* Policy Settings */}
          <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] overflow-hidden h-full">
            <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.05)]">
              <h2 className="text-[13px] font-semibold text-foreground">Policy Settings</h2>
            </div>
            <SettingsRow
              icon={
                <UserPlus
                  className={`h-4 w-4 ${isWhitelist ? 'text-emerald-500' : 'text-rose-500'}`}
                />
              }
              title={isWhitelist ? 'Add to Whitelist' : 'Add to Blacklist'}
              description={
                isWhitelist ? 'Allow an address to transact' : 'Block an address from transacting'
              }
              onClick={() => setActiveModal('add-address')}
            />
            <SettingsRow
              icon={
                <UserMinus
                  className={`h-4 w-4 ${isWhitelist ? 'text-rose-500' : 'text-emerald-500'}`}
                />
              }
              title={isWhitelist ? 'Remove from Whitelist' : 'Remove from Blacklist'}
              description={isWhitelist ? 'Revoke transaction access' : 'Unblock an address'}
              onClick={() => setActiveModal('remove-address')}
            />
            <SettingsRow
              icon={<Search className="h-4 w-4 text-blue-500" />}
              title="Check Authorization"
              description="Check if an address is authorized"
              onClick={() => setActiveModal('check-auth')}
            />
            <SettingsRow
              icon={<UserCog className="h-4 w-4 text-purple-500" />}
              title="Transfer Admin"
              description="Transfer policy ownership"
              onClick={() => setActiveModal('transfer-admin')}
            />
            <SettingsRow
              icon={<Link2 className="h-4 w-4 text-primary" />}
              title="Link to Token"
              description="Apply this policy to a TIP20 token"
              onClick={() => setActiveModal('link-token')}
            />
            <SettingsRow
              icon={<Unlink className="h-4 w-4 text-orange-500" />}
              title="Unlink from Token"
              description="Remove this policy from a TIP20 token"
              onClick={() => setActiveModal('unlink-token')}
            />
            <SettingsRow
              icon={<Trash2 className="h-4 w-4 text-red-500" />}
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
        policyId={policyBigInt}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <ModifyListModal
        isOpen={activeModal === 'remove-address'}
        mode="remove"
        policyType={policy.type}
        policyId={policyBigInt}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <TransferAdminModal
        isOpen={activeModal === 'transfer-admin'}
        policyId={policyBigInt}
        currentAdmin={policy.admin}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <CheckAuthorizationModal
        isOpen={activeModal === 'check-auth'}
        policyId={policyBigInt}
        policyType={policy.type}
        onClose={closeModal}
      />

      <LinkTokenModal
        isOpen={activeModal === 'link-token'}
        policyId={policyBigInt}
        policyType={policy.type}
        policyAdmin={policy.admin}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <UnlinkTokenModal
        isOpen={activeModal === 'unlink-token'}
        policyId={policyBigInt}
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
    </div>
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
      className={`w-full flex items-center justify-between p-4 transition-colors ${
        variant === 'danger' ? 'hover:bg-red-50' : 'hover:bg-muted/50'
      } ${!isLast ? 'border-b border-[rgba(0,0,0,0.03)]' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            variant === 'danger' ? 'bg-red-50' : 'bg-primary/10'
          }`}
        >
          {icon}
        </div>
        <div className="text-left">
          <p
            className={`text-[13px] font-medium ${variant === 'danger' ? 'text-red-600' : 'text-foreground'}`}
          >
            {title}
          </p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
