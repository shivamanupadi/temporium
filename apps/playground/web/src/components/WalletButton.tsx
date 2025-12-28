import type React from 'react';
import { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Hooks } from 'tempo.ts/wagmi';
import {
  Wallet,
  LogOut,
  ChevronDown,
  Key,
  Fingerprint,
  Copy,
  Check,
  Droplets,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatAddress } from '@/lib/utils';
import { tempoPasskeyConnector, injectedConnector } from '@/lib/wagmi';
import { toast } from 'sonner';

export function WalletButton(): React.ReactElement {
  const { address, isConnected, connector } = useAccount();
  const { connectAsync, isPending } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const [isConnecting, setIsConnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Faucet mutation from tempo.ts/wagmi
  const { mutate: fundFromFaucet, isPending: isFunding } = Hooks.faucet.useFundSync({
    mutation: {
      onSuccess: () => {
        toast.success('Tokens received!');
      },
      onError: err => {
        console.error('Faucet error:', err);
        toast.error('Failed to get tokens. Try again later.');
      },
    },
  });

  const handleSignUp = async (): Promise<void> => {
    try {
      setIsConnecting(true);
      await connectAsync({
        connector: tempoPasskeyConnector,
        capabilities: { type: 'sign-up', label: 'Tempo Playground' },
      });
      toast.success('Wallet created!');
    } catch (error) {
      console.error('Passkey sign up failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSignIn = async (): Promise<void> => {
    try {
      setIsConnecting(true);
      await connectAsync({
        connector: tempoPasskeyConnector,
        capabilities: { type: 'sign-in', selectAccount: true },
      });
      toast.success('Connected!');
    } catch (error) {
      console.error('Passkey sign in failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sign in');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleInjectedConnect = async (): Promise<void> => {
    try {
      setIsConnecting(true);
      await connectAsync({ connector: injectedConnector });
      toast.success('Connected!');
    } catch (error) {
      console.error('Injected connection failed:', error);
      toast.error(error instanceof Error ? error.message : 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    try {
      await disconnectAsync();
      toast.success('Disconnected');
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  const handleCopyAddress = async (): Promise<void> => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success('Address copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
      toast.error('Failed to copy address');
    }
  };

  const handleFaucet = (): void => {
    if (!address || isFunding) return;
    fundFromFaucet({ account: address });
  };

  if (isConnected && address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">{formatAddress(address)}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {connector?.name || 'Connected'}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCopyAddress}>
            {copied ? (
              <Check className="mr-2 h-4 w-4 text-green-500" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Copy Address
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleFaucet} disabled={isFunding}>
            {isFunding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Droplets className="mr-2 h-4 w-4" />
            )}
            {isFunding ? 'Getting tokens...' : 'Get Test Tokens'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDisconnect} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" className="gap-2" disabled={isPending || isConnecting}>
          <Wallet className="h-4 w-4" />
          <span>{isConnecting ? 'Connecting...' : 'Connect'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleSignUp}>
          <Key className="mr-2 h-4 w-4" />
          Create Passkey Wallet
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignIn}>
          <Fingerprint className="mr-2 h-4 w-4" />
          Sign in with Passkey
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleInjectedConnect}>
          <Wallet className="mr-2 h-4 w-4" />
          MetaMask / Browser Wallet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
