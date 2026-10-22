// queries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { VocabularyScheme, ConceptNode, ImportResponse, VocabPatchBody, VocabPatchResult } from './types';
import { workspaceCwd } from '../../dsh-workspace';

const fetchSchemes = async (): Promise<VocabularyScheme[]> => {
  const res = await fetch('/api/vocabulary/schemes');
  if (!res.ok) throw new Error('Failed to fetch vocabularies');
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((row: { uri?: string; label?: string; title?: string; description?: string }) => ({
    uri: String(row.uri || ''),
    label: String(row.label || row.title || row.uri || ''),
    description: row.description,
  }));
};

const fetchHierarchy = async (schemeUri: string): Promise<ConceptNode[]> => {
  const res = await fetch(`/api/vocabulary/hierarchy?scheme=${encodeURIComponent(schemeUri)}`);
  if (!res.ok) throw new Error('Failed to fetch hierarchy');
  return res.json();
};

// Updated to return the ImportResponse
const importVocabulary = async (file: File): Promise<ImportResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/vocabulary/import', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to import vocabulary');
  return res.json(); 
};

const patchVocabulary = async (body: VocabPatchBody): Promise<VocabPatchResult> => {
  const res = await fetch('/api/vocabulary/concepts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({})) as VocabPatchResult;
  if (!res.ok || data.ok === false) {
    const err = new Error(String(data.error || 'SAVE_FAILED'));
    throw err;
  }
  return data;
};

export const useVocabularies = () => {
  return useQuery({ 
    queryKey: ['vocabularies', workspaceCwd()], 
    queryFn: fetchSchemes 
  });
};

export const useConceptHierarchy = (schemeUri: string | undefined) => {
  return useQuery({
    queryKey: ['hierarchy', workspaceCwd(), schemeUri],
    queryFn: () => fetchHierarchy(schemeUri!),
    enabled: !!schemeUri, 
  });
};

export const useImportVocabulary = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importVocabulary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabularies'] });
      queryClient.invalidateQueries({ queryKey: ['hierarchy'] });
    },
  });
};

export const usePatchVocabulary = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patchVocabulary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabularies'] });
      queryClient.invalidateQueries({ queryKey: ['hierarchy'] });
    },
  });
};
