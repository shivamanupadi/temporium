#!/bin/bash
set -e

# Network configuration
TESTNET_RPC_URL="https://rpc.moderato.tempo.xyz"
TESTNET_CHAIN_ID=42431
MAINNET_RPC_URL="https://rpc.tempo.xyz"
MAINNET_CHAIN_ID=4217
FEE_TOKEN="0x20c0000000000000000000000000000000000000"  # pathUSD (chain default)

# File paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATEWAY_ROOT="$(dirname "$SCRIPT_DIR")"
DEV_VARS_FILE="$GATEWAY_ROOT/api/.dev.vars"

# Parse flags
DEPLOY_TARGET=""
NETWORK=""
OP_ITEM=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --local|-l)
            DEPLOY_TARGET="local"
            shift
            ;;
        --dev|-d)
            DEPLOY_TARGET="dev"
            shift
            ;;
        --deploy)
            DEPLOY_TARGET="deploy"
            shift
            ;;
        --testnet|-t)
            NETWORK="testnet"
            shift
            ;;
        --mainnet|-m)
            NETWORK="mainnet"
            shift
            ;;
        --help|-h)
            echo "Usage: ./deploy-passkey-registry-contract.sh <--local|-l|--dev|-d|--deploy> <--testnet|-t|--mainnet|-m>"
            echo ""
            echo "Deploys PasskeyRegistry to Tempo and updates contract address"
            echo "+ relayer key in the chosen layer."
            echo ""
            echo "Target (required):"
            echo "  --local, -l     Write to .dev.vars (personal override, not"
            echo "                  synced anywhere — visible only on this machine)"
            echo "  --dev, -d       Push to Doppler dev config (visible to the"
            echo "                  whole team via yarn dev)"
            echo "  --deploy        Push to Doppler prd config, then sync"
            echo "                  Doppler → Cloudflare Worker secrets (production)"
            echo ""
            echo "Network (required):"
            echo "  --testnet, -t   Deploy to Tempo Testnet (Moderato)"
            echo "  --mainnet, -m   Deploy to Tempo Mainnet"
            echo ""
            echo "Examples:"
            echo "  ./deploy-passkey-registry-contract.sh --local --testnet     # Just my laptop"
            echo "  ./deploy-passkey-registry-contract.sh --dev --testnet       # Team dev env"
            echo "  ./deploy-passkey-registry-contract.sh --deploy --testnet    # Production testnet deploy"
            echo "  ./deploy-passkey-registry-contract.sh --deploy --mainnet    # Production mainnet deploy"
            echo ""
            echo "Worker deploy (after contract deploy):"
            echo "  cd apps/wallet/api && yarn worker:prod:deploy"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

# Select 1Password item based on deploy target.
# local + dev use the development wallet; deploy uses the production wallet.
if [ "$DEPLOY_TARGET" = "local" ] || [ "$DEPLOY_TARGET" = "dev" ]; then
    OP_ITEM="Temporium Wallet Contract Owner Development"
elif [ "$DEPLOY_TARGET" = "deploy" ]; then
    OP_ITEM="Temporium Wallet Contract Owner Production"
fi

# Require both flags
if [ -z "$DEPLOY_TARGET" ] || [ -z "$NETWORK" ]; then
    echo "Error: You must specify both target and network"
    echo ""
    echo "Usage: ./deploy-passkey-registry-contract.sh <--local|-l|--dev|-d|--deploy> <--testnet|-t|--mainnet|-m>"
    echo ""
    echo "Examples:"
    echo "  ./deploy-passkey-registry-contract.sh --local --testnet"
    echo "  ./deploy-passkey-registry-contract.sh --dev --testnet"
    echo "  ./deploy-passkey-registry-contract.sh --deploy --testnet"
    echo "  ./deploy-passkey-registry-contract.sh --deploy --mainnet"
    exit 1
fi

# Set RPC URL and chain ID based on network
if [ "$NETWORK" = "testnet" ]; then
    RPC_URL="$TESTNET_RPC_URL"
    CHAIN_ID="$TESTNET_CHAIN_ID"
    NETWORK_LABEL="Testnet (Moderato)"
else
    RPC_URL="$MAINNET_RPC_URL"
    CHAIN_ID="$MAINNET_CHAIN_ID"
    NETWORK_LABEL="Mainnet"
fi

echo "=== PasskeyRegistry Deployment (Gateway v1) ==="
echo "Network: $NETWORK_LABEL (Chain ID: $CHAIN_ID)"
echo "Target: $DEPLOY_TARGET"
echo "1Password item: $OP_ITEM"
echo ""

# Fetch credentials from 1Password
echo "Fetching credentials from 1Password..."
DEPLOYER_ADDRESS=$(op item get "$OP_ITEM" --fields label=username --reveal)
PRIVATE_KEY=$(op item get "$OP_ITEM" --fields label=password --reveal)

if [ -z "$PRIVATE_KEY" ]; then
    echo "Error: Failed to fetch private key from 1Password"
    exit 1
fi

# Ensure private key has 0x prefix
if [[ ! "$PRIVATE_KEY" =~ ^0x ]]; then
    PRIVATE_KEY="0x$PRIVATE_KEY"
fi

echo "Deployer: $DEPLOYER_ADDRESS"
echo ""

# Check balance before deployment
echo "Checking deployer balance..."
BALANCE=$(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
echo "Balance: $BALANCE wei"
echo ""

# Deploy the contract using forge create (works reliably on Tempo)
echo "Deploying PasskeyRegistry..."
cd "$SCRIPT_DIR"
DEPLOY_LOG=$(mktemp)
forge create src/PasskeyRegistry.sol:PasskeyRegistry \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --tempo.fee-token "$FEE_TOKEN" \
    --broadcast 2>&1 | tee "$DEPLOY_LOG"

# Extract contract address from output
CONTRACT_ADDRESS=$(grep -oE "Deployed to: 0x[a-fA-F0-9]{40}" "$DEPLOY_LOG" | cut -d' ' -f3)
rm -f "$DEPLOY_LOG"

if [ -z "$CONTRACT_ADDRESS" ]; then
    echo ""
    echo "Error: Could not extract contract address from deployment output"
    exit 1
fi

echo ""
echo "=== Deployment Complete ==="
echo "Contract Address: $CONTRACT_ADDRESS"

# Route the new contract address + relayer key to the chosen layer:
#   local  → .dev.vars (personal override, not synced anywhere)
#   dev    → Doppler dev config (team-shared)
#   deploy → Doppler prd config + sync to Cloudflare Worker secrets
if [ "$DEPLOY_TARGET" = "local" ]; then
    echo ""
    echo "Updating $DEV_VARS_FILE (personal override, not synced to Doppler)..."
    touch "$DEV_VARS_FILE"

    if grep -q "^PASSKEY_REGISTRY_CONTRACT=" "$DEV_VARS_FILE"; then
        sed -i '' "s|^PASSKEY_REGISTRY_CONTRACT=.*|PASSKEY_REGISTRY_CONTRACT=\"$CONTRACT_ADDRESS\"|" "$DEV_VARS_FILE"
    else
        echo "PASSKEY_REGISTRY_CONTRACT=\"$CONTRACT_ADDRESS\"" >> "$DEV_VARS_FILE"
    fi

    if grep -q "^RELAYER_PRIVATE_KEY=" "$DEV_VARS_FILE"; then
        sed -i '' "s|^RELAYER_PRIVATE_KEY=.*|RELAYER_PRIVATE_KEY=\"$PRIVATE_KEY\"|" "$DEV_VARS_FILE"
    else
        echo "RELAYER_PRIVATE_KEY=\"$PRIVATE_KEY\"" >> "$DEV_VARS_FILE"
    fi

    echo "Updated .dev.vars:"
    echo "  PASSKEY_REGISTRY_CONTRACT=$CONTRACT_ADDRESS"
    echo "  RELAYER_PRIVATE_KEY=<updated>"

else
    if [ "$DEPLOY_TARGET" = "dev" ]; then
        DOPPLER_CONFIG="dev"
    else
        DOPPLER_CONFIG="prd"
    fi

    echo ""
    echo "Pushing PASSKEY_REGISTRY_CONTRACT + RELAYER_PRIVATE_KEY to Doppler"
    echo "(temporium-api / $DOPPLER_CONFIG)..."
    doppler secrets set \
        "PASSKEY_REGISTRY_CONTRACT=$CONTRACT_ADDRESS" \
        "RELAYER_PRIVATE_KEY=$PRIVATE_KEY" \
        -p temporium-api -c "$DOPPLER_CONFIG" --no-interactive
    echo "Doppler $DOPPLER_CONFIG config updated"

    # For production deploys, also sync Doppler → Cloudflare Worker secrets
    # so the live worker picks up the new contract on its next request.
    if [ "$DEPLOY_TARGET" = "deploy" ]; then
        echo ""
        echo "Syncing Doppler → Cloudflare Worker secrets..."
        cd "$GATEWAY_ROOT/api"
        yarn secrets:prod:sync
        echo "Worker secrets synced"
    fi
fi

echo ""
echo "Done!"
echo ""
echo "Next steps:"
if [ "$DEPLOY_TARGET" = "local" ] || [ "$DEPLOY_TARGET" = "dev" ]; then
    echo "  cd apps/wallet/api && yarn dev"
else
    echo "  cd apps/wallet/api && yarn worker:prod:deploy"
fi
