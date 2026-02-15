import {
  createContext,
  useCallback,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import type { Address, Account, Chain, HttpTransport, WalletClient } from 'viem';
import type { GatewayConnect } from '@temporium/gateway-connect';
import { getGateway } from '@/lib/gateway';

export interface GatewayContextValue {
  gateway: GatewayConnect;
  isConnected: boolean;
  address: Address | null;
  chainId: number | null;
  walletClient: WalletClient<HttpTransport, Chain, Account> | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const GatewayContext = createContext<GatewayContextValue | null>(null);

export function GatewayProvider({ children }: { children: ReactNode }) {
  const [gateway] = useState(() => getGateway());
  const [isConnected, setIsConnected] = useState(gateway.isConnected());
  const [address, setAddress] = useState<Address | null>(gateway.getAddress());
  const [chainId, setChainId] = useState<number | null>(gateway.getChainId());

  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true);
      setAddress(gateway.getAddress());
      setChainId(gateway.getChainId());
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setAddress(null);
      setChainId(null);
    };

    gateway.on('connect', handleConnect);
    gateway.on('disconnect', handleDisconnect);

    return () => {
      gateway.off('connect', handleConnect);
      gateway.off('disconnect', handleDisconnect);
    };
  }, [gateway]);

  const connect = useCallback(async () => {
    const result = await gateway.connect();
    setIsConnected(true);
    setAddress(result.address);
    setChainId(result.chainId);
  }, [gateway]);

  const disconnect = useCallback(() => {
    gateway.disconnect();
    setIsConnected(false);
    setAddress(null);
    setChainId(null);
  }, [gateway]);

  const walletClient = useMemo<WalletClient<HttpTransport, Chain, Account> | null>(() => {
    if (!isConnected) return null;
    try {
      return gateway.getWalletClient() as WalletClient<HttpTransport, Chain, Account>;
    } catch {
      return null;
    }
  }, [gateway, isConnected, address]);

  return (
    <GatewayContext.Provider
      value={{ gateway, isConnected, address, chainId, walletClient, connect, disconnect }}
    >
      {children}
    </GatewayContext.Provider>
  );
}
