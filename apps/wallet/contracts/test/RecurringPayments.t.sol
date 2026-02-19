// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {RecurringPayments} from "../src/RecurringPayments.sol";

contract MockTIP20 {
    string public name = "Mock USD";
    string public symbol = "MUSD";
    uint8 public decimals = 18;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        require(allowance[from][msg.sender] >= amount, "insufficient allowance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        return true;
    }
}

contract RecurringPaymentsTest is Test {
    RecurringPayments public payments;
    MockTIP20 public token;

    address subscriber = address(0x1);
    address recipient = address(0x2);
    address relayer = address(0x3);

    uint256 constant AMOUNT = 100e18;
    uint256 constant INTERVAL = 30 days;

    function setUp() public {
        payments = new RecurringPayments();
        token = new MockTIP20();

        // Fund subscriber
        token.mint(subscriber, 10_000e18);

        // Subscriber approves the contract
        vm.prank(subscriber);
        token.approve(address(payments), type(uint256).max);
    }

    function testCreateSubscription() public {
        vm.prank(subscriber);
        uint256 id = payments.createSubscription(
            recipient,
            address(token),
            AMOUNT,
            INTERVAL,
            12,  // 12 payments
            0    // start now
        );

        assertEq(id, 0);

        RecurringPayments.Subscription memory sub = payments.getSubscription(id);
        assertEq(sub.subscriber, subscriber);
        assertEq(sub.recipient, recipient);
        assertEq(sub.token, address(token));
        assertEq(sub.amount, AMOUNT);
        assertEq(sub.interval, INTERVAL);
        assertEq(sub.maxPayments, 12);
        assertEq(sub.paymentsMade, 0);
        assertTrue(sub.active);
    }

    function testExecutePayment() public {
        vm.prank(subscriber);
        uint256 id = payments.createSubscription(
            recipient, address(token), AMOUNT, INTERVAL, 0, 0
        );

        // Anyone can execute (relayer)
        vm.prank(relayer);
        payments.executePayment(id);

        assertEq(token.balanceOf(recipient), AMOUNT);
        assertEq(token.balanceOf(subscriber), 10_000e18 - AMOUNT);

        RecurringPayments.Subscription memory sub = payments.getSubscription(id);
        assertEq(sub.paymentsMade, 1);
    }

    function testCannotExecuteEarly() public {
        vm.prank(subscriber);
        uint256 id = payments.createSubscription(
            recipient, address(token), AMOUNT, INTERVAL, 0, 0
        );

        // First payment succeeds
        payments.executePayment(id);

        // Second payment reverts (not due yet)
        vm.expectRevert("payment not due yet");
        payments.executePayment(id);
    }

    function testExecuteAfterInterval() public {
        vm.prank(subscriber);
        uint256 id = payments.createSubscription(
            recipient, address(token), AMOUNT, INTERVAL, 0, 0
        );

        payments.executePayment(id);
        assertEq(token.balanceOf(recipient), AMOUNT);

        // Warp forward 30 days
        vm.warp(block.timestamp + INTERVAL);

        payments.executePayment(id);
        assertEq(token.balanceOf(recipient), AMOUNT * 2);
    }

    function testMaxPaymentsDeactivates() public {
        vm.prank(subscriber);
        uint256 id = payments.createSubscription(
            recipient, address(token), AMOUNT, INTERVAL, 2, 0
        );

        // Payment 1
        payments.executePayment(id);

        // Payment 2
        vm.warp(block.timestamp + INTERVAL);
        payments.executePayment(id);

        // Subscription should be inactive now
        RecurringPayments.Subscription memory sub = payments.getSubscription(id);
        assertFalse(sub.active);
        assertEq(sub.paymentsMade, 2);

        // Payment 3 should revert
        vm.warp(block.timestamp + INTERVAL);
        vm.expectRevert("subscription inactive");
        payments.executePayment(id);
    }

    function testCancelSubscription() public {
        vm.prank(subscriber);
        uint256 id = payments.createSubscription(
            recipient, address(token), AMOUNT, INTERVAL, 0, 0
        );

        vm.prank(subscriber);
        payments.cancelSubscription(id);

        RecurringPayments.Subscription memory sub = payments.getSubscription(id);
        assertFalse(sub.active);

        vm.expectRevert("subscription inactive");
        payments.executePayment(id);
    }

    function testOnlySubscriberCanCancel() public {
        vm.prank(subscriber);
        uint256 id = payments.createSubscription(
            recipient, address(token), AMOUNT, INTERVAL, 0, 0
        );

        vm.prank(recipient);
        vm.expectRevert("not subscriber");
        payments.cancelSubscription(id);
    }

    function testFutureStartDate() public {
        uint256 futureStart = block.timestamp + 7 days;

        vm.prank(subscriber);
        uint256 id = payments.createSubscription(
            recipient, address(token), AMOUNT, INTERVAL, 0, futureStart
        );

        // Cannot execute yet
        vm.expectRevert("payment not due yet");
        payments.executePayment(id);

        // Warp to start date
        vm.warp(futureStart);
        payments.executePayment(id);
        assertEq(token.balanceOf(recipient), AMOUNT);
    }

    function testIsDue() public {
        vm.prank(subscriber);
        uint256 id = payments.createSubscription(
            recipient, address(token), AMOUNT, INTERVAL, 0, 0
        );

        assertTrue(payments.isDue(id));

        payments.executePayment(id);
        assertFalse(payments.isDue(id));

        vm.warp(block.timestamp + INTERVAL);
        assertTrue(payments.isDue(id));
    }

    function testSubscriberAndRecipientLookups() public {
        vm.prank(subscriber);
        payments.createSubscription(recipient, address(token), AMOUNT, INTERVAL, 0, 0);

        vm.prank(subscriber);
        payments.createSubscription(recipient, address(token), AMOUNT * 2, INTERVAL, 0, 0);

        uint256[] memory subIds = payments.getSubscriberSubscriptions(subscriber);
        assertEq(subIds.length, 2);

        uint256[] memory recIds = payments.getRecipientSubscriptions(recipient);
        assertEq(recIds.length, 2);
    }

    function testInsufficientBalanceReverts() public {
        // Create subscriber with no balance
        address poorSub = address(0x4);
        vm.prank(poorSub);
        token.approve(address(payments), type(uint256).max);

        vm.prank(poorSub);
        uint256 id = payments.createSubscription(
            recipient, address(token), AMOUNT, INTERVAL, 0, 0
        );

        vm.expectRevert("insufficient balance");
        payments.executePayment(id);
    }

    function testMinimumIntervalEnforced() public {
        vm.prank(subscriber);
        vm.expectRevert("interval must be >= 1 minute");
        payments.createSubscription(
            recipient, address(token), AMOUNT, 30, 0, 0  // 30 seconds - too short
        );
    }

    function testMinuteIntervalAllowed() public {
        vm.prank(subscriber);
        uint256 id = payments.createSubscription(
            recipient, address(token), AMOUNT, 60, 0, 0  // 1 minute
        );

        payments.executePayment(id);
        assertEq(token.balanceOf(recipient), AMOUNT);

        vm.warp(block.timestamp + 60);
        payments.executePayment(id);
        assertEq(token.balanceOf(recipient), AMOUNT * 2);
    }

    function testCreateWithoutAllowance() public {
        // Can create subscription without prior approval
        address newSub = address(0x5);
        vm.prank(newSub);
        uint256 id = payments.createSubscription(
            recipient, address(token), AMOUNT, INTERVAL, 0, 0
        );

        RecurringPayments.Subscription memory sub = payments.getSubscription(id);
        assertTrue(sub.active);
        assertEq(sub.subscriber, newSub);

        // But execution fails without balance
        vm.expectRevert("insufficient balance");
        payments.executePayment(id);
    }
}
