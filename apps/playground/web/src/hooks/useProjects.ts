/**
 * Hook for project management with React Query.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import {
  getProjects,
  getProject,
  createProject,
  updateProjectSource,
  deleteProject,
  renameProject,
  type Project,
} from '@/lib/projects-storage';
import { DEFAULT_CONTRACT } from '@/lib/constants';

const PROJECTS_KEY = ['projects'];

/**
 * Get all projects
 */
export function useProjects(): UseQueryResult<Project[]> {
  return useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: getProjects,
  });
}

/**
 * Get a single project by ID
 */
export function useProject(id: string | undefined): UseQueryResult<Project | undefined> {
  return useQuery({
    queryKey: [...PROJECTS_KEY, id],
    queryFn: () => (id ? getProject(id) : undefined),
    enabled: !!id,
  });
}

/**
 * Create a new project
 */
export function useCreateProject(): UseMutationResult<
  Project,
  Error,
  { name: string; initialSource?: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, initialSource }: { name: string; initialSource?: string }) => {
      return createProject(name, initialSource ?? DEFAULT_CONTRACT);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}

/**
 * Update project source code
 */
export function useUpdateProjectSource(): UseMutationResult<
  void,
  Error,
  { id: string; fileName: string; content: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      fileName,
      content,
    }: {
      id: string;
      fileName: string;
      content: string;
    }) => {
      await updateProjectSource(id, fileName, content);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [...PROJECTS_KEY, id] });
    },
  });
}

/**
 * Rename a project
 */
export function useRenameProject(): UseMutationResult<void, Error, { id: string; name: string }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await renameProject(id, name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}

/**
 * Delete a project
 */
export function useDeleteProject(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteProject(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}
