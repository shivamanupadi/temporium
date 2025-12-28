/**
 * Solidity compiler wrapper using solc.js loaded from CDN.
 * Provides browser-based compilation with import resolution.
 */

import type { Abi } from 'viem';
import { resolveImport, prefetchImports } from './import-resolver';

export interface CompileError {
  severity: 'error' | 'warning';
  message: string;
  formattedMessage: string;
  sourceLocation?: {
    file: string;
    start: number;
    end: number;
  };
}

export interface CompiledContract {
  name: string;
  abi: Abi;
  bytecode: `0x${string}`;
}

export interface CompileResult {
  success: boolean;
  contracts: CompiledContract[];
  errors: CompileError[];
  warnings: CompileError[];
}

interface SolcOutput {
  errors?: Array<{
    severity: string;
    message: string;
    formattedMessage: string;
    sourceLocation?: {
      file: string;
      start: number;
      end: number;
    };
  }>;
  contracts?: Record<
    string,
    Record<
      string,
      {
        abi: Abi;
        evm: {
          bytecode: {
            object: string;
          };
        };
      }
    >
  >;
}

// Solc version and CDN URL
const SOLC_VERSION = '0.8.28';
const SOLC_CDN_URL = `https://binaries.soliditylang.org/bin/soljson-v${SOLC_VERSION}+commit.7893614a.js`;

interface SolcWrapper {
  compile: (input: string) => Promise<string>;
  version: () => string;
}

// Cached solc instance
let solcInstance: SolcWrapper | null = null;
let solcVersionStr: string | null = null;

/**
 * Load solc from CDN using a Web Worker to avoid blocking the main thread
 */
async function loadSolc(): Promise<SolcWrapper> {
  if (solcInstance) {
    return solcInstance;
  }

  return new Promise((resolve, reject) => {
    // Create a blob URL for the worker
    const workerCode = `
      importScripts('${SOLC_CDN_URL}');
      self.onmessage = function(e) {
        if (e.data.type === 'compile') {
          const result = Module.cwrap('solidity_compile', 'string', ['string', 'number', 'number'])(e.data.input, 0, 0);
          self.postMessage({ type: 'result', result });
        } else if (e.data.type === 'version') {
          const version = Module.cwrap('solidity_version', 'string', [])();
          self.postMessage({ type: 'version', version });
        }
      };
      self.postMessage({ type: 'ready' });
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    worker.onmessage = (e): void => {
      if (e.data.type === 'ready') {
        // Get version first
        worker.postMessage({ type: 'version' });
      } else if (e.data.type === 'version') {
        solcVersionStr = e.data.version;

        // Create a wrapper that uses the worker
        solcInstance = {
          compile: (input: string) => {
            return new Promise<string>(resolveCompile => {
              const handler = (ev: MessageEvent): void => {
                if (ev.data.type === 'result') {
                  worker.removeEventListener('message', handler);
                  resolveCompile(ev.data.result);
                }
              };
              worker.addEventListener('message', handler);
              worker.postMessage({ type: 'compile', input });
            });
          },
          version: () => solcVersionStr || SOLC_VERSION,
        };

        resolve(solcInstance);
      }
    };

    worker.onerror = err => {
      URL.revokeObjectURL(workerUrl);
      reject(new Error(`Failed to load Solidity compiler: ${err.message}`));
    };
  });
}

/**
 * Compile Solidity source code.
 *
 * @param files - Map of filename to source code
 * @param mainFile - The main file to compile (for determining output)
 * @returns Compilation result with contracts, errors, and warnings
 */
export async function compile(
  files: Record<string, string>,
  _mainFile: string
): Promise<CompileResult> {
  const solc = await loadSolc();

  // Prefetch imports for better UX
  for (const source of Object.values(files)) {
    await prefetchImports(source);
  }

  // Resolve all imports upfront since we can't use callbacks with the worker
  const allFiles = { ...files };
  await resolveAllImports(files, allFiles);

  const input = {
    language: 'Solidity',
    sources: Object.fromEntries(
      Object.entries(allFiles).map(([name, content]) => [name, { content }])
    ),
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object'],
        },
      },
    },
  };

  // Compile
  const outputString = await solc.compile(JSON.stringify(input));

  const output: SolcOutput = JSON.parse(outputString);

  const errors: CompileError[] = [];
  const warnings: CompileError[] = [];

  // Parse errors and warnings
  for (const error of output.errors ?? []) {
    const parsed: CompileError = {
      severity: error.severity as 'error' | 'warning',
      message: error.message,
      formattedMessage: error.formattedMessage,
      sourceLocation: error.sourceLocation,
    };

    if (error.severity === 'error') {
      errors.push(parsed);
    } else {
      warnings.push(parsed);
    }
  }

  // Extract contracts
  const contracts: CompiledContract[] = [];

  if (output.contracts) {
    for (const [, fileContracts] of Object.entries(output.contracts)) {
      for (const [name, contract] of Object.entries(fileContracts)) {
        const bytecodeHex = contract.evm.bytecode.object;

        // Skip contracts with no bytecode (interfaces, abstract contracts)
        if (!bytecodeHex || bytecodeHex.length === 0) {
          continue;
        }

        contracts.push({
          name,
          abi: contract.abi,
          bytecode: `0x${bytecodeHex}`,
        });
      }
    }
  }

  return {
    success: errors.length === 0,
    contracts,
    errors,
    warnings,
  };
}

/**
 * Resolve all imports recursively and add them to the files object
 */
async function resolveAllImports(
  files: Record<string, string>,
  allFiles: Record<string, string>,
  resolved = new Set<string>()
): Promise<void> {
  const importRegex = /import\s+.*?["'](.+?)["']/g;

  for (const [, content] of Object.entries(files)) {
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];

      if (resolved.has(importPath)) continue;
      resolved.add(importPath);

      // Only resolve external imports (starting with @)
      if (importPath.startsWith('@')) {
        const result = resolveImport(importPath);
        if ('contents' in result) {
          allFiles[importPath] = result.contents;
          // Recursively resolve imports in the imported file
          await resolveAllImports({ [importPath]: result.contents }, allFiles, resolved);
        }
      }
    }
  }
}

/**
 * Compile a single file with default filename.
 * Convenience method for simple single-file contracts.
 */
export async function compileSource(source: string): Promise<CompileResult> {
  return compile({ 'Contract.sol': source }, 'Contract.sol');
}

/**
 * Get the solc version being used.
 */
export async function getSolcVersion(): Promise<string> {
  if (solcVersionStr) {
    return solcVersionStr;
  }
  const solc = await loadSolc();
  return solc.version();
}
