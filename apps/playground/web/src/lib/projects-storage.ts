/**
 * IndexedDB storage for projects using Dexie.
 */

import Dexie, { type EntityTable } from 'dexie';

export interface ProjectFile {
  name: string;
  content: string;
}

export interface Project {
  id: string;
  name: string;
  files: ProjectFile[];
  createdAt: Date;
  updatedAt: Date;
}

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
 * Create a new project
 */
export async function createProject(name: string, initialSource?: string): Promise<Project> {
  const now = new Date();
  const project: Project = {
    id: generateProjectId(),
    name,
    files: [
      {
        name: 'Contract.sol',
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
 * Update project source code
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

  const files = project.files.map(f => (f.name === fileName ? { ...f, content } : f));

  // Add file if it doesn't exist
  if (!files.some(f => f.name === fileName)) {
    files.push({ name: fileName, content });
  }

  await db.projects.update(id, {
    files,
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
