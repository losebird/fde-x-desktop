export interface VocabularyScheme {
  uri: string;
  label: string;
  description?: string;
}

export interface VocabClue {
  say?: string[];
  keys?: string[];
  values?: string[];
  dateBefore?: string[];
  dateAfter?: string[];
  role?: string;
  not?: boolean;
}

export interface VocabRelation {
  from?: string;
  to?: string;
  field?: string;
}

export interface ConceptNode {
  uri: string;
  pref_label: string;
  alt_labels: string[];
  description?: string;
  notation?: string;
  scheme_uri?: string;
  parent_uri?: string;
  children?: ConceptNode[] | null;
  fields?: string[];
  can?: string[];
  resource?: string;
  ticketField?: string;
  catalogVersion?: string;
  clues?: VocabClue[];
  relations?: VocabRelation[];
}

export interface ImportResponse {
  status: string;
  filename?: string | null;
  nodes_added: number;
  edges_added: number;
  format?: string;
}

export interface VocabPatchBody {
  name?: string;
  concepts: Array<{
    id: string;
    label: string;
    fields?: string[];
    can?: string[];
    resource?: string;
    ticketField?: string;
    catalogVersion?: string;
    clues?: VocabClue[];
    relations?: VocabRelation[];
  }>;
}

export interface VocabPatchResult {
  ok?: boolean;
  error?: string;
  patched?: number;
  concepts?: number;
  skipped?: number;
  scheme?: string;
  name?: string;
}

export function emptyConcept(schemeUri?: string): ConceptNode {
  return {
    uri: '',
    pref_label: '',
    alt_labels: [],
    scheme_uri: schemeUri,
    fields: [],
    can: [],
    clues: [],
    children: [],
  };
}

export function conceptIdFromUri(uri: string): string {
  const raw = String(uri || '');
  if (raw.includes('#')) return raw.slice(raw.lastIndexOf('#') + 1);
  return raw;
}
