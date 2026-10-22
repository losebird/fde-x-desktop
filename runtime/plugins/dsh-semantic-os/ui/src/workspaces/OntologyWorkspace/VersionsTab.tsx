import { useCallback, useEffect, useState } from "react";
import {
  Layers,
  GitMerge,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  X,
  ArrowRight,
  Scale,
} from "lucide-react";

interface VersionEntry {
  version_id: string;
  ontology_uri: string;
  state: "draft" | "published";
  author: string;
  date: string;
  diff_summary: Record<string, any>;
}

interface Proposal {
  proposal_id: string;
  draft_id: string;
  ontology_uri: string;
  summary: string;
  author: string;
  reviewer: string | null;
  state: "draft" | "proposed" | "approved" | "published" | "rejected";
  impact_analysis: Record<string, any>;
  shacl_validation: Record<string, any>;
  created_at: string;
  updated_at: string;
  comments: Record<string, any>[];
}

export function VersionsTab() {
  const [ontologyUri, setOntologyUri] = useState<string>("");
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [comparePair, setComparePair] = useState<{ v1: string; v2: string } | null>(null);
  const [compareResult, setCompareResult] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadVersions = useCallback(async () => {
    if (!ontologyUri) return;
    setError("");
    try {
      const response = await fetch(`/api/ontology/versions/${encodeURIComponent(ontologyUri)}`);
      if (response.ok) {
        const data = await response.json();
        setVersions(data);
        if (response.status === 207) setError(data.message || "警告：版本只加载了一部分。");
      } else {
        setError(`版本没读成 (${response.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "版本没读成.");
    }
  }, [ontologyUri]);

  const loadProposals = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/ontology/proposals");
      if (response.ok) {
        const data = await response.json();
        setProposals(data);
        if (response.status === 207) setError(data.message || "警告：提案只加载了一部分。");
      } else {
        setError(`提案没读成 (${response.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "提案没读成.");
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function fetchInitial() {
      if (!ignore) setError("");
      try {
        const propRes = await fetch("/api/ontology/proposals");
        if (propRes.ok) {
          const propData = await propRes.json();
          if (!ignore) {
            setProposals(propData);
            if (propRes.status === 207) setError(propData.message || "警告：提案只加载了一部分。");
          }
        } else if (!ignore) {
          setError(`提案没读成 (${propRes.status})`);
        }
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "提案没读成.");
      }

      if (!ontologyUri) return;
      try {
        const verRes = await fetch(`/api/ontology/versions/${encodeURIComponent(ontologyUri)}`);
        if (verRes.ok) {
          const verData = await verRes.json();
          if (!ignore) {
            setVersions(verData);
            if (verRes.status === 207) setError(verData.message || "警告：版本只加载了一部分。");
          }
        } else if (!ignore) {
          setError((prev) => prev || `版本没读成 (${verRes.status})`);
        }
      } catch (err) {
        if (!ignore) setError((prev) => prev || (err instanceof Error ? err.message : "版本没读成."));
      }
    }
    void fetchInitial();
    return () => { ignore = true; };
  }, [ontologyUri]);

  const approveProposal = useCallback(async (proposalId: string) => {
    setError("");
    try {
      const response = await fetch(`/api/ontology/proposals/${proposalId}/approve`, {
        method: "POST",
      });
      if (response.ok) {
        if (response.status === 207) {
          const data = await response.json().catch(() => ({}));
          setError(data.message || "Warning: Partial success approving proposal.");
        } else {
          alert("Proposal approved");
        }
        loadProposals();
      } else {
        setError(`Failed to approve proposal (${response.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve proposal.");
    }
  }, [loadProposals]);

  const rejectProposal = useCallback(async (proposalId: string) => {
    setError("");
    try {
      const response = await fetch(`/api/ontology/proposals/${proposalId}/reject`, {
        method: "POST",
      });
      if (response.ok) {
        if (response.status === 207) {
          const data = await response.json().catch(() => ({}));
          setError(data.message || "Warning: Partial success rejecting proposal.");
        } else {
          alert("Proposal rejected");
        }
        loadProposals();
      } else {
        setError(`Failed to reject proposal (${response.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject proposal.");
    }
  }, [loadProposals]);

  const publishProposal = useCallback(async (proposalId: string) => {
    setError("");
    try {
      const response = await fetch(`/api/ontology/proposals/${proposalId}/publish`, {
        method: "POST",
      });
      if (response.ok) {
        if (response.status === 207) {
          const data = await response.json().catch(() => ({}));
          setError(data.message || "Warning: Partial success publishing proposal.");
        } else {
          alert("Proposal published");
        }
        loadProposals();
        loadVersions();
      } else {
        setError(`Failed to publish proposal (${response.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish proposal.");
    }
  }, [loadProposals, loadVersions]);

  const runVersionComparison = useCallback(async () => {
    if (!comparePair || !ontologyUri) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/ontology/versions/${encodeURIComponent(ontologyUri)}/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version1: comparePair.v1,
          version2: comparePair.v2,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (response.status === 207) setError(data.message || "警告：版本只对比了一部分。");
        setCompareResult(data);
      } else {
        setError(`版本没对比成 (${response.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "版本没对比成.");
    } finally {
      setIsLoading(false);
    }
  }, [comparePair, ontologyUri]);

  const getStateIcon = (state: string) => {
    switch (state) {
      case "published":
        return <CheckCircle size={16} color="#4cc38a" />;
      case "approved":
        return <CheckCircle size={16} color="#4aa3ff" />;
      case "rejected":
        return <XCircle size={16} color="#ff6b6b" />;
      case "proposed":
        return <AlertCircle size={16} color="#f2b66d" />;
      default:
        return <Clock size={16} color="color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))" />;
    }
  };

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "var(--dsw-alias-bg-base, #fff)",
    padding: "20px",
    overflow: "auto",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    color: "var(--dsw-alias-label-primary, #1f2328)",
    fontSize: "20px",
    fontWeight: "700",
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: "24px",
  };

  const sectionTitleStyle: React.CSSProperties = {
    margin: "0 0 12px",
    color: "var(--dsw-alias-label-primary, #1f2328)",
    fontSize: "14px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  };

  const listStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  };

  const itemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    borderRadius: "8px",
    background: "var(--dsw-alias-bg-layer-1, #f6f8fa)",
    border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
    transition: "160ms ease",
  };

  const modalOverlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  };

  const modalStyle: React.CSSProperties = {
    background: "var(--dsw-alias-bg-layer-1, #f6f8fa)",
    border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
    borderRadius: "12px",
    padding: "24px",
    minWidth: "480px",
    maxWidth: "640px",
    maxHeight: "80vh",
    overflow: "auto",
    backdropFilter: "blur(18px)",
  };

  const buttonStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    borderRadius: "6px",
    border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
    background: "var(--dsw-alias-bg-base, #fff)",
    color: "var(--dsw-alias-label-primary, #1f2328)",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "160ms ease",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
    background: "var(--dsw-alias-bg-base, #fff)",
    color: "var(--dsw-alias-label-primary, #1f2328)",
    fontSize: "13px",
    marginBottom: "12px",
  };

  const errorStyle: React.CSSProperties = { padding: "12px", borderRadius: "14px", color: "#ffb4c2", background: "rgba(255,157,175,0.1)", border: "1px solid rgba(255,157,175,0.18)", marginBottom: "16px" };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>版本与变更提案</h1>
        <input
          type="text"
          placeholder="词表地址"
          value={ontologyUri}
          onChange={(e) => setOntologyUri(e.target.value)}
          style={{ ...inputStyle, width: "300px", marginBottom: 0 }}
        />
      </div>

      {error ? <div style={errorStyle}>{error}</div> : null}

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>
          <Layers size={16} />
          版本历史
        </h2>
        <div style={listStyle}>
          {versions.length === 0 ? (
            <div>
              <div style={{ color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: "13px" }}>还没有版本</div>
              <button
                type="button"
                style={{ ...buttonStyle, marginTop: 10 }}
                onClick={async () => {
                  setError("");
                  try {
                    const response = await fetch("/api/ontology/versions", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ uri: ontologyUri }),
                    });
                    const data = await response.json();
                    if (data && data.error === "NO_ONTOLOGY") {
                      setError(data.detail || "还没有词表可登记版本。先去词表加载或改型。");
                      return;
                    }
                    if (!response.ok || (data && data.ok === false)) {
                      setError("没装这套依赖，或还不能生成版本。");
                      return;
                    }
                    if (data && data.version && data.version.ontology_uri) setOntologyUri(data.version.ontology_uri);
                    setVersions(Array.isArray(data.versions) ? data.versions : (data.version ? [data.version] : []));
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "没写成。");
                  }
                }}
              >
                生成第一份版本
              </button>
            </div>
          ) : (
            versions.map((version) => (
              <div key={version.version_id} style={itemStyle}>
                {getStateIcon(version.state)}
                <div style={{ flex: 1 }}>
                  <div style={{ color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: "13px", fontWeight: "600" }}>
                    {version.version_id}
                  </div>
                  <div style={{ color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: "11px" }}>
                    {version.author} • {new Date(version.date).toLocaleDateString()}
                  </div>
                </div>
                <button
                  style={buttonStyle}
                  onClick={() => {
                    setComparePair({ v1: version.version_id, v2: versions[0]?.version_id || "" });
                    setShowCompareModal(true);
                  }}
                >
                  <ArrowRight size={12} />
                  对比
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>
          <GitMerge size={16} />
          变更提案
        </h2>
        <div style={listStyle}>
          {proposals.length === 0 ? (
            <div style={{ color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: "13px" }}>还没有提案</div>
          ) : (
            proposals.map((proposal) => (
              <div key={proposal.proposal_id} style={itemStyle}>
                {getStateIcon(proposal.state)}
                <div style={{ flex: 1 }}>
                  <div style={{ color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: "13px", fontWeight: "600" }}>
                    {proposal.summary}
                  </div>
                  <div style={{ color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: "11px" }}>
                    {proposal.author} • {new Date(proposal.created_at).toLocaleDateString()}
                  </div>
                </div>
                {proposal.state === "proposed" && (
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button style={buttonStyle} onClick={() => approveProposal(proposal.proposal_id)}>
                      <CheckCircle size={12} />
                      Approve
                    </button>
                    <button style={buttonStyle} onClick={() => rejectProposal(proposal.proposal_id)}>
                      <XCircle size={12} />
                      Reject
                    </button>
                  </div>
                )}
                {proposal.state === "approved" && (
                  <button style={buttonStyle} onClick={() => publishProposal(proposal.proposal_id)}>
                    <Send size={12} />
                    Publish
                  </button>
                )}
                <button
                  style={buttonStyle}
                  onClick={() => {
                    setSelectedProposal(proposal);
                    setShowProposalModal(true);
                  }}
                >
                  <FileText size={12} />
                  Details
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {showProposalModal && selectedProposal && (
        <div style={modalOverlayStyle} onClick={() => setShowProposalModal(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: "16px" }}>提案详情</h3>
              <button onClick={() => setShowProposalModal(false)} style={{ background: "none", border: "none", color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: "12px", marginBottom: "4px" }}>
                Summary
              </label>
              <div style={{ color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: "13px" }}>{selectedProposal.summary}</div>
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: "12px", marginBottom: "4px" }}>
                State
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: "13px" }}>
                {getStateIcon(selectedProposal.state)}
                {selectedProposal.state}
              </div>
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: "12px", marginBottom: "4px" }}>
                Impact Analysis
              </label>
              <pre style={{ background: "var(--dsw-alias-bg-base, #fff)", padding: "12px", borderRadius: "6px", color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: "12px", overflow: "auto" }}>
                {JSON.stringify(selectedProposal.impact_analysis, null, 2)}
              </pre>
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: "12px", marginBottom: "4px" }}>
                SHACL Validation
              </label>
              <pre style={{ background: "var(--dsw-alias-bg-base, #fff)", padding: "12px", borderRadius: "6px", color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: "12px", overflow: "auto" }}>
                {JSON.stringify(selectedProposal.shacl_validation, null, 2)}
              </pre>
            </div>
            <div>
              <label style={{ display: "block", color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: "12px", marginBottom: "4px" }}>
                Comments ({selectedProposal.comments.length})
              </label>
              <div style={{ maxHeight: "120px", overflow: "auto" }}>
                {selectedProposal.comments.map((comment) => (
                  <div key={comment.id} style={{ padding: "8px", background: "var(--dsw-alias-bg-layer-2, #eef1f4)", borderRadius: "4px", marginBottom: "6px" }}>
                    <div style={{ color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: "12px", fontWeight: "600" }}>{comment.author}</div>
                    <div style={{ color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: "11px" }}>{comment.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCompareModal && comparePair && (
        <div style={modalOverlayStyle} onClick={() => setShowCompareModal(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: "16px" }}>对比版本</h3>
              <button onClick={() => setShowCompareModal(false)} style={{ background: "none", border: "none", color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: "12px", marginBottom: "4px" }}>
                  Version 1
                </label>
                <input
                  type="text"
                  value={comparePair.v1}
                  onChange={(e) => setComparePair({ ...comparePair, v1: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: "12px", marginBottom: "4px" }}>
                  Version 2
                </label>
                <input
                  type="text"
                  value={comparePair.v2}
                  onChange={(e) => setComparePair({ ...comparePair, v2: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>
            <button style={buttonStyle} onClick={runVersionComparison} disabled={isLoading}>
              <Scale size={12} />
              {isLoading ? "对比中…" : "对比"}
            </button>
            {compareResult && (
              <pre style={{ marginTop: "16px", background: "var(--dsw-alias-bg-base, #fff)", padding: "12px", borderRadius: "6px", color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: "12px", overflow: "auto" }}>
                {JSON.stringify(compareResult, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
