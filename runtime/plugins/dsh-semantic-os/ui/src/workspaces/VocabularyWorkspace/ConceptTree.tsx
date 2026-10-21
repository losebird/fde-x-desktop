/**
 * ConceptTree.tsx — react-arborist SKOS hierarchy viewer.
 *
 * Styled for the DSH light theme.
 */
import React from 'react';
import { Tree } from 'react-arborist';
import type { NodeRendererProps } from 'react-arborist';
import { ChevronRight, ChevronDown, Folder, FileText } from 'lucide-react';
import type { ConceptNode } from './types';

interface ConceptTreeProps {
  data: ConceptNode[];
  onSelectConcept: (concept: ConceptNode) => void;
}

export const ConceptTree: React.FC<ConceptTreeProps> = ({ data, onSelectConcept }) => {
  return (
    <div style={{
      height: '100%', width: '100%',
      backgroundColor: 'transparent',
      overflow: 'hidden',
    }}>
      <Tree
        data={data}
        idAccessor="uri"
        width="100%"
        height={600}
        indent={24}
        rowHeight={36}
        childrenAccessor="children"
      >
        {(nodeProps: NodeRendererProps<ConceptNode>) => {
          const { node, style, dragHandle } = nodeProps;
          const isFolder = node.children && node.children.length > 0;

          return (
            <div
              ref={dragHandle}
              onClick={() => {
                node.toggle();
                onSelectConcept(node.data);
              }}
              style={{
                ...style,
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                cursor: 'pointer',
                backgroundColor: node.isSelected
                  ? 'color-mix(in srgb, var(--dsw-alias-brand-primary, #0969da) 14%, transparent)'
                  : 'transparent',
                userSelect: 'none',
                borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.08))',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!node.isSelected) {
                  (e.currentTarget as HTMLDivElement).style.background = 'var(--dsw-alias-bg-layer-2, #eef1f4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!node.isSelected) {
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }
              }}
            >
              <span style={{ width: 20, display: 'flex', justifyContent: 'center' }}>
                {isFolder ? (
                  node.isOpen
                    ? <ChevronDown size={14} color="var(--dsw-alias-label-secondary, #3d444d)" />
                    : <ChevronRight size={14} color="var(--dsw-alias-label-secondary, #3d444d)" />
                ) : null}
              </span>

              <span style={{ marginRight: 8, display: 'flex', alignItems: 'center' }}>
                {isFolder
                  ? <Folder size={14} color="var(--dsw-alias-brand-primary, #0969da)" />
                  : <FileText size={14} color="var(--dsw-alias-label-secondary, #3d444d)" />
                }
              </span>

              <span style={{
                fontSize: 13, color: 'var(--dsw-alias-label-primary, #1f2328)',
                whiteSpace: 'nowrap', overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {node.data.pref_label}
              </span>
            </div>
          );
        }}
      </Tree>
    </div>
  );
};