// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PasskeyRegistry
 * @notice On-chain registry for WebAuthn/Passkey public keys
 * @dev Stores credentialId -> publicKey mappings for passkey authentication
 *      This eliminates database as a single point of failure
 */
contract PasskeyRegistry {

    // ============ Constants ============

    /// @notice Maximum number of passkeys allowed per wallet
    uint256 public constant MAX_PASSKEYS_PER_WALLET = 10;

    // ============ State Variables ============

    /// @notice Contract owner
    address public owner;

    /// @notice Whether the contract is paused
    bool public paused;

    /// @notice Authorized relayers that can register passkeys
    mapping(address => bool) public authorizedRelayers;

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

    // ============ Events ============

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

    event RelayerUpdated(
        address indexed relayer,
        bool authorized
    );

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    event Paused(address account);
    event Unpaused(address account);

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "PasskeyRegistry: not owner");
        _;
    }

    modifier onlyRelayer() {
        require(authorizedRelayers[msg.sender], "PasskeyRegistry: not authorized relayer");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "PasskeyRegistry: paused");
        _;
    }

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ============ Owner Functions ============

    /**
     * @notice Transfer ownership to a new address
     * @param newOwner The new owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "PasskeyRegistry: invalid new owner");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    /**
     * @notice Set relayer authorization status
     * @param relayer The relayer address
     * @param authorized Whether the relayer is authorized
     */
    function setRelayer(address relayer, bool authorized) external onlyOwner {
        require(relayer != address(0), "PasskeyRegistry: invalid relayer");
        authorizedRelayers[relayer] = authorized;
        emit RelayerUpdated(relayer, authorized);
    }

    /**
     * @notice Pause the contract
     */
    function pause() external onlyOwner {
        require(!paused, "PasskeyRegistry: already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        require(paused, "PasskeyRegistry: not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ============ Relayer Functions ============

    /**
     * @notice Register a new passkey (only authorized relayers)
     * @param credentialIdHash keccak256 hash of the WebAuthn credentialId
     * @param publicKey The P256 public key bytes (64 bytes uncompressed)
     */
    function register(
        bytes32 credentialIdHash,
        bytes calldata publicKey
    ) external onlyRelayer whenNotPaused {
        require(publicKey.length == 64, "PasskeyRegistry: invalid P256 key length");
        require(passkeys[credentialIdHash].wallet == address(0), "PasskeyRegistry: already registered");

        // Derive wallet address from public key (last 20 bytes of keccak256)
        address wallet = address(uint160(uint256(keccak256(publicKey))));

        // Check max passkeys limit
        require(
            walletPasskeys[wallet].length < MAX_PASSKEYS_PER_WALLET,
            "PasskeyRegistry: max passkeys reached"
        );

        passkeys[credentialIdHash] = Passkey({
            publicKey: publicKey,
            wallet: wallet,
            createdAt: block.timestamp,
            isActive: true
        });

        walletPasskeys[wallet].push(credentialIdHash);

        emit PasskeyRegistered(credentialIdHash, wallet, publicKey, block.timestamp);
    }

    // ============ View Functions ============

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
     * @notice Get the number of passkeys for a wallet
     * @param wallet The wallet address
     */
    function getWalletPasskeyCount(address wallet) external view returns (uint256) {
        return walletPasskeys[wallet].length;
    }

    // ============ Wallet Owner Functions ============

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
