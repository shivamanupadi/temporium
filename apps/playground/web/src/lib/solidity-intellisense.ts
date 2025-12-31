/**
 * Solidity intellisense provider for Monaco editor.
 * Provides autocomplete suggestions for Solidity code.
 */

import type { Monaco } from '@monaco-editor/react';
import type { languages, editor, Position } from 'monaco-editor';

// Solidity keywords
const KEYWORDS = [
  'pragma',
  'solidity',
  'import',
  'contract',
  'interface',
  'library',
  'abstract',
  'function',
  'modifier',
  'event',
  'error',
  'struct',
  'enum',
  'mapping',
  'constructor',
  'fallback',
  'receive',
  'public',
  'private',
  'internal',
  'external',
  'view',
  'pure',
  'payable',
  'virtual',
  'override',
  'returns',
  'return',
  'if',
  'else',
  'for',
  'while',
  'do',
  'break',
  'continue',
  'emit',
  'revert',
  'require',
  'assert',
  'try',
  'catch',
  'new',
  'delete',
  'using',
  'is',
  'as',
  'from',
  'storage',
  'memory',
  'calldata',
  'constant',
  'immutable',
  'indexed',
  'anonymous',
  'unchecked',
  'assembly',
];

// Solidity types
const TYPES = [
  'bool',
  'address',
  'string',
  'bytes',
  'bytes1',
  'bytes2',
  'bytes4',
  'bytes8',
  'bytes16',
  'bytes32',
  'int',
  'int8',
  'int16',
  'int32',
  'int64',
  'int128',
  'int256',
  'uint',
  'uint8',
  'uint16',
  'uint32',
  'uint64',
  'uint128',
  'uint256',
];

// Global variables and functions
const GLOBALS = [
  { label: 'msg.sender', detail: 'address', documentation: 'Sender of the message (current call)' },
  { label: 'msg.value', detail: 'uint256', documentation: 'Amount of wei sent with the message' },
  { label: 'msg.data', detail: 'bytes', documentation: 'Complete calldata' },
  {
    label: 'msg.sig',
    detail: 'bytes4',
    documentation: 'First four bytes of the calldata (function selector)',
  },
  { label: 'block.timestamp', detail: 'uint256', documentation: 'Current block timestamp' },
  { label: 'block.number', detail: 'uint256', documentation: 'Current block number' },
  { label: 'block.chainid', detail: 'uint256', documentation: 'Current chain id' },
  { label: 'block.coinbase', detail: 'address', documentation: 'Current block miner address' },
  {
    label: 'block.prevrandao',
    detail: 'uint256',
    documentation: 'Random number provided by the beacon chain',
  },
  { label: 'block.gaslimit', detail: 'uint256', documentation: 'Current block gas limit' },
  {
    label: 'tx.origin',
    detail: 'address',
    documentation: 'Sender of the transaction (full call chain)',
  },
  { label: 'tx.gasprice', detail: 'uint256', documentation: 'Gas price of the transaction' },
  { label: 'gasleft()', detail: 'uint256', documentation: 'Remaining gas' },
  { label: 'blockhash()', detail: 'bytes32', documentation: 'Hash of the given block number' },
  { label: 'keccak256()', detail: 'bytes32', documentation: 'Compute Keccak-256 hash' },
  { label: 'sha256()', detail: 'bytes32', documentation: 'Compute SHA-256 hash' },
  { label: 'ecrecover()', detail: 'address', documentation: 'Recover address from signature' },
  { label: 'abi.encode()', detail: 'bytes', documentation: 'ABI-encode the given arguments' },
  {
    label: 'abi.encodePacked()',
    detail: 'bytes',
    documentation: 'Packed encoding of the given arguments',
  },
  {
    label: 'abi.encodeWithSelector()',
    detail: 'bytes',
    documentation: 'ABI-encode with function selector',
  },
  {
    label: 'abi.encodeWithSignature()',
    detail: 'bytes',
    documentation: 'ABI-encode with function signature',
  },
  { label: 'abi.decode()', detail: 'tuple', documentation: 'ABI-decode the given data' },
];

// Common OpenZeppelin imports
const OZ_IMPORTS = [
  { path: '@openzeppelin/contracts/token/ERC20/ERC20.sol', name: 'ERC20' },
  { path: '@openzeppelin/contracts/token/ERC20/IERC20.sol', name: 'IERC20' },
  {
    path: '@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol',
    name: 'ERC20Burnable',
  },
  {
    path: '@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol',
    name: 'ERC20Pausable',
  },
  { path: '@openzeppelin/contracts/token/ERC721/ERC721.sol', name: 'ERC721' },
  { path: '@openzeppelin/contracts/token/ERC721/IERC721.sol', name: 'IERC721' },
  {
    path: '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol',
    name: 'ERC721Enumerable',
  },
  {
    path: '@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol',
    name: 'ERC721URIStorage',
  },
  { path: '@openzeppelin/contracts/token/ERC1155/ERC1155.sol', name: 'ERC1155' },
  { path: '@openzeppelin/contracts/token/ERC1155/IERC1155.sol', name: 'IERC1155' },
  { path: '@openzeppelin/contracts/access/Ownable.sol', name: 'Ownable' },
  { path: '@openzeppelin/contracts/access/AccessControl.sol', name: 'AccessControl' },
  { path: '@openzeppelin/contracts/security/ReentrancyGuard.sol', name: 'ReentrancyGuard' },
  { path: '@openzeppelin/contracts/security/Pausable.sol', name: 'Pausable' },
  { path: '@openzeppelin/contracts/utils/Counters.sol', name: 'Counters' },
  { path: '@openzeppelin/contracts/utils/Strings.sol', name: 'Strings' },
  { path: '@openzeppelin/contracts/utils/math/Math.sol', name: 'Math' },
  { path: '@openzeppelin/contracts/proxy/utils/Initializable.sol', name: 'Initializable' },
];

// Code snippets
const SNIPPETS: Array<{
  label: string;
  insertText: string;
  documentation: string;
}> = [
  {
    label: 'contract',
    insertText: `contract \${1:ContractName} {
    constructor() {
        \${2}
    }
}`,
    documentation: 'Create a new contract',
  },
  {
    label: 'interface',
    insertText: `interface \${1:IInterface} {
    \${2}
}`,
    documentation: 'Create a new interface',
  },
  {
    label: 'function',
    insertText: `function \${1:name}(\${2:params}) \${3:public} \${4:returns (\${5:type})} {
    \${6}
}`,
    documentation: 'Create a new function',
  },
  {
    label: 'function view',
    insertText: `function \${1:name}(\${2:params}) public view returns (\${3:type}) {
    \${4}
}`,
    documentation: 'Create a view function',
  },
  {
    label: 'function external',
    insertText: `function \${1:name}(\${2:params}) external {
    \${3}
}`,
    documentation: 'Create an external function',
  },
  {
    label: 'modifier',
    insertText: `modifier \${1:name}(\${2:params}) {
    \${3}
    _;
}`,
    documentation: 'Create a new modifier',
  },
  {
    label: 'event',
    insertText: `event \${1:EventName}(\${2:address indexed sender});`,
    documentation: 'Create a new event',
  },
  {
    label: 'error',
    insertText: `error \${1:ErrorName}(\${2:string message});`,
    documentation: 'Create a custom error',
  },
  {
    label: 'struct',
    insertText: `struct \${1:StructName} {
    \${2:uint256 id};
}`,
    documentation: 'Create a new struct',
  },
  {
    label: 'enum',
    insertText: `enum \${1:EnumName} {
    \${2:Value1},
    \${3:Value2}
}`,
    documentation: 'Create a new enum',
  },
  {
    label: 'mapping',
    insertText: `mapping(\${1:address} => \${2:uint256}) \${3:public} \${4:name};`,
    documentation: 'Create a mapping',
  },
  {
    label: 'require',
    insertText: `require(\${1:condition}, "\${2:error message}");`,
    documentation: 'Add a require statement',
  },
  {
    label: 'revert',
    insertText: `revert \${1:ErrorName}(\${2:args});`,
    documentation: 'Revert with custom error',
  },
  {
    label: 'emit',
    insertText: `emit \${1:EventName}(\${2:args});`,
    documentation: 'Emit an event',
  },
  {
    label: 'constructor',
    insertText: `constructor(\${1:params}) {
    \${2}
}`,
    documentation: 'Create a constructor',
  },
  {
    label: 'receive',
    insertText: `receive() external payable {
    \${1}
}`,
    documentation: 'Create receive function for ETH',
  },
  {
    label: 'fallback',
    insertText: `fallback() external payable {
    \${1}
}`,
    documentation: 'Create fallback function',
  },
  {
    label: 'pragma',
    insertText: `pragma solidity ^0.8.20;`,
    documentation: 'Add Solidity version pragma',
  },
  {
    label: 'SPDX',
    insertText: `// SPDX-License-Identifier: MIT`,
    documentation: 'Add SPDX license identifier',
  },
  {
    label: 'import oz',
    insertText: `import "@openzeppelin/contracts/\${1:token/ERC20/ERC20.sol}";`,
    documentation: 'Import OpenZeppelin contract',
  },
  {
    label: 'for loop',
    insertText: `for (uint256 i = 0; i < \${1:length}; i++) {
    \${2}
}`,
    documentation: 'Create a for loop',
  },
  {
    label: 'if else',
    insertText: `if (\${1:condition}) {
    \${2}
} else {
    \${3}
}`,
    documentation: 'Create an if-else statement',
  },
  {
    label: 'onlyOwner',
    insertText: `modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
}`,
    documentation: 'Create onlyOwner modifier',
  },
];

/**
 * Register Solidity completion provider with Monaco
 */
export function registerSolidityCompletions(monaco: Monaco): void {
  monaco.languages.registerCompletionItemProvider('solidity', {
    triggerCharacters: ['.', '@', '"', "'"],

    provideCompletionItems(model: editor.ITextModel, position: Position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const lineContent = model.getLineContent(position.lineNumber);
      const textUntilPosition = lineContent.substring(0, position.column - 1);

      const suggestions: languages.CompletionItem[] = [];

      // Check if we're in an import statement
      const isImportContext =
        textUntilPosition.includes('import') &&
        (textUntilPosition.includes('"@') || textUntilPosition.includes("'@"));

      if (isImportContext) {
        // Suggest OpenZeppelin imports
        for (const oz of OZ_IMPORTS) {
          suggestions.push({
            label: oz.path,
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: oz.path,
            detail: oz.name,
            documentation: `Import ${oz.name} from OpenZeppelin`,
            range,
          });
        }
        return { suggestions };
      }

      // Check if typing after a dot (member access)
      if (textUntilPosition.endsWith('.') || textUntilPosition.match(/\.\w*$/)) {
        const beforeDot = textUntilPosition.replace(/\.\w*$/, '');

        // msg. suggestions
        if (beforeDot.endsWith('msg')) {
          suggestions.push(
            {
              label: 'sender',
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: 'sender',
              detail: 'address',
              documentation: 'Sender of the message (current call)',
              range,
            },
            {
              label: 'value',
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: 'value',
              detail: 'uint256',
              documentation: 'Amount of wei sent with the message',
              range,
            },
            {
              label: 'data',
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: 'data',
              detail: 'bytes',
              documentation: 'Complete calldata',
              range,
            },
            {
              label: 'sig',
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: 'sig',
              detail: 'bytes4',
              documentation: 'First four bytes of the calldata',
              range,
            }
          );
          return { suggestions };
        }

        // block. suggestions
        if (beforeDot.endsWith('block')) {
          suggestions.push(
            {
              label: 'timestamp',
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: 'timestamp',
              detail: 'uint256',
              documentation: 'Current block timestamp',
              range,
            },
            {
              label: 'number',
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: 'number',
              detail: 'uint256',
              documentation: 'Current block number',
              range,
            },
            {
              label: 'chainid',
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: 'chainid',
              detail: 'uint256',
              documentation: 'Current chain id',
              range,
            },
            {
              label: 'coinbase',
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: 'coinbase',
              detail: 'address payable',
              documentation: "Current block's beneficiary address",
              range,
            },
            {
              label: 'prevrandao',
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: 'prevrandao',
              detail: 'uint256',
              documentation: 'Random number from beacon chain',
              range,
            },
            {
              label: 'gaslimit',
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: 'gaslimit',
              detail: 'uint256',
              documentation: "Current block's gas limit",
              range,
            }
          );
          return { suggestions };
        }

        // tx. suggestions
        if (beforeDot.endsWith('tx')) {
          suggestions.push(
            {
              label: 'origin',
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: 'origin',
              detail: 'address',
              documentation: 'Sender of the transaction (full call chain)',
              range,
            },
            {
              label: 'gasprice',
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: 'gasprice',
              detail: 'uint256',
              documentation: 'Gas price of the transaction',
              range,
            }
          );
          return { suggestions };
        }

        // abi. suggestions
        if (beforeDot.endsWith('abi')) {
          suggestions.push(
            {
              label: 'encode',
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: 'encode(${1})',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'bytes',
              documentation: 'ABI-encode the given arguments',
              range,
            },
            {
              label: 'encodePacked',
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: 'encodePacked(${1})',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'bytes',
              documentation: 'Packed encoding of the given arguments',
              range,
            },
            {
              label: 'encodeWithSelector',
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: 'encodeWithSelector(${1:selector}, ${2})',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'bytes',
              documentation: 'ABI-encode with function selector',
              range,
            },
            {
              label: 'encodeWithSignature',
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: 'encodeWithSignature("${1:signature}", ${2})',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'bytes',
              documentation: 'ABI-encode with function signature',
              range,
            },
            {
              label: 'decode',
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: 'decode(${1:data}, (${2:types}))',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'tuple',
              documentation: 'ABI-decode the given data',
              range,
            }
          );
          return { suggestions };
        }

        // Generic address/contract suggestions
        suggestions.push(
          {
            label: 'balance',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'balance',
            detail: 'uint256',
            documentation: 'Balance of the address in wei',
            range,
          },
          {
            label: 'code',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'code',
            detail: 'bytes',
            documentation: 'Code at the address',
            range,
          },
          {
            label: 'codehash',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'codehash',
            detail: 'bytes32',
            documentation: 'Codehash of the address',
            range,
          },
          {
            label: 'transfer',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'transfer(${1:amount})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'void',
            documentation: 'Send given amount of wei, reverts on failure',
            range,
          },
          {
            label: 'send',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'send(${1:amount})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'bool',
            documentation: 'Send given amount of wei, returns false on failure',
            range,
          },
          {
            label: 'call',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'call{value: ${1:amount}}(${2:data})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: '(bool, bytes)',
            documentation: 'Low-level call with value',
            range,
          },
          {
            label: 'delegatecall',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'delegatecall(${1:data})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: '(bool, bytes)',
            documentation: 'Low-level delegatecall',
            range,
          },
          {
            label: 'staticcall',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'staticcall(${1:data})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: '(bool, bytes)',
            documentation: 'Low-level staticcall',
            range,
          }
        );

        return { suggestions };
      }

      // Add keywords
      for (const keyword of KEYWORDS) {
        suggestions.push({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          range,
        });
      }

      // Add types
      for (const type of TYPES) {
        suggestions.push({
          label: type,
          kind: monaco.languages.CompletionItemKind.TypeParameter,
          insertText: type,
          range,
        });
      }

      // Add global variables
      for (const global of GLOBALS) {
        suggestions.push({
          label: global.label,
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: global.label,
          detail: global.detail,
          documentation: global.documentation,
          range,
        });
      }

      // Add snippets
      for (const snippet of SNIPPETS) {
        suggestions.push({
          label: snippet.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: snippet.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: snippet.documentation,
          range,
        });
      }

      return { suggestions };
    },
  });
}
