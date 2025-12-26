// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PasskeyRegistry
 * @notice On-chain registry for WebAuthn/Passkey public keys
 * @dev 1 passkey = 1 wallet (derived from public key)
 */
contract PasskeyRegistry {
    address public immutable owner;

    struct Passkey {
        bytes publicKey;
        address wallet;
        uint256 createdAt;
    }

    mapping(bytes32 => Passkey) public passkeys;
    mapping(bytes32 => bool) private registeredKeys;

    event PasskeyRegistered(
        bytes32 indexed credentialIdHash,
        address indexed wallet,
        bytes publicKey,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function register(
        bytes32 credentialIdHash,
        bytes calldata publicKey
    ) external onlyOwner {
        require(credentialIdHash != bytes32(0), "invalid credential");
        require(publicKey.length == 64, "invalid key length");
        require(passkeys[credentialIdHash].wallet == address(0), "already registered");

        bytes32 keyHash = keccak256(publicKey);
        require(!registeredKeys[keyHash], "key already registered");

        address wallet = address(uint160(uint256(keyHash)));

        passkeys[credentialIdHash] = Passkey({
            publicKey: publicKey,
            wallet: wallet,
            createdAt: block.timestamp
        });
        registeredKeys[keyHash] = true;

        emit PasskeyRegistered(credentialIdHash, wallet, publicKey, block.timestamp);
    }

    function getPublicKey(bytes32 credentialIdHash)
        external
        view
        returns (bytes memory publicKey, address wallet, uint256 createdAt)
    {
        Passkey storage pk = passkeys[credentialIdHash];
        return (pk.publicKey, pk.wallet, pk.createdAt);
    }

    function isRegistered(bytes32 credentialIdHash) external view returns (bool) {
        return passkeys[credentialIdHash].wallet != address(0);
    }
}
