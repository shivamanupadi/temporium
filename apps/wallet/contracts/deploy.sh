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
WRANGLER_FILE="$GATEWAY_ROOT/api/wrangler.toml"

# Parse flags
DEPLOY_TARGET=""
NETWORK=""
OP_ITEM=""
while [[ $# -gt 0 ]]; do
    case $1 in
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
            echo "Usage: ./deploy.sh <--dev|-d|--deploy> <--testnet|-t|--mainnet|-m>"
            echo ""
            echo "Deploys PasskeyRegistry to Tempo and updates wallet config."
            echo ""
            echo "Target (required):"
            echo "  --dev, -d       Deploy contract, update .dev.vars (local dev)"
            echo "  --deploy        Deploy contract, update wrangler.toml [vars]"
            echo "                  and set wrangler secrets"
            echo ""
            echo "Network (required):"
            echo "  --testnet, -t   Deploy to Tempo Testnet (Moderato)"
            echo "  --mainnet, -m   Deploy to Tempo Mainnet"
            echo ""
            echo "Examples:"
            echo "  ./deploy.sh --dev --testnet       # Local dev against testnet"
            echo "  ./deploy.sh --deploy --testnet    # Deploy testnet contract + update worker"
            echo "  ./deploy.sh --deploy --mainnet    # Deploy mainnet contract + update worker"
            echo ""
            echo "Worker deploy (after contract deploy):"
            echo "  wrangler deploy"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

# Select 1Password item based on deploy target (dev wallet for local, prod wallet for deploy)
if [ "$DEPLOY_TARGET" = "dev" ]; then
    OP_ITEM="Temporium Wallet Contract Owner Development"
elif [ "$DEPLOY_TARGET" = "deploy" ]; then
    OP_ITEM="Temporium Wallet Contract Owner Production"
fi

# Require both flags
if [ -z "$DEPLOY_TARGET" ] || [ -z "$NETWORK" ]; then
    echo "Error: You must specify both target and network"
    echo ""
    echo "Usage: ./deploy.sh <--dev|-d|--deploy> <--testnet|-t|--mainnet|-m>"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh --dev --testnet"
    echo "  ./deploy.sh --deploy --testnet"
    echo "  ./deploy.sh --deploy --mainnet"
    exit 1
fi

# Set RPC URL and chain ID based on network
if [ "$NETWORK" = "testnet" ]; then
    RPC_URL="$TESTNET_RPC_URL"
    CHAIN_ID="$TESTNET_CHAIN_ID"
    NETWORK_LABEL="Testnet (Moderato)"
    RELAYER_SECRET="TESTNET_RELAYER_PRIVATE_KEY"
else
    RPC_URL="$MAINNET_RPC_URL"
    CHAIN_ID="$MAINNET_CHAIN_ID"
    NETWORK_LABEL="Mainnet"
    RELAYER_SECRET="MAINNET_RELAYER_PRIVATE_KEY"
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

# Update config files based on target
if [ "$DEPLOY_TARGET" = "dev" ]; then
    echo ""
    echo "Updating $DEV_VARS_FILE..."

    # Create .dev.vars if it doesn't exist
    touch "$DEV_VARS_FILE"

    # Update per-network PASSKEY_REGISTRY_ADDRESS
    if grep -q "^MAINNET_PASSKEY_REGISTRY_ADDRESS=" "$DEV_VARS_FILE"; then
        sed -i '' "s|^MAINNET_PASSKEY_REGISTRY_ADDRESS=.*|MAINNET_PASSKEY_REGISTRY_ADDRESS=\"$CONTRACT_ADDRESS\"|" "$DEV_VARS_FILE"
    else
        echo "MAINNET_PASSKEY_REGISTRY_ADDRESS=\"$CONTRACT_ADDRESS\"" >> "$DEV_VARS_FILE"
    fi

    # Update per-network RELAYER_PRIVATE_KEY
    if grep -q "^${RELAYER_SECRET}=" "$DEV_VARS_FILE"; then
        sed -i '' "s|^${RELAYER_SECRET}=.*|${RELAYER_SECRET}=\"$PRIVATE_KEY\"|" "$DEV_VARS_FILE"
    else
        echo "${RELAYER_SECRET}=\"$PRIVATE_KEY\"" >> "$DEV_VARS_FILE"
    fi

    echo "Updated .dev.vars:"
    echo "  MAINNET_PASSKEY_REGISTRY_ADDRESS=$CONTRACT_ADDRESS"
    echo "  ${RELAYER_SECRET}=<updated>"

elif [ "$DEPLOY_TARGET" = "deploy" ]; then
    echo ""
    echo "Updating wrangler.toml [vars]..."

    if [ ! -f "$WRANGLER_FILE" ]; then
        echo "Error: $WRANGLER_FILE not found"
        exit 1
    fi

    # Update per-network PASSKEY_REGISTRY_ADDRESS under [vars]
    sed -i '' "s|^MAINNET_PASSKEY_REGISTRY_ADDRESS = \".*\"|MAINNET_PASSKEY_REGISTRY_ADDRESS = \"$CONTRACT_ADDRESS\"|" "$WRANGLER_FILE"

    echo "Updated wrangler.toml [vars]:"
    echo "  MAINNET_PASSKEY_REGISTRY_ADDRESS = \"$CONTRACT_ADDRESS\""

    # Set secret (no -e flag — single worker)
    echo ""
    echo "Setting wrangler secret ${RELAYER_SECRET}..."
    cd "$GATEWAY_ROOT/api"
    echo "$PRIVATE_KEY" | npx wrangler secret put "$RELAYER_SECRET"
    echo "${RELAYER_SECRET} secret updated"
fi

echo ""
echo "Done!"
echo ""
echo "Next steps:"
if [ "$DEPLOY_TARGET" = "dev" ]; then
    echo "  cd apps/wallet/api && yarn dev"
else
    echo "  cd apps/wallet/api && wrangler deploy"
fi
