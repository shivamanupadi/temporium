// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {RecurringPayments} from "../src/RecurringPayments.sol";

/**
 * @title DeployRecurringPayments
 * @notice Deployment script for RecurringPayments
 *
 * Usage:
 *   forge script script/DeployRecurringPayments.s.sol \
 *     --rpc-url $RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     -vvvv
 */
contract DeployRecurringPayments is Script {
    function run() external {
        console.log("Deploying RecurringPayments...");
        console.log("Deployer:", msg.sender);

        vm.startBroadcast();

        RecurringPayments payments = new RecurringPayments();
        console.log("RecurringPayments deployed at:", address(payments));

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("RECURRING_PAYMENTS_ADDRESS=%s", address(payments));
    }
}
