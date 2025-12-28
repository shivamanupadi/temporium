#!/bin/bash
set -e

# Tempo Testnet configuration
RPC_URL="https://rpc.testnet.tempo.xyz"
CHAIN_ID=42429

# File paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WALLET_ROOT="$(dirname "$SCRIPT_DIR")"
DEV_VARS_FILE="$WALLET_ROOT/api/.dev.vars"
WRANGLER_FILE="$WALLET_ROOT/api/wrangler.toml"

# Parse flags
UPDATE_TARGET=""
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
        --help|-h)
            echo "Usage: ./deploy.sh <--dev|-d|--prod|-p>"
            echo ""
            echo "Deploys PasskeyRegistry to Tempo Testnet and updates config files."
            echo ""
            echo "Options:"
            echo "  --dev, -d   Deploy using dev credentials, update .dev.vars"
            echo "  --prod, -p  Deploy using prod credentials, update wrangler.toml"
            echo "  --help, -h  Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

# Require --dev or --prod flag
if [ -z "$UPDATE_TARGET" ]; then
    echo "Error: You must specify --dev or --prod"
    echo ""
    echo "Usage: ./deploy.sh <--dev|-d|--prod|-p>"
    echo "  --dev, -d   Deploy using dev credentials, update .dev.vars"
    echo "  --prod, -p  Deploy using prod credentials, update wrangler.toml"
    exit 1
fi

echo "=== PasskeyRegistry Deployment ==="
echo "Network: Tempo Testnet (Chain ID: $CHAIN_ID)"
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

# Deploy the contract and capture output
echo "Deploying PasskeyRegistry..."
DEPLOY_OUTPUT=$(forge script script/DeployPasskeyRegistry.s.sol:DeployPasskeyRegistry \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --broadcast \
    -vvvv 2>&1)

echo "$DEPLOY_OUTPUT"

# Extract contract address from output
CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oE "PASSKEY_REGISTRY_ADDRESS=0x[a-fA-F0-9]{40}" | cut -d'=' -f2)

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
