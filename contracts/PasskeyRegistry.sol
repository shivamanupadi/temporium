// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PasskeyRegistry
 * @notice On-chain registry for WebAuthn/Passkey public keys
 * @dev Stores credentialId -> publicKey mappings for passkey authentication
 *      This eliminates database as a single point of failure
 */
contract PasskeyRegistry {

    struct Passkey {
        bytes publicKey;      // P256 public key (64 bytes uncompressed)
        address wallet;       // Derived wallet address
        uint256 createdAt;    // Registration timestamp
        bool isActive;        // Can be deactivated by owner
    }

    // credentialIdHash => Passkey data
    mapping(bytes32 => Passkey) public passkeys;

    // wallet => credentialIdHashes (for listing user's passkeys)
    mapping(address => bytes32[]) public walletPasskeys;

    // Events for indexing and discovery
    event PasskeyRegistered(
        bytes32 indexed credentialIdHash,
        address indexed wallet,
        bytes publicKey,
        uint256 timestamp
    );

    event PasskeyDeactivated(
        bytes32 indexed credentialIdHash,
        address indexed wallet
    );

    event PasskeyReactivated(
        bytes32 indexed credentialIdHash,
        address indexed wallet
    );

    /**
     * @notice Register a new passkey
     * @param credentialIdHash keccak256 hash of the WebAuthn credentialId
     * @param publicKey The P256 public key bytes
     * @param wallet The derived wallet address
     */
    function register(
        bytes32 credentialIdHash,
        bytes calldata publicKey,
        address wallet
    ) external {
        require(passkeys[credentialIdHash].wallet == address(0), "PasskeyRegistry: already registered");
        require(wallet != address(0), "PasskeyRegistry: invalid wallet");
        require(publicKey.length > 0, "PasskeyRegistry: invalid public key");

        passkeys[credentialIdHash] = Passkey({
            publicKey: publicKey,
            wallet: wallet,
            createdAt: block.timestamp,
            isActive: true
        });

        walletPasskeys[wallet].push(credentialIdHash);

        emit PasskeyRegistered(credentialIdHash, wallet, publicKey, block.timestamp);
    }

    /**
     * @notice Get public key by credentialId hash
     * @param credentialIdHash keccak256 hash of the WebAuthn credentialId
     * @return publicKey The stored public key bytes
     * @return wallet The associated wallet address
     * @return isActive Whether the passkey is active
     */
    function getPublicKey(bytes32 credentialIdHash)
        external
        view
        returns (bytes memory publicKey, address wallet, bool isActive)
    {
        Passkey storage pk = passkeys[credentialIdHash];
        return (pk.publicKey, pk.wallet, pk.isActive);
    }

    /**
     * @notice Get full passkey data
     * @param credentialIdHash keccak256 hash of the WebAuthn credentialId
     */
    function getPasskey(bytes32 credentialIdHash)
        external
        view
        returns (
            bytes memory publicKey,
            address wallet,
            uint256 createdAt,
            bool isActive
        )
    {
        Passkey storage pk = passkeys[credentialIdHash];
        return (pk.publicKey, pk.wallet, pk.createdAt, pk.isActive);
    }

    /**
     * @notice Check if a passkey exists and is active
     * @param credentialIdHash keccak256 hash of the WebAuthn credentialId
     */
    function isRegistered(bytes32 credentialIdHash) external view returns (bool) {
        return passkeys[credentialIdHash].wallet != address(0) && passkeys[credentialIdHash].isActive;
    }

    /**
     * @notice Get all credential IDs for a wallet
     * @param wallet The wallet address
     * @return Array of credentialId hashes
     */
    function getWalletPasskeys(address wallet)
        external
        view
        returns (bytes32[] memory)
    {
        return walletPasskeys[wallet];
    }

    /**
     * @notice Deactivate a passkey (only wallet owner)
     * @param credentialIdHash The credential to deactivate
     */
    function deactivate(bytes32 credentialIdHash) external {
        require(passkeys[credentialIdHash].wallet == msg.sender, "PasskeyRegistry: not owner");
        require(passkeys[credentialIdHash].isActive, "PasskeyRegistry: already inactive");

        passkeys[credentialIdHash].isActive = false;
        emit PasskeyDeactivated(credentialIdHash, msg.sender);
    }

    /**
     * @notice Reactivate a passkey (only wallet owner)
     * @param credentialIdHash The credential to reactivate
     */
    function reactivate(bytes32 credentialIdHash) external {
        require(passkeys[credentialIdHash].wallet == msg.sender, "PasskeyRegistry: not owner");
        require(!passkeys[credentialIdHash].isActive, "PasskeyRegistry: already active");

        passkeys[credentialIdHash].isActive = true;
        emit PasskeyReactivated(credentialIdHash, msg.sender);
    }
}
