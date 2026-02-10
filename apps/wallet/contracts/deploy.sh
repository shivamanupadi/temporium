#!/bin/bash
set -e

# Network configuration
TESTNET_RPC_URL="https://rpc.moderato.tempo.xyz"
TESTNET_CHAIN_ID=42431
MAINNET_RPC_URL="https://rpc.tempo.xyz"
MAINNET_CHAIN_ID=42420

# File paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WALLET_ROOT="$(dirname "$SCRIPT_DIR")"
DEV_VARS_FILE="$WALLET_ROOT/api/.dev.vars"
WRANGLER_FILE="$WALLET_ROOT/api/wrangler.toml"

# Parse flags
UPDATE_TARGET=""
NETWORK=""
OP_ITEM=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --dev|-d)
            UPDATE_TARGET="dev"
            OP_ITEM="Temporium Wallet Contract Owner Development"
            shift
            ;;
        --prod|-p)
            UPDATE_TARGET="prod"
            OP_ITEM="Temporium Wallet Contract Owner Production"
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
            echo "Usage: ./deploy.sh <--dev|-d|--prod|-p> <--testnet|-t|--mainnet|-m>"
            echo ""
            echo "Deploys PasskeyRegistry to Tempo and updates config files."
            echo ""
            echo "Environment (required):"
            echo "  --dev, -d       Deploy using dev credentials, update .dev.vars"
            echo "  --prod, -p      Deploy using prod credentials, update wrangler.toml"
            echo ""
            echo "Network (required):"
            echo "  --testnet, -t   Deploy to Tempo Testnet (Moderato)"
            echo "  --mainnet, -m   Deploy to Tempo Mainnet"
            echo ""
            echo "Examples:"
            echo "  ./deploy.sh --dev --testnet"
            echo "  ./deploy.sh --prod --mainnet"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

# Require both flags
if [ -z "$UPDATE_TARGET" ] || [ -z "$NETWORK" ]; then
    echo "Error: You must specify both environment and network"
    echo ""
    echo "Usage: ./deploy.sh <--dev|-d|--prod|-p> <--testnet|-t|--mainnet|-m>"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh --dev --testnet"
    echo "  ./deploy.sh --prod --mainnet"
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

echo "=== PasskeyRegistry Deployment ==="
echo "Network: $NETWORK_LABEL (Chain ID: $CHAIN_ID)"
echo "Environment: $UPDATE_TARGET"
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
DEPLOY_OUTPUT=$(forge create src/PasskeyRegistry.sol:PasskeyRegistry \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --legacy \
    --broadcast 2>&1)

echo "$DEPLOY_OUTPUT"

# Extract contract address from output
CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oE "Deployed to: 0x[a-fA-F0-9]{40}" | cut -d' ' -f3)

if [ -z "$CONTRACT_ADDRESS" ]; then
    echo ""
    echo "Error: Could not extract contract address from deployment output"
    exit 1
fi

echo ""
echo "=== Deployment Complete ==="
echo "Contract Address: $CONTRACT_ADDRESS"

# Update config files based on flag
if [ "$UPDATE_TARGET" = "dev" ]; then
    echo ""
    echo "Updating $DEV_VARS_FILE..."
    if [ -f "$DEV_VARS_FILE" ]; then
        # Update PASSKEY_REGISTRY_ADDRESS
        if grep -q "^PASSKEY_REGISTRY_ADDRESS=" "$DEV_VARS_FILE"; then
            sed -i '' "s|^PASSKEY_REGISTRY_ADDRESS=.*|PASSKEY_REGISTRY_ADDRESS=\"$CONTRACT_ADDRESS\"|" "$DEV_VARS_FILE"
        else
            echo "PASSKEY_REGISTRY_ADDRESS=\"$CONTRACT_ADDRESS\"" >> "$DEV_VARS_FILE"
        fi

        # Update RELAYER_PRIVATE_KEY
        if grep -q "^RELAYER_PRIVATE_KEY=" "$DEV_VARS_FILE"; then
            sed -i '' "s|^RELAYER_PRIVATE_KEY=.*|RELAYER_PRIVATE_KEY=\"$PRIVATE_KEY\"|" "$DEV_VARS_FILE"
        else
            echo "RELAYER_PRIVATE_KEY=\"$PRIVATE_KEY\"" >> "$DEV_VARS_FILE"
        fi

        echo "Updated .dev.vars:"
        echo "  PASSKEY_REGISTRY_ADDRESS=$CONTRACT_ADDRESS"
        echo "  RELAYER_PRIVATE_KEY=<updated>"
    else
        echo "Error: $DEV_VARS_FILE not found"
        exit 1
    fi
elif [ "$UPDATE_TARGET" = "prod" ]; then
    echo ""
    echo "Updating $WRANGLER_FILE..."
    if [ -f "$WRANGLER_FILE" ]; then
        # Update PASSKEY_REGISTRY_ADDRESS in wrangler.toml
        sed -i '' "s|^PASSKEY_REGISTRY_ADDRESS = \"0x[a-fA-F0-9]*\"|PASSKEY_REGISTRY_ADDRESS = \"$CONTRACT_ADDRESS\"|" "$WRANGLER_FILE"
        echo "Updated wrangler.toml:"
        echo "  PASSKEY_REGISTRY_ADDRESS = \"$CONTRACT_ADDRESS\""
    else
        echo "Error: $WRANGLER_FILE not found"
        exit 1
    fi

    # Set RELAYER_PRIVATE_KEY as wrangler secret
    echo ""
    echo "Setting RELAYER_PRIVATE_KEY as wrangler secret..."
    cd "$WALLET_ROOT/api"
    echo "$PRIVATE_KEY" | npx wrangler secret put RELAYER_PRIVATE_KEY
    echo "RELAYER_PRIVATE_KEY secret updated"
fi

echo ""
echo "Done!"
