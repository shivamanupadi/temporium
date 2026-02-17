import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import type { ProjectFile } from './useProjects';

export function useCreateFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, path, content }: { projectId: string; path: string; content?: string }) =>
      apiPost<ProjectFile>(`/v1/projects/${projectId}/files`, { path, content: content || '' }),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });
}

export function useUpdateFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      fileId,
      path,
      content,
    }: {
      projectId: string;
      fileId: string;
      path?: string;
      content?: string;
    }) => apiPatch<ProjectFile>(`/v1/projects/${projectId}/files/${fileId}`, { path, content }),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });
}

export function useDeleteFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, fileId }: { projectId: string; fileId: string }) =>
      apiDelete(`/v1/projects/${projectId}/files/${fileId}`),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });
}
