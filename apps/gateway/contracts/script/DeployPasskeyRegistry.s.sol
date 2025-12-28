// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PasskeyRegistry} from "../src/PasskeyRegistry.sol";

/**
 * @title DeployPasskeyRegistry
 * @notice Deployment script for PasskeyRegistry
 *
 * Usage:
 *   forge script script/DeployPasskeyRegistry.s.sol \
 *     --rpc-url $RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     -vvvv
 */
contract DeployPasskeyRegistry is Script {
    function run() external {
        console.log("Deploying PasskeyRegistry...");
        console.log("Deployer:", msg.sender);

        vm.startBroadcast();

        PasskeyRegistry registry = new PasskeyRegistry();
        console.log("PasskeyRegistry deployed at:", address(registry));

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("PASSKEY_REGISTRY_ADDRESS=%s", address(registry));
        console.log("\nOwner (same key used for registration):", registry.owner());
    }
}
