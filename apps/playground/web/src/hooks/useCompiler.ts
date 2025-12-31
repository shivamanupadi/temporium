/**
 * Compiler hook for Solidity compilation.
 * Uses React Query mutation for async compilation with caching.
 */

import { useState, useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { compile, compileSource, getSolcVersion, type CompileResult } from '@/lib/compiler';

interface UseCompilerReturn {
  compile: (source: string) => Promise<CompileResult>;
  compileFiles: (files: Record<string, string>, mainFile: string) => Promise<CompileResult>;
  result: CompileResult | null;
  isCompiling: boolean;
  error: Error | null;
  solcVersion: string | null;
  reset: () => void;
}

/**
 * Hook for compiling Solidity source code.
 *
 * @example
 * ```tsx
 * const { compile, result, isCompiling, error } = useCompiler();
 *
 * const handleCompile = async () => {
 *   const result = await compile(sourceCode);
 *   if (result.success) {
 *     console.log('Contracts:', result.contracts);
 *   } else {
 *     console.error('Errors:', result.errors);
 *   }
 * };
 * ```
 */
export function useCompiler(): UseCompilerReturn {
  const [result, setResult] = useState<CompileResult | null>(null);
  const [solcVersion, setSolcVersion] = useState<string | null>(null);

  // Mutation for single file compilation
  const compileMutation = useMutation({
    mutationFn: async (source: string) => {
      // Fetch solc version on first compile
      if (!solcVersion) {
        const version = await getSolcVersion();
        setSolcVersion(version);
      }
      return compileSource(source);
    },
    onSuccess: data => {
      setResult(data);
    },
  });

  // Mutation for multi-file compilation
  const compileFilesMutation = useMutation({
    mutationFn: async ({
      files,
      mainFile,
    }: {
      files: Record<string, string>;
      mainFile: string;
    }) => {
      if (!solcVersion) {
        const version = await getSolcVersion();
        setSolcVersion(version);
      }
      return compile(files, mainFile);
    },
    onSuccess: data => {
      setResult(data);
    },
  });

  const compileSourceCode = useCallback(
    async (source: string) => {
      return compileMutation.mutateAsync(source);
    },
    [compileMutation]
  );

  const compileFiles = useCallback(
    async (files: Record<string, string>, mainFile: string) => {
      return compileFilesMutation.mutateAsync({ files, mainFile });
    },
    [compileFilesMutation]
  );

  // Use refs for stable reset function identity
  const compileMutationRef = useRef(compileMutation);
  const compileFilesMutationRef = useRef(compileFilesMutation);
  compileMutationRef.current = compileMutation;
  compileFilesMutationRef.current = compileFilesMutation;

  const reset = useCallback(() => {
    setResult(null);
    compileMutationRef.current.reset();
    compileFilesMutationRef.current.reset();
  }, []);

  return {
    compile: compileSourceCode,
    compileFiles,
    result,
    isCompiling: compileMutation.isPending || compileFilesMutation.isPending,
    error: compileMutation.error || compileFilesMutation.error,
    solcVersion,
    reset,
  };
}
