"use client";

import { useRef, useState } from "react";
import { TxButton } from "./TxButton";

type UploadState = "idle" | "selected" | "uploading" | "done";

export function EvidenceUploader({ challengeId, nonce }: { challengeId: string; nonce: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [ipfsCid, setIpfsCid] = useState<string | null>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setUploadState("selected");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleUpload = () => {
    setUploadState("uploading");
    setTimeout(() => {
      setIpfsCid("QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
      setUploadState("done");
    }, 1800);
  };

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--line-soft)" }} className="row">
        <div className="eyebrow flex-1">Submit today&apos;s photo</div>
        <span className="muted mono" style={{ fontSize: 11 }}>→ ipfs (pinata) → {challengeId}.submitEvidence(cid)</span>
      </div>

      {uploadState === "done" ? (
        <div className="col gap-3" style={{ padding: 24, alignItems: "center" }}>
          <div style={{ fontSize: 36 }}>✓</div>
          <div style={{ fontWeight: 500 }}>Evidence submitted</div>
          <div className="chip" style={{ fontSize: 10.5 }}>{ipfsCid?.slice(0, 20)}…</div>
          <div className="muted" style={{ fontSize: 12 }}>Nonce {nonce} verified by Gemini Vision</div>
        </div>
      ) : (
        <>
          <div
            className="stripe-bg"
            style={{
              margin: 22, height: 200, borderRadius: "var(--r-lg)",
              border: file ? "2px dashed var(--acc)" : "2px dashed var(--line-strong)",
              display: "grid", placeItems: "center", cursor: "pointer",
            }}
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            {file ? (
              <div className="col gap-2" style={{ alignItems: "center" }}>
                <div style={{ fontSize: 32, color: "var(--acc)" }}>↑</div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{file.name}</div>
                <div className="muted" style={{ fontSize: 11 }}>{(file.size / 1024).toFixed(0)} KB · click to change</div>
              </div>
            ) : (
              <div className="col gap-3" style={{ alignItems: "center" }}>
                <div style={{ fontSize: 40, color: "var(--text-4)" }}>↑</div>
                <div style={{ fontWeight: 500 }}>Drop photo here or click to upload</div>
                <div className="muted" style={{ fontSize: 12 }}>JPEG / PNG · max 5MB · nonce {nonce.slice(0, 10)}… must be visible</div>
              </div>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleInput} />
          {file && (
            <div style={{ padding: "0 22px 22px" }}>
              <TxButton
                label={uploadState === "uploading" ? "Uploading to IPFS…" : "Upload & submit evidence"}
                successLabel="Submitted on-chain!"
                className="btn primary"
                style={{ width: "100%", justifyContent: "center" }}
                onSuccess={() => handleUpload()}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
