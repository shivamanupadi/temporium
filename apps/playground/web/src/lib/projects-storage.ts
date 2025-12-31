/**
 * IndexedDB storage for projects using Dexie.
 * Supports folders and files with path-based structure.
 */

import Dexie, { type EntityTable } from 'dexie';

export interface ProjectFile {
  path: string; // e.g., "contracts/Token.sol" or "interfaces/IERC20.sol"
  content: string;
}

export interface Project {
  id: string;
  name: string;
  files: ProjectFile[];
  createdAt: Date;
  updatedAt: Date;
}

// Tree node types for UI
export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file';
}

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  type: 'folder';
  children: TreeNode[];
}

export type TreeNode = FileNode | FolderNode;

// Define the database
const db = new Dexie('PlaygroundDB') as Dexie & {
  projects: EntityTable<Project, 'id'>;
};

// Define schema
db.version(1).stores({
  projects: 'id, name, createdAt, updatedAt',
});

/**
 * Generate a unique project ID
 */
export function generateProjectId(): string {
  return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique node ID
 */
export function generateNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new project with default structure
 */
export async function createProject(name: string, initialSource?: string): Promise<Project> {
  const now = new Date();
  const project: Project = {
    id: generateProjectId(),
    name,
    files: [
      {
        path: 'contracts/Contract.sol',
        content: initialSource ?? '',
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  await db.projects.add(project);
  return project;
}

/**
 * Get all projects
 */
export async function getProjects(): Promise<Project[]> {
  return db.projects.orderBy('updatedAt').reverse().toArray();
}

/**
 * Get a project by ID
 */
export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

/**
 * Update a project
 */
export async function updateProject(
  id: string,
  updates: Partial<Omit<Project, 'id' | 'createdAt'>>
): Promise<void> {
  await db.projects.update(id, {
    ...updates,
    updatedAt: new Date(),
  });
}

/**
 * Create a new file in a project
 */
export async function createFile(
  projectId: string,
  path: string,
  content: string = ''
): Promise<void> {
  const project = await db.projects.get(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // Check if file already exists
  if (project.files.some(f => f.path === path)) {
    throw new Error(`File ${path} already exists`);
  }

  project.files.push({ path, content });
  await db.projects.update(projectId, {
    files: project.files,
    updatedAt: new Date(),
  });
}

/**
 * Update file content
 */
export async function updateFileContent(
  projectId: string,
  path: string,
  content: string
): Promise<void> {
  const project = await db.projects.get(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const fileIndex = project.files.findIndex(f => f.path === path);
  if (fileIndex === -1) {
    throw new Error(`File ${path} not found`);
  }

  project.files[fileIndex].content = content;
  await db.projects.update(projectId, {
    files: project.files,
    updatedAt: new Date(),
  });
}

/**
 * Rename a file or folder
 */
export async function renamePath(
  projectId: string,
  oldPath: string,
  newPath: string
): Promise<void> {
  const project = await db.projects.get(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // Update all files that start with the old path
  project.files = project.files.map(f => {
    if (f.path === oldPath) {
      return { ...f, path: newPath };
    }
    if (f.path.startsWith(oldPath + '/')) {
      return { ...f, path: f.path.replace(oldPath, newPath) };
    }
    return f;
  });

  await db.projects.update(projectId, {
    files: project.files,
    updatedAt: new Date(),
  });
}

/**
 * Delete a file or folder (and all contents)
 */
export async function deletePath(projectId: string, path: string): Promise<void> {
  const project = await db.projects.get(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // Remove the file or all files in the folder
  project.files = project.files.filter(f => f.path !== path && !f.path.startsWith(path + '/'));

  await db.projects.update(projectId, {
    files: project.files,
    updatedAt: new Date(),
  });
}

/**
 * Update project source code (legacy support)
 */
export async function updateProjectSource(
  id: string,
  fileName: string,
  content: string
): Promise<void> {
  const project = await db.projects.get(id);
  if (!project) {
    throw new Error(`Project ${id} not found`);
  }

  // Find file by name (could be any path ending with fileName)
  const fileIndex = project.files.findIndex(
    f => f.path === fileName || f.path.endsWith('/' + fileName)
  );

  if (fileIndex !== -1) {
    project.files[fileIndex].content = content;
  } else {
    // Add as new file in contracts folder
    project.files.push({ path: `contracts/${fileName}`, content });
  }

  await db.projects.update(id, {
    files: project.files,
    updatedAt: new Date(),
  });
}

/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id);
}

/**
 * Rename a project
 */
export async function renameProject(id: string, newName: string): Promise<void> {
  await db.projects.update(id, {
    name: newName,
    updatedAt: new Date(),
  });
}

/**
 * Convert flat file list to tree structure for UI
 * @param files - List of project files
 * @param emptyFolders - Optional list of empty folder paths to include
 */
export function filesToTree(files: ProjectFile[], emptyFolders: string[] = []): TreeNode[] {
  const root: TreeNode[] = [];
  const folderMap = new Map<string, FolderNode>();

  // Helper to ensure folder exists in tree
  const ensureFolder = (folderPath: string): FolderNode => {
    let folder = folderMap.get(folderPath);
    if (folder) return folder;

    const parts = folderPath.split('/');
    let currentPath = '';
    let currentChildren = root;

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      folder = folderMap.get(currentPath);
      if (!folder) {
        folder = {
          id: generateNodeId(),
          name: part,
          path: currentPath,
          type: 'folder',
          children: [],
        };
        folderMap.set(currentPath, folder);
        currentChildren.push(folder);
      }
      currentChildren = folder.children;
    }

    return folder!;
  };

  // First, create all empty folders
  for (const folderPath of emptyFolders) {
    ensureFolder(folderPath);
  }

  // Sort files by path for consistent ordering
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sortedFiles) {
    const parts = file.path.split('/');
    let currentPath = '';
    let currentChildren = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (isLast) {
        // It's a file
        currentChildren.push({
          id: generateNodeId(),
          name: part,
          path: file.path,
          type: 'file',
        });
      } else {
        // It's a folder
        let folder = folderMap.get(currentPath);
        if (!folder) {
          folder = {
            id: generateNodeId(),
            name: part,
            path: currentPath,
            type: 'folder',
            children: [],
          };
          folderMap.set(currentPath, folder);
          currentChildren.push(folder);
        }
        currentChildren = folder.children;
      }
    }
  }

  // Sort children: folders first, then files, alphabetically
  const sortChildren = (nodes: TreeNode[]): void => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.type === 'folder') {
        sortChildren(node.children);
      }
    }
  };

  sortChildren(root);

  return root;
}

/**
 * Get all folder paths from files
 */
export function getFolderPaths(files: ProjectFile[]): string[] {
  const folders = new Set<string>();

  for (const file of files) {
    const parts = file.path.split('/');
    let currentPath = '';

    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      folders.add(currentPath);
    }
  }

  return Array.from(folders).sort();
}

/**
 * Convert files to a map for compiler
 */
export function filesToMap(files: ProjectFile[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const file of files) {
    map[file.path] = file.content;
  }
  return map;
}
