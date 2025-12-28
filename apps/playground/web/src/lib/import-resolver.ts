/**
 * Import resolver for Solidity contracts.
 * Resolves OpenZeppelin and other npm imports from CDN.
 */

const importCache = new Map<string, string>();

const CDN_MAPPINGS: Record<string, string> = {
  '@openzeppelin/contracts': 'https://unpkg.com/@openzeppelin/contracts@5.0.0',
  '@openzeppelin/contracts-upgradeable':
    'https://unpkg.com/@openzeppelin/contracts-upgradeable@5.0.0',
};

/**
 * Synchronously resolve an import path to its contents.
 * Required by solc.js which uses a synchronous callback.
 */
export function resolveImport(path: string): { contents: string } | { error: string } {
  // Check cache first
  if (importCache.has(path)) {
    return { contents: importCache.get(path)! };
  }

  // Resolve OpenZeppelin and other npm imports
  for (const [prefix, cdnUrl] of Object.entries(CDN_MAPPINGS)) {
    if (path.startsWith(prefix)) {
      const relativePath = path.slice(prefix.length);
      const url = `${cdnUrl}${relativePath}`;

      try {
        // Synchronous fetch (solc requires sync callback)
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.send();

        if (xhr.status === 200) {
          importCache.set(path, xhr.responseText);
          return { contents: xhr.responseText };
        }

        return { error: `Failed to fetch ${url}: ${xhr.status}` };
      } catch (err) {
        return { error: `Failed to fetch ${url}: ${String(err)}` };
      }
    }
  }

  return { error: `Cannot resolve import: ${path}` };
}

/**
 * Asynchronously prefetch imports before compilation.
 * This improves UX by parallelizing import fetching.
 */
export async function prefetchImports(source: string): Promise<void> {
  // Extract import statements
  const importRegex = /import\s+.*?["'](.+?)["']/g;
  const imports: string[] = [];
  let match;

  while ((match = importRegex.exec(source)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith('@') && !importCache.has(importPath)) {
      imports.push(importPath);
    }
  }

  // Fetch all imports in parallel
  await Promise.all(
    imports.map(async path => {
      for (const [prefix, cdnUrl] of Object.entries(CDN_MAPPINGS)) {
        if (path.startsWith(prefix)) {
          const relativePath = path.slice(prefix.length);
          const url = `${cdnUrl}${relativePath}`;

          try {
            const response = await fetch(url);
            if (response.ok) {
              const content = await response.text();
              importCache.set(path, content);

              // Recursively prefetch nested imports
              await prefetchImports(content);
            }
          } catch {
            // Errors will be handled during actual compilation
          }
        }
      }
    })
  );
}

/**
 * Clear the import cache. Useful for testing or forcing refetch.
 */
export function clearImportCache(): void {
  importCache.clear();
}

/**
 * Get the current size of the import cache.
 */
export function getImportCacheSize(): number {
  return importCache.size;
}
