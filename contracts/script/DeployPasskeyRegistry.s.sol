// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PasskeyRegistry} from "../src/PasskeyRegistry.sol";

/**
 * @title DeployPasskeyRegistry
 * @notice Production deployment script for PasskeyRegistry
 *
 * Usage:
 *
 * 1. Import your keys into Foundry keystore (one-time):
 *    cast wallet import deployer --interactive
 *    cast wallet import relayer --interactive
 *
 * 2. Deploy (will prompt for password):
 *    forge script script/DeployPasskeyRegistry.s.sol \
 *      --rpc-url $RPC_URL \
 *      --account deployer \
 *      --broadcast \
 *      -vvvv
 *
 * 3. Authorize relayer (after deployment):
 *    cast send $CONTRACT_ADDRESS "setRelayer(address,bool)" $RELAYER_ADDRESS true \
 *      --rpc-url $RPC_URL \
 *      --account deployer
 */
contract DeployPasskeyRegistry is Script {
    function run() external {
        // Get relayer address from environment (public address, not private key)
        address relayerAddress = vm.envAddress("RELAYER_ADDRESS");

        console.log("Deploying PasskeyRegistry...");
        console.log("Relayer address:", relayerAddress);

        vm.startBroadcast();

        // Deploy contract
        PasskeyRegistry registry = new PasskeyRegistry();
        console.log("PasskeyRegistry deployed at:", address(registry));

        // Authorize relayer
        registry.setRelayer(relayerAddress, true);
        console.log("Relayer authorized!");

        vm.stopBroadcast();

        // Output for easy copy-paste
        console.log("\n=== Deployment Complete ===");
        console.log("PASSKEY_REGISTRY_ADDRESS=%s", address(registry));
    }
}
