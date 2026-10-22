/**
 * src/workspaces/VocabularyWorkspace/Sidebar.tsx
 *
 * Left sidebar for the Vocabulary workspace.
 * - Lists available SKOS ConceptSchemes
 * - Shows the concept hierarchy tree for the active scheme
 * - Includes the import dropzone
 */
import { useEffect, useState } from 'react';
import { useVocabularies, useConceptHierarchy } from './queries';
import { ConceptTree } from './ConceptTree';
import { ImportDropzone } from './ImportDropzone';
import type { ConceptNode, VocabularyScheme } from './types';

interface SidebarProps {
  onSelectConcept: (concept: ConceptNode) => void;
  onAddConcept?: () => void;
  onSchemeLabel?: (label: string) => void;
}

export function Sidebar({ onSelectConcept, onAddConcept, onSchemeLabel }: SidebarProps) {
  const { data: schemes = [], isLoading: schemesLoading } = useVocabularies();
  const [activeScheme, setActiveScheme] = useState<string | undefined>();

  const selectedSchemeUri = activeScheme ?? schemes[0]?.uri;
  const selectedScheme = schemes.find((row) => row.uri === selectedSchemeUri);

  useEffect(() => {
    onSchemeLabel?.(selectedScheme?.label || '');
  }, [selectedScheme?.label, onSchemeLabel]);

  const {
    data: hierarchy = [],
    isLoading: treeLoading,
  } = useConceptHierarchy(selectedSchemeUri);

  return (
    <div style={{
      width: 340, display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))',
      backgroundColor: 'var(--dsw-alias-bg-layer-1, #f6f8fa)', overflow: 'hidden',
      color: 'var(--dsw-alias-label-primary, #1f2328)',
    }}>
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))',
      }}>
        <h2 style={{ fontSize: 18, color: 'var(--dsw-alias-label-primary, #1f2328)', margin: '0 0 4px 0', fontWeight: 600 }}>
          词表 / 本体
        </h2>
        <p style={{ color: 'var(--dsw-alias-label-secondary, #3d444d)', fontSize: 13, margin: 0 }}>
          {schemes.length
            ? `${schemes.length} 个词汇方案`
            : '没有分类表'}
        </p>
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))' }}>
        {schemesLoading ? (
          <div style={{ color: 'var(--dsw-alias-label-secondary, #3d444d)', fontSize: 13 }}>正在加载方案…</div>
        ) : schemes.length === 0 ? (
          <div style={{ color: 'var(--dsw-alias-label-secondary, #3d444d)', fontSize: 13 }}>
            还没有分类表。需要的话在下面导入一份。
          </div>
        ) : (
          <select
            value={selectedSchemeUri || ''}
            onChange={(e) => setActiveScheme(e.target.value)}
            style={{
              width: '100%', appearance: 'none',
              background: 'var(--dsw-alias-bg-base, #ffffff)',
              border: '1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))',
              color: 'var(--dsw-alias-label-primary, #1f2328)', padding: '8px 12px',
              borderRadius: 6, fontSize: 13, cursor: 'pointer',
              outline: 'none',
            }}
          >
            {schemes.map((s: VocabularyScheme) => (
              <option key={s.uri} value={s.uri} style={{ background: 'var(--dsw-alias-bg-base, #ffffff)' }}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div style={{
        flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {treeLoading ? (
          <div style={{ padding: 20, color: 'var(--dsw-alias-label-secondary, #3d444d)', fontSize: 13, textAlign: 'center' }}>
            正在加载层级…
          </div>
        ) : hierarchy.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--dsw-alias-label-secondary, #3d444d)', fontSize: 13, textAlign: 'center' }}>
            {selectedSchemeUri
              ? '这个方案里没有概念。'
              : '请选择一个方案浏览概念。'}
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ConceptTree data={hierarchy} onSelectConcept={onSelectConcept} />
          </div>
        )}
      </div>

      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))',
      }}>
        {onAddConcept ? (
          <button
            type="button"
            onClick={onAddConcept}
            style={{
              width: '100%', marginBottom: 10,
              background: 'var(--dsw-alias-bg-base, #ffffff)',
              color: 'var(--dsw-alias-label-primary, #1f2328)',
              border: '1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))',
              padding: '8px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
            }}
          >
            新增型
          </button>
        ) : null}
        <ImportDropzone />
      </div>
    </div>
  );
}
