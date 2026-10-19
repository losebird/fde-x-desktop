/**
 * src/workspaces/VocabularyWorkspace/VocabularyWorkspace.tsx
 *
 * Main Vocabulary workspace — composes the Sidebar (scheme list + tree + import)
 * and the PropertyPanel (concept details) into a responsive two-column layout.
 *
 * All data fetching is handled by TanStack Query hooks in `queries.ts`.
 */
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { PropertyPanel } from './PropertyPanel';
import type { ConceptNode } from './types';
import { emptyConcept } from './types';

const THEME_CSS = `
  .vocab-workspace {
    display: flex;
    width: 100%;
    height: 100%;
    background: var(--dsw-alias-bg-base, #ffffff);
    color: var(--dsw-alias-label-primary, #1f2328);
    overflow: hidden;
  }
  .vocab-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    background: var(--dsw-alias-bg-base, #ffffff);
  }
  .vocab-main-content {
    flex: 1;
    overflow-y: auto;
  }
  .vocab-detail-glass {
    background: var(--dsw-alias-bg-layer-1, #f6f8fa);
    border: 1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15));
    box-shadow: none;
    border-radius: 14px;
    height: 100%;
    color: var(--dsw-alias-label-primary, #1f2328);
  }
`;

export function VocabularyWorkspace() {
  const [selectedConcept, setSelectedConcept] = useState<ConceptNode | null>(null);
  const [schemeLabel, setSchemeLabel] = useState('');

  return (
    <div className="vocab-workspace">
      <style>{THEME_CSS}</style>

      {/* Left: Sidebar with scheme list + concept tree + import */}
      <Sidebar
        onSelectConcept={setSelectedConcept}
        onAddConcept={() => setSelectedConcept(emptyConcept())}
        onSchemeLabel={setSchemeLabel}
      />

      {/* Right: Concept detail panel */}
      <div className="vocab-main">
        <div className="vocab-main-content" style={{ padding: 32 }}>
          <div className="vocab-detail-glass">
            <PropertyPanel
              concept={selectedConcept}
              schemeLabel={schemeLabel}
              onSaved={setSelectedConcept}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
