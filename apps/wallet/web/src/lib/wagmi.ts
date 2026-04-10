import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { webAuthn, dialog } from 'accounts/wagmi';
import { Dialog } from 'accounts';
import { tempoChain } from './tempo-client';
import { createCeremony } from './ceremony';

export const tempoPasskeyConnector = webAuthn({
  ceremony: createCeremony(),
});

export const injectedConnector = injected({
  shimDisconnect: true,
});

export const tempoWalletConnector = dialog({
  rdns: 'xyz.tempo.wallet',
  name: 'Tempo Wallet',
  dialog: Dialog.popup({ size: { width: 420, height: 600 } }),
});

export const wagmiConfig = createConfig({
  chains: [tempoChain] as const,
  connectors: [tempoPasskeyConnector, injectedConnector, tempoWalletConnector],
  transports: {
    [tempoChain.id]: http(tempoChain.rpcUrls.default.http[0]),
  } as Record<number, ReturnType<typeof http>>,
});
