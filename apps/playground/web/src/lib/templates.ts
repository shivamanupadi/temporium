/**
 * Contract templates for quick start.
 */

export interface Template {
  id: string;
  name: string;
  description: string;
  source: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'simple-storage',
    name: 'Simple Storage',
    description: 'A basic contract that stores and retrieves a number. Great for learning.',
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SimpleStorage
 * @notice A basic contract for storing and retrieving a number
 */
contract SimpleStorage {
    uint256 private storedNumber;

    event NumberUpdated(uint256 oldValue, uint256 newValue);

    /**
     * @notice Store a new number
     * @param _number The number to store
     */
    function store(uint256 _number) public {
        uint256 oldValue = storedNumber;
        storedNumber = _number;
        emit NumberUpdated(oldValue, _number);
    }

    /**
     * @notice Retrieve the stored number
     * @return The currently stored number
     */
    function retrieve() public view returns (uint256) {
        return storedNumber;
    }
}
`,
  },
  {
    id: 'erc20',
    name: 'ERC20 Token',
    description: 'Standard ERC20 token with mint and burn capabilities. Uses OpenZeppelin.',
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MyToken
 * @notice A basic ERC20 token with mint capability
 */
contract MyToken is ERC20, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    /**
     * @notice Mint new tokens (owner only)
     * @param to Address to receive tokens
     * @param amount Amount to mint (in smallest units)
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
`,
  },
  {
    id: 'counter',
    name: 'Counter',
    description: 'Simple counter with increment, decrement, and reset functions.',
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Counter
 * @notice A simple counter contract
 */
contract Counter {
    uint256 public count;

    event CountChanged(uint256 newCount);

    /**
     * @notice Increment the counter by 1
     */
    function increment() public {
        count += 1;
        emit CountChanged(count);
    }

    /**
     * @notice Decrement the counter by 1
     */
    function decrement() public {
        require(count > 0, "Counter: cannot decrement below zero");
        count -= 1;
        emit CountChanged(count);
    }

    /**
     * @notice Reset the counter to 0
     */
    function reset() public {
        count = 0;
        emit CountChanged(count);
    }
}
`,
  },
  {
    id: 'greeting',
    name: 'Greeting',
    description: 'A simple contract that stores and returns a greeting message.',
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Greeting
 * @notice A simple greeting contract
 */
contract Greeting {
    string private greeting;
    address public owner;

    event GreetingChanged(string oldGreeting, string newGreeting);

    constructor(string memory _greeting) {
        greeting = _greeting;
        owner = msg.sender;
    }

    /**
     * @notice Set a new greeting
     * @param _greeting The new greeting message
     */
    function setGreeting(string memory _greeting) public {
        string memory oldGreeting = greeting;
        greeting = _greeting;
        emit GreetingChanged(oldGreeting, _greeting);
    }

    /**
     * @notice Get the current greeting
     * @return The current greeting message
     */
    function getGreeting() public view returns (string memory) {
        return greeting;
    }

    /**
     * @notice Get greeting with sender address
     * @return A personalized greeting
     */
    function greet() public view returns (string memory) {
        return string(abi.encodePacked(greeting, ", ", toHexString(msg.sender)));
    }

    /**
     * @notice Convert address to hex string
     */
    function toHexString(address addr) internal pure returns (string memory) {
        bytes memory buffer = new bytes(42);
        buffer[0] = "0";
        buffer[1] = "x";
        bytes memory hexChars = "0123456789abcdef";
        for (uint256 i = 0; i < 20; i++) {
            buffer[2 + i * 2] = hexChars[uint8(uint160(addr) >> (8 * (19 - i) + 4)) & 0xf];
            buffer[3 + i * 2] = hexChars[uint8(uint160(addr) >> (8 * (19 - i))) & 0xf];
        }
        return string(buffer);
    }
}
`,
  },
  {
    id: 'multisig',
    name: 'Multi-Sig Wallet',
    description: 'A basic multi-signature wallet requiring multiple approvals.',
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MultiSigWallet
 * @notice A simple multi-signature wallet
 */
contract MultiSigWallet {
    event Deposit(address indexed sender, uint256 amount);
    event Submit(uint256 indexed txId);
    event Approve(address indexed owner, uint256 indexed txId);
    event Revoke(address indexed owner, uint256 indexed txId);
    event Execute(uint256 indexed txId);

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
    }

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public required;

    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public approved;

    modifier onlyOwner() {
        require(isOwner[msg.sender], "not owner");
        _;
    }

    modifier txExists(uint256 _txId) {
        require(_txId < transactions.length, "tx does not exist");
        _;
    }

    modifier notApproved(uint256 _txId) {
        require(!approved[_txId][msg.sender], "tx already approved");
        _;
    }

    modifier notExecuted(uint256 _txId) {
        require(!transactions[_txId].executed, "tx already executed");
        _;
    }

    constructor(address[] memory _owners, uint256 _required) {
        require(_owners.length > 0, "owners required");
        require(_required > 0 && _required <= _owners.length, "invalid required");

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "invalid owner");
            require(!isOwner[owner], "owner not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        required = _required;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function submit(address _to, uint256 _value, bytes calldata _data) external onlyOwner {
        transactions.push(Transaction({
            to: _to,
            value: _value,
            data: _data,
            executed: false
        }));
        emit Submit(transactions.length - 1);
    }

    function approve(uint256 _txId) external onlyOwner txExists(_txId) notApproved(_txId) notExecuted(_txId) {
        approved[_txId][msg.sender] = true;
        emit Approve(msg.sender, _txId);
    }

    function getApprovalCount(uint256 _txId) public view returns (uint256 count) {
        for (uint256 i = 0; i < owners.length; i++) {
            if (approved[_txId][owners[i]]) {
                count += 1;
            }
        }
    }

    function execute(uint256 _txId) external txExists(_txId) notExecuted(_txId) {
        require(getApprovalCount(_txId) >= required, "not enough approvals");
        Transaction storage transaction = transactions[_txId];
        transaction.executed = true;
        (bool success, ) = transaction.to.call{value: transaction.value}(transaction.data);
        require(success, "tx failed");
        emit Execute(_txId);
    }

    function revoke(uint256 _txId) external onlyOwner txExists(_txId) notExecuted(_txId) {
        require(approved[_txId][msg.sender], "tx not approved");
        approved[_txId][msg.sender] = false;
        emit Revoke(msg.sender, _txId);
    }
}
`,
  },
  {
    id: 'nft',
    name: 'NFT (ERC721)',
    description: 'Basic NFT contract with minting capability. Uses OpenZeppelin.',
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MyNFT
 * @notice A basic NFT contract
 */
contract MyNFT is ERC721, Ownable {
    uint256 private _nextTokenId;
    string private _baseTokenURI;

    constructor(
        string memory name,
        string memory symbol,
        string memory baseURI
    ) ERC721(name, symbol) Ownable(msg.sender) {
        _baseTokenURI = baseURI;
    }

    /**
     * @notice Mint a new NFT
     * @param to Address to receive the NFT
     */
    function mint(address to) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }

    /**
     * @notice Set the base URI for token metadata
     */
    function setBaseURI(string memory baseURI) public onlyOwner {
        _baseTokenURI = baseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @notice Get total supply of minted tokens
     */
    function totalSupply() public view returns (uint256) {
        return _nextTokenId;
    }
}
`,
  },
];

/**
 * Get a template by ID
 */
export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find(t => t.id === id);
}

/**
 * Get the default template source
 */
export function getDefaultSource(): string {
  return TEMPLATES[0].source;
}
