export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const TEMPLATES: Template[] = [
  { id: 'blank', name: 'Blank Project', description: 'Empty project with a single Solidity file', icon: 'file' },
  { id: 'simple-storage', name: 'Simple Storage', description: 'Basic storage contract with get/set functions', icon: 'database' },
  { id: 'erc20', name: 'ERC-20 Token', description: 'Standard ERC-20 token with mint and burn', icon: 'coins' },
  { id: 'erc721', name: 'ERC-721 NFT', description: 'Standard NFT collection contract', icon: 'image' },
  { id: 'multisig', name: 'Multi-Sig Wallet', description: 'Multi-signature wallet with configurable owners', icon: 'shield' },
];
