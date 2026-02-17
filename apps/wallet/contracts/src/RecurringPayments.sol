// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITIP20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

/**
 * @title RecurringPayments
 * @notice Non-custodial recurring payment subscriptions via approve + pull pattern.
 *         Tokens stay in the subscriber's wallet. This contract only pulls funds
 *         when a payment is due, using the TIP-20 transferFrom mechanism.
 */
contract RecurringPayments {
    struct Subscription {
        address subscriber;
        address recipient;
        address token;
        uint256 amount;
        uint256 interval;       // seconds between payments
        uint256 nextPayment;    // timestamp of next allowed execution
        uint256 maxPayments;    // 0 = unlimited
        uint256 paymentsMade;
        bool active;
    }

    uint256 public nextSubscriptionId;
    mapping(uint256 => Subscription) public subscriptions;

    // subscriber => their subscription IDs
    mapping(address => uint256[]) private subscriberSubs;

    // recipient => subscription IDs paying them
    mapping(address => uint256[]) private recipientSubs;

    event SubscriptionCreated(
        uint256 indexed subscriptionId,
        address indexed subscriber,
        address indexed recipient,
        address token,
        uint256 amount,
        uint256 interval,
        uint256 maxPayments,
        uint256 firstPayment
    );

    event PaymentExecuted(
        uint256 indexed subscriptionId,
        address indexed subscriber,
        address indexed recipient,
        address token,
        uint256 amount,
        uint256 timestamp
    );

    event SubscriptionCancelled(
        uint256 indexed subscriptionId,
        address indexed subscriber,
        uint256 timestamp
    );

    /**
     * @notice Create a new recurring payment subscription.
     * @dev Caller must have already approved this contract for the token.
     * @param recipient Address receiving payments
     * @param token TIP-20 token address
     * @param amount Amount per payment (in token's smallest unit)
     * @param interval Seconds between payments (e.g., 2592000 for ~30 days)
     * @param maxPayments Max number of payments (0 = unlimited)
     * @param startAt Timestamp for first payment (0 = now)
     */
    function createSubscription(
        address recipient,
        address token,
        uint256 amount,
        uint256 interval,
        uint256 maxPayments,
        uint256 startAt
    ) external returns (uint256 subscriptionId) {
        require(recipient != address(0), "invalid recipient");
        require(token != address(0), "invalid token");
        require(amount > 0, "amount must be > 0");
        require(interval >= 60, "interval must be >= 1 minute");

        uint256 firstPayment = startAt > block.timestamp ? startAt : block.timestamp;

        subscriptionId = nextSubscriptionId++;

        subscriptions[subscriptionId] = Subscription({
            subscriber: msg.sender,
            recipient: recipient,
            token: token,
            amount: amount,
            interval: interval,
            nextPayment: firstPayment,
            maxPayments: maxPayments,
            paymentsMade: 0,
            active: true
        });

        subscriberSubs[msg.sender].push(subscriptionId);
        recipientSubs[recipient].push(subscriptionId);

        emit SubscriptionCreated(
            subscriptionId,
            msg.sender,
            recipient,
            token,
            amount,
            interval,
            maxPayments,
            firstPayment
        );
    }

    /**
     * @notice Execute a due payment. Anyone can call this (relayer, recipient, etc).
     * @dev Reverts if payment is not yet due or subscription is inactive.
     */
    function executePayment(uint256 subscriptionId) external {
        Subscription storage sub = subscriptions[subscriptionId];
        require(sub.active, "subscription inactive");
        require(block.timestamp >= sub.nextPayment, "payment not due yet");
        require(
            sub.maxPayments == 0 || sub.paymentsMade < sub.maxPayments,
            "max payments reached"
        );

        sub.paymentsMade += 1;
        sub.nextPayment += sub.interval;

        // Auto-deactivate if max payments reached
        if (sub.maxPayments > 0 && sub.paymentsMade >= sub.maxPayments) {
            sub.active = false;
        }

        bool success = ITIP20(sub.token).transferFrom(
            sub.subscriber,
            sub.recipient,
            sub.amount
        );
        require(success, "transfer failed");

        emit PaymentExecuted(
            subscriptionId,
            sub.subscriber,
            sub.recipient,
            sub.token,
            sub.amount,
            block.timestamp
        );
    }

    /**
     * @notice Cancel a subscription. Only the subscriber can cancel.
     */
    function cancelSubscription(uint256 subscriptionId) external {
        Subscription storage sub = subscriptions[subscriptionId];
        require(sub.subscriber == msg.sender, "not subscriber");
        require(sub.active, "already inactive");

        sub.active = false;

        emit SubscriptionCancelled(subscriptionId, msg.sender, block.timestamp);
    }

    // ── View functions ──────────────────────────────────────────────

    function getSubscription(uint256 subscriptionId)
        external
        view
        returns (Subscription memory)
    {
        return subscriptions[subscriptionId];
    }

    function getSubscriberSubscriptions(address subscriber)
        external
        view
        returns (uint256[] memory)
    {
        return subscriberSubs[subscriber];
    }

    function getRecipientSubscriptions(address recipient)
        external
        view
        returns (uint256[] memory)
    {
        return recipientSubs[recipient];
    }

    function isDue(uint256 subscriptionId) external view returns (bool) {
        Subscription storage sub = subscriptions[subscriptionId];
        if (!sub.active) return false;
        if (sub.maxPayments > 0 && sub.paymentsMade >= sub.maxPayments) return false;
        return block.timestamp >= sub.nextPayment;
    }
}
