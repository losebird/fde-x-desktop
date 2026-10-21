/**
 * src/workspaces/VocabularyWorkspace/PropertyPanel.tsx
 *
 * Edit one SKOS 型. Save goes through the host vocab write path.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import type { ConceptNode, VocabClue, VocabRelation } from './types';
import { conceptIdFromUri } from './types';
import { usePatchVocabulary } from './queries';

interface PropertyPanelProps {
  concept: ConceptNode | null;
  schemeLabel?: string;
  onSaved?: (concept: ConceptNode) => void;
}

const T = {
  text: 'var(--dsw-alias-label-primary, #1f2328)',
  muted: 'var(--dsw-alias-label-secondary, #3d444d)',
  brand: 'var(--dsw-alias-brand-primary, #0969da)',
  border: 'var(--dsw-alias-border-l2, rgba(31,35,40,0.15))',
  layer1: 'var(--dsw-alias-bg-layer-1, #f6f8fa)',
  layer2: 'var(--dsw-alias-bg-layer-2, #eef1f4)',
  base: 'var(--dsw-alias-bg-base, #ffffff)',
};

const WRITE_ERRORS: Record<string, string> = {
  NO_CONCEPTS: '没有可写的型。',
  NOT_A_KIND: '这是行，不是型。单号和金额不能进词表。',
  NOT_READY: '语义引擎还没就绪。',
  CWD_NOT_AUTHORIZED: '这个工作区不能写。',
  NO_CWD: '没有工作区。',
  BODY_TOO_LARGE: '一次写太多了。',
  TOO_MANY: '一次最多 16 条。',
  SAVE_FAILED: '没写成。',
  VOCAB_WRITE_FAILED: '没写成。',
};

function csv(items?: string[]): string {
  return (items || []).filter(Boolean).join('，');
}

function splitCsv(text: string): string[] {
  return String(text || '')
    .split(/[,，;；\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugFromLabel(value: string): string {
  const text = String(value || '').replace(/[^A-Za-z0-9_\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '');
  return (text.slice(0, 48) || 'c');
}

function cluesToDraft(clues?: VocabClue[]): { say: string; keys: string; values: string; role: string; not: boolean }[] {
  if (!Array.isArray(clues) || !clues.length) return [{ say: '', keys: '', values: '', role: '', not: false }];
  return clues.map((row) => ({
    say: csv(row.say),
    keys: csv(row.keys),
    values: csv(row.values),
    role: String(row.role || ''),
    not: !!row.not,
  }));
}

function draftToClues(rows: { say: string; keys: string; values: string; role: string; not: boolean }[]): VocabClue[] {
  return rows
    .map((row) => {
      const packed: VocabClue = {};
      const say = splitCsv(row.say);
      const keys = splitCsv(row.keys);
      const values = splitCsv(row.values);
      const role = String(row.role || '').trim();
      if (say.length) packed.say = say;
      if (keys.length) packed.keys = keys;
      if (values.length) packed.values = values;
      if (role) packed.role = role;
      if (row.not) packed.not = true;
      return packed;
    })
    .filter((row) => (row.say && row.say.length) || (row.keys && row.keys.length) || (row.role && row.role.length));
}

function relationsToDraft(rows?: VocabRelation[]): { from: string; to: string; field: string }[] {
  if (!Array.isArray(rows) || !rows.length) return [{ from: '', to: '', field: '' }];
  return rows.map((row) => ({
    from: String(row.from || ''),
    to: String(row.to || ''),
    field: String(row.field || ''),
  }));
}

function draftToRelations(rows: { from: string; to: string; field: string }[]): VocabRelation[] {
  return rows
    .map((row) => {
      const from = String(row.from || '').trim();
      const to = String(row.to || '').trim();
      const field = String(row.field || '').trim();
      if (!from || !to) return null;
      return field ? { from, to, field } : { from, to };
    })
    .filter((row): row is VocabRelation => !!row);
}

function Field({
  label,
  value,
  onChange,
  hint,
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (next: string) => void;
  hint?: string;
  readOnly?: boolean;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{ color: T.muted, fontSize: 12, marginBottom: 6 }}>{label}</div>
      <input
        value={value}
        readOnly={readOnly}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: readOnly ? T.layer2 : T.base,
          border: `1px solid ${T.border}`,
          color: T.text, padding: '8px 10px', borderRadius: 6, fontSize: 13,
        }}
      />
      {hint ? <div style={{ color: T.muted, fontSize: 11, marginTop: 4 }}>{hint}</div> : null}
    </label>
  );
}

export function PropertyPanel({ concept, schemeLabel, onSaved }: PropertyPanelProps) {
  const patch = usePatchVocabulary();
  const isNew = Boolean(concept && !concept.uri);
  const [label, setLabel] = useState('');
  const [id, setId] = useState('');
  const [fields, setFields] = useState('');
  const [can, setCan] = useState('');
  const [resource, setResource] = useState('');
  const [ticketField, setTicketField] = useState('');
  const [catalogVersion, setCatalogVersion] = useState('');
  const [clues, setClues] = useState([{ say: '', keys: '', values: '', role: '', not: false }]);
  const [relations, setRelations] = useState([{ from: '', to: '', field: '' }]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!concept) return;
    setLabel(concept.pref_label || '');
    setId(conceptIdFromUri(concept.uri) || '');
    setFields(csv(concept.fields));
    setCan(csv(concept.can));
    setResource(concept.resource || '');
    setTicketField(concept.ticketField || '');
    setCatalogVersion(concept.catalogVersion || '');
    setClues(cluesToDraft(concept.clues));
    setRelations(relationsToDraft(concept.relations));
    setMessage('');
  }, [concept]);

  if (!concept) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', color: T.muted,
        textAlign: 'center', padding: 40,
      }}>
        <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 4, color: T.text }}>还没选概念</p>
        <p style={{ fontSize: 13 }}>在树里点一个概念改闸，或新增一条型。</p>
      </div>
    );
  }

  const save = async () => {
    const nextLabel = label.trim();
    const nextId = (isNew ? (id.trim() || slugFromLabel(nextLabel)) : (id.trim() || conceptIdFromUri(concept.uri))).trim();
    if (!nextLabel) {
      setMessage('名称不能空。');
      return;
    }
    if (!nextId) {
      setMessage('需要一个稳定 id。');
      return;
    }
    setMessage('');
    try {
      await patch.mutateAsync({
        name: schemeLabel,
        concepts: [{
          id: nextId,
          label: nextLabel,
          fields: splitCsv(fields),
          can: splitCsv(can),
          resource,
          ticketField,
          catalogVersion,
          clues: draftToClues(clues),
          relations: draftToRelations(relations),
        }],
      });
      setMessage('已保存。');
      onSaved?.({
        ...concept,
        uri: concept.uri || nextId,
        pref_label: nextLabel,
        fields: splitCsv(fields),
        can: splitCsv(can),
        resource,
        ticketField,
        catalogVersion,
        clues: draftToClues(clues),
        relations: draftToRelations(relations),
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : 'SAVE_FAILED';
      setMessage(WRITE_ERRORS[code] || '没写成。');
    }
  };

  return (
    <div style={{ padding: 28, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 20 }}>
        <div style={{ color: T.brand, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', marginBottom: 8 }}>
          {isNew ? '新增型' : 'SKOS 概念'}
        </div>
        <h2 style={{ margin: 0, color: T.text, fontSize: 22, fontWeight: 700 }}>
          {nextHeading(label, concept.pref_label, isNew)}
        </h2>
      </div>

      <Field label="名称" value={label} onChange={setLabel} hint="给人看的型名。id 不变。" />
      <Field
        label="id"
        value={id}
        onChange={isNew ? setId : undefined}
        readOnly={!isNew}
        hint={isNew ? '稳定短名，保存后不要改。空则按名称生成。' : '身份，不能在这里改。'}
      />
      <Field label="闸字段" value={fields} onChange={setFields} hint="用逗号分开，比如 单号，状态。留空再保存会清掉字段。" />
      <Field label="能做" value={can} onChange={setCan} hint="用逗号分开，比如 现查，过审。" />
      <Field label="表" value={resource} onChange={setResource} hint="连接器表名，如 biz_customers。只能字母数字下划线。" />
      <Field label="单号列" value={ticketField} onChange={setTicketField} hint="真单号列名，如 code。不是某一张单号。" />
      <Field label="目录版本" value={catalogVersion} onChange={setCatalogVersion} hint="发布后旧预览令牌会拒。改词表就换版本。" />

      <section style={{ marginBottom: 20 }}>
        <div style={{ color: T.muted, fontSize: 12, marginBottom: 8 }}>线索</div>
        {clues.map((row, index) => (
          <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <input
              value={row.say}
              placeholder="说法"
              onChange={(event) => {
                const next = clues.slice();
                next[index] = { ...row, say: event.target.value };
                setClues(next);
              }}
              style={inputStyle()}
            />
            <input
              value={row.keys}
              placeholder="列"
              onChange={(event) => {
                const next = clues.slice();
                next[index] = { ...row, keys: event.target.value };
                setClues(next);
              }}
              style={inputStyle()}
            />
            <input
              value={row.values}
              placeholder="取值"
              onChange={(event) => {
                const next = clues.slice();
                next[index] = { ...row, values: event.target.value };
                setClues(next);
              }}
              style={inputStyle()}
            />
            <input
              value={row.role}
              placeholder="角色，型=别名"
              onChange={(event) => {
                const next = clues.slice();
                next[index] = { ...row, role: event.target.value };
                setClues(next);
              }}
              style={inputStyle()}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.muted, fontSize: 12, whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={row.not}
                onChange={(event) => {
                  const next = clues.slice();
                  next[index] = { ...row, not: event.target.checked };
                  setClues(next);
                }}
              />
              非
            </label>
            <button
              type="button"
              onClick={() => {
                const next = clues.filter((_, i) => i !== index);
                setClues(next.length ? next : [{ say: '', keys: '', values: '', role: '', not: false }]);
              }}
              style={ghostBtn()}
            >
              去掉
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setClues(clues.concat([{ say: '', keys: '', values: '', role: '', not: false }]))}
          style={ghostBtn()}
        >
          加一条线索
        </button>
      </section>

      <section style={{ marginBottom: 20 }}>
        <div style={{ color: T.muted, fontSize: 12, marginBottom: 8 }}>可执行关系</div>
        {relations.map((row, index) => (
          <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              value={row.from}
              placeholder="父型"
              onChange={(event) => {
                const next = relations.slice();
                next[index] = { ...row, from: event.target.value };
                setRelations(next);
              }}
              style={inputStyle()}
            />
            <input
              value={row.to}
              placeholder="子型"
              onChange={(event) => {
                const next = relations.slice();
                next[index] = { ...row, to: event.target.value };
                setRelations(next);
              }}
              style={inputStyle()}
            />
            <input
              value={row.field}
              placeholder="外键列"
              onChange={(event) => {
                const next = relations.slice();
                next[index] = { ...row, field: event.target.value };
                setRelations(next);
              }}
              style={inputStyle()}
            />
            <button
              type="button"
              onClick={() => {
                const next = relations.filter((_, i) => i !== index);
                setRelations(next.length ? next : [{ from: '', to: '', field: '' }]);
              }}
              style={ghostBtn()}
            >
              去掉
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRelations(relations.concat([{ from: '', to: '', field: '' }]))}
          style={ghostBtn()}
        >
          加一条关系
        </button>
      </section>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => { void save(); }}
          disabled={patch.isPending}
          style={{
            background: T.brand, color: '#fff', border: 0,
            padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: patch.isPending ? 'wait' : 'pointer',
          }}
        >
          {patch.isPending ? '正在保存…' : '保存'}
        </button>
        {message ? <span style={{ fontSize: 13, color: message === '已保存。' ? T.brand : '#b42318' }}>{message}</span> : null}
      </div>

      {concept.uri ? (
        <div style={{
          marginBottom: 20, padding: '8px 14px',
          background: T.layer2, border: `1px solid ${T.border}`,
          borderRadius: 6, fontSize: 12, color: T.brand,
          fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-all',
        }}>
          {concept.uri}
        </div>
      ) : null}

      <section style={{
        background: T.layer1, padding: 16, borderRadius: 8,
        border: `1px solid ${T.border}`,
      }}>
        <h4 style={{ color: T.muted, fontSize: 12, marginBottom: 10 }}>狭义概念</h4>
        {concept.children && concept.children.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {concept.children.map((child) => (
              <span key={child.uri} style={{
                color: T.text, fontSize: 13, padding: '6px 10px',
                background: T.base, borderRadius: 4, border: `1px solid ${T.border}`,
              }}>
                {child.pref_label}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: T.muted, fontSize: 13 }}>
            叶概念 — 没有更窄的概念。
          </p>
        )}
      </section>
    </div>
  );
}

function nextHeading(label: string, fallback: string, isNew: boolean): string {
  const text = label.trim() || fallback;
  if (text) return text;
  return isNew ? '新的型' : '概念';
}

function inputStyle(): CSSProperties {
  return {
    flex: 1, boxSizing: 'border-box',
    background: T.base, border: `1px solid ${T.border}`,
    color: T.text, padding: '8px 10px', borderRadius: 6, fontSize: 13,
  };
}

function ghostBtn(): CSSProperties {
  return {
    background: T.base, color: T.text, border: `1px solid ${T.border}`,
    padding: '8px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
  };
}
