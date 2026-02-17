import { useState, useCallback, useRef } from 'react';

export interface CompilationError {
  severity: 'error' | 'warning' | 'info';
  message: string;
  formattedMessage?: string;
  sourceLocation?: {
    file: string;
    start: number;
    end: number;
  };
}

export interface CompiledContract {
  name: string;
  abi: any[];
  bytecode: string;
  deployedBytecode: string;
}

export interface CompileResult {
  success: boolean;
  errors: CompilationError[];
  contracts: CompiledContract[];
  output?: string;
}

const SOLC_CDN_URL =
  'https://binaries.soliditylang.org/bin/soljson-v0.8.28+commit.7893614a.js';

// Persistent worker instance (reused across compiles)
let worker: Worker | null = null;
let workerReady = false;
let workerReadyPromise: Promise<void> | null = null;

function getWorker(): Promise<Worker> {
  if (worker && workerReady) return Promise.resolve(worker);
  if (workerReadyPromise && worker) return workerReadyPromise.then(() => worker!);

  // Create a classic worker via Blob URL that uses importScripts
  const workerCode = `
    importScripts('${SOLC_CDN_URL}');

    var compile = Module.cwrap('solidity_compile', 'string', ['string', 'number', 'number']);
    var version = Module.cwrap('solidity_version', 'string', []);

    self.postMessage({ type: 'ready', version: version() });

    self.onmessage = function(e) {
      if (e.data.type === 'compile') {
        try {
          var result = compile(e.data.input, 0, 0);
          self.postMessage({ type: 'result', result: result });
        } catch (err) {
          self.postMessage({ type: 'error', error: err.message || 'Compilation failed' });
        }
      }
    };
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  worker = new Worker(url);

  workerReadyPromise = new Promise<void>((resolve, reject) => {
    const w = worker!;
    const onMessage = (e: MessageEvent) => {
      if (e.data.type === 'ready') {
        workerReady = true;
        w.removeEventListener('message', onMessage);
        w.removeEventListener('error', onError);
        resolve();
      }
    };
    const onError = (e: ErrorEvent) => {
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      worker = null;
      workerReady = false;
      workerReadyPromise = null;
      reject(new Error(`Failed to load Solidity compiler: ${e.message}`));
    };
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
  });

  return workerReadyPromise.then(() => worker!);
}

/**
 * Resolve all imports recursively and add them to the files object.
 * Fetches OpenZeppelin contracts from CDN.
 */
async function resolveAllImports(
  files: Record<string, string>,
  allFiles: Record<string, string>,
  resolved = new Set<string>()
): Promise<void> {
  const importRegex = /import\s+.*?["'](.+?)["']/g;

  for (const [filePath, content] of Object.entries(files)) {
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      let importPath = match[1];

      // Resolve relative imports
      if (importPath.startsWith('.') && filePath.startsWith('@')) {
        const parts = filePath.split('/');
        parts.pop();
        for (const part of importPath.split('/')) {
          if (part === '..') parts.pop();
          else if (part !== '.') parts.push(part);
        }
        importPath = parts.join('/');
      }

      if (resolved.has(importPath)) continue;
      resolved.add(importPath);

      if (importPath.startsWith('@openzeppelin/')) {
        const cdnPath = importPath.replace(
          '@openzeppelin/contracts',
          'https://unpkg.com/@openzeppelin/contracts@5.0.0'
        );
        try {
          const resp = await fetch(cdnPath);
          if (resp.ok) {
            const text = await resp.text();
            allFiles[importPath] = text;
            await resolveAllImports({ [importPath]: text }, allFiles, resolved);
          }
        } catch {
          // Will error during compilation
        }
      }
    }
  }
}

async function compileInWorker(
  sources: Record<string, string>
): Promise<CompileResult> {
  // Resolve all imports upfront
  const allFiles = { ...sources };
  await resolveAllImports(sources, allFiles);

  const input = {
    language: 'Solidity',
    sources: Object.fromEntries(
      Object.entries(allFiles).map(([path, content]) => [path, { content }])
    ),
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'],
        },
      },
      optimizer: { enabled: true, runs: 200 },
    },
  };

  const w = await getWorker();

  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'result') {
        w.removeEventListener('message', handler);
        try {
          const output = JSON.parse(e.data.result);
          const errors: CompilationError[] = (output.errors || []).map((e: any) => ({
            severity: e.severity,
            message: e.message,
            formattedMessage: e.formattedMessage,
            sourceLocation: e.sourceLocation,
          }));
          const hasErrors = errors.some(e => e.severity === 'error');

          const contracts: CompiledContract[] = [];
          if (output.contracts) {
            for (const [, fileContracts] of Object.entries(output.contracts)) {
              for (const [name, contract] of Object.entries(fileContracts as any)) {
                const c = contract as any;
                const bytecodeHex = c.evm?.bytecode?.object;
                if (!bytecodeHex || bytecodeHex.length === 0) continue;
                contracts.push({
                  name,
                  abi: c.abi,
                  bytecode: `0x${bytecodeHex}`,
                  deployedBytecode: `0x${c.evm?.deployedBytecode?.object || ''}`,
                });
              }
            }
          }

          resolve({
            success: !hasErrors,
            errors,
            contracts,
            output: errors.map(e => e.formattedMessage || e.message).join('\n'),
          });
        } catch (err) {
          reject(new Error('Failed to parse compiler output'));
        }
      } else if (e.data.type === 'error') {
        w.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({ type: 'compile', input: JSON.stringify(input) });
  });
}

export function useCompiler() {
  const [isCompiling, setIsCompiling] = useState(false);
  const [result, setResult] = useState<CompileResult | null>(null);

  const compile = useCallback(
    async (sources: Record<string, string>): Promise<CompileResult> => {
      setIsCompiling(true);
      try {
        const compileResult = await compileInWorker(sources);
        setResult(compileResult);
        return compileResult;
      } catch (err) {
        const errorResult: CompileResult = {
          success: false,
          errors: [
            {
              severity: 'error',
              message: err instanceof Error ? err.message : 'Compilation failed',
            },
          ],
          contracts: [],
        };
        setResult(errorResult);
        return errorResult;
      } finally {
        setIsCompiling(false);
      }
    },
    []
  );

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return { compile, isCompiling, result, clearResult };
}
