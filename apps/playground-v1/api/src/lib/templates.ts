interface TemplateFile {
  path: string;
  content: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  files: TemplateFile[];
}

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank Project',
    description: 'Empty project with a single Solidity file',
    icon: 'file',
    files: [
      {
        path: 'contracts/Contract.sol',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MyContract {
    // Write your contract here
}
`,
      },
    ],
  },
  {
    id: 'simple-storage',
    name: 'Simple Storage',
    description: 'Basic storage contract with get/set functions',
    icon: 'database',
    files: [
      {
        path: 'contracts/SimpleStorage.sol',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract SimpleStorage {
    uint256 private _value;

    event ValueChanged(uint256 newValue);

    function store(uint256 value) public {
        _value = value;
        emit ValueChanged(value);
    }

    function retrieve() public view returns (uint256) {
        return _value;
    }
}
`,
      },
    ],
  },
  {
    id: 'erc20',
    name: 'ERC-20 Token',
    description: 'Standard ERC-20 token with mint and burn',
    icon: 'coins',
    files: [
      {
        path: 'contracts/Token.sol',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Token is ERC20, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
`,
      },
    ],
  },
  {
    id: 'erc721',
    name: 'ERC-721 NFT',
    description: 'Standard NFT collection contract',
    icon: 'image',
    files: [
      {
        path: 'contracts/NFT.sol',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFT is ERC721, Ownable {
    uint256 private _nextTokenId;

    constructor(
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) Ownable(msg.sender) {}

    function mint(address to) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        return tokenId;
    }
}
`,
      },
    ],
  },
  {
    id: 'multisig',
    name: 'Multi-Sig Wallet',
    description: 'Multi-signature wallet with configurable owners',
    icon: 'shield',
    files: [
      {
        path: 'contracts/MultiSig.sol',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MultiSig {
    event Deposit(address indexed sender, uint256 amount);
    event Submit(uint256 indexed txId);
    event Approve(address indexed owner, uint256 indexed txId);
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
        require(isOwner[msg.sender], "Not owner");
        _;
    }

    constructor(address[] memory _owners, uint256 _required) {
        require(_owners.length > 0, "Owners required");
        require(_required > 0 && _required <= _owners.length, "Invalid required");

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid owner");
            require(!isOwner[owner], "Duplicate owner");
            isOwner[owner] = true;
            owners.push(owner);
        }
        required = _required;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function submit(address _to, uint256 _value, bytes calldata _data) external onlyOwner {
        transactions.push(Transaction({to: _to, value: _value, data: _data, executed: false}));
        emit Submit(transactions.length - 1);
    }

    function approve(uint256 _txId) external onlyOwner {
        require(!approved[_txId][msg.sender], "Already approved");
        approved[_txId][msg.sender] = true;
        emit Approve(msg.sender, _txId);
    }

    function execute(uint256 _txId) external onlyOwner {
        Transaction storage txn = transactions[_txId];
        require(!txn.executed, "Already executed");

        uint256 count;
        for (uint256 i = 0; i < owners.length; i++) {
            if (approved[_txId][owners[i]]) count++;
        }
        require(count >= required, "Not enough approvals");

        txn.executed = true;
        (bool ok, ) = txn.to.call{value: txn.value}(txn.data);
        require(ok, "Execution failed");
        emit Execute(_txId);
    }
}
`,
      },
    ],
  },
];

export function getTemplateFiles(templateId: string): TemplateFile[] {
  const template = TEMPLATES.find(t => t.id === templateId);
  return template?.files ?? [];
}
