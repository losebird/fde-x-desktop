/**
 * ImportDropzone.tsx
 *
 * Drag & drop upload zone for SKOS .ttl / .rdf files.
 * Styled for the DSH light theme.
 */
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, CheckCircle2, Loader2 } from 'lucide-react';
import { useImportVocabulary } from './queries';
import type { ImportResponse } from './types';

const T = {
  text: 'var(--dsw-alias-label-primary, #1f2328)',
  muted: 'var(--dsw-alias-label-secondary, #3d444d)',
  brand: 'var(--dsw-alias-brand-primary, #0969da)',
  border: 'var(--dsw-alias-border-l2, rgba(31,35,40,0.15))',
  layer: 'var(--dsw-alias-bg-layer-2, #eef1f4)',
  base: 'var(--dsw-alias-bg-base, #ffffff)',
};

export const ImportDropzone: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const importMutation = useImportVocabulary();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      setImportResult(null);

      importMutation.mutate(selectedFile, {
        onSuccess: (data) => {
          setImportResult(data);
          setTimeout(() => {
            setFile(null);
            setImportResult(null);
          }, 4000);
        },
        onError: (err) => {
          console.error("Upload failed:", err);
          setFile(null);
        }
      });
    }
  }, [importMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/turtle': ['.ttl'],
      'application/rdf+xml': ['.rdf', '.owl']
    },
    maxFiles: 1
  });

  return (
    <div>
      <div
        {...getRootProps()}
        style={{
          border: `2px dashed ${isDragActive ? T.brand : T.border}`,
          backgroundColor: isDragActive ? 'color-mix(in srgb, var(--dsw-alias-brand-primary, #0969da) 10%, transparent)' : T.layer,
          borderRadius: 8,
          padding: '16px 12px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <input {...getInputProps()} />

        {importMutation.isPending ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: T.muted }}>
            <Loader2 className="animate-spin" size={20} style={{ marginBottom: 6 }} />
            <span style={{ fontSize: 12 }}>正在上传 {file?.name}…</span>
          </div>
        ) : importResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#1a7f37' }}>
            <CheckCircle2 size={20} style={{ marginBottom: 6 }} />
            <span style={{ fontSize: 12, fontWeight: 500 }}>导入成功</span>
            <span style={{ fontSize: 11, marginTop: 2, color: '#1a7f37' }}>
              +{importResult.nodes_added} 个概念 · +{importResult.edges_added} 条关系
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: T.muted }}>
            <UploadCloud size={20} style={{ marginBottom: 6, color: isDragActive ? T.brand : T.muted }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: T.text }}>
              {isDragActive ? "放到这里…" : "导入词表"}
            </span>
            <span style={{ fontSize: 11, marginTop: 2 }}>导入分类表</span>
          </div>
        )}
      </div>
      {importMutation.isError && (
        <p style={{ color: '#d14343', fontSize: 11, marginTop: 6, textAlign: 'center' }}>
          词表没导入成。
        </p>
      )}
    </div>
  );
};
