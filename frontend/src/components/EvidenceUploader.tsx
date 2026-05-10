"use client";

import { useRef, useState } from "react";
import { uploadToIPFS } from "@/lib/ipfs";
import { useSubmitEvidence } from "@/lib/hooks/useEvidence";
import type { ChallengeType } from "@/lib/types";

type UploadState = "idle" | "selected" | "uploading" | "submitting" | "done" | "error";

interface EvidenceUploaderProps {
  challengeId: string;
  nonce: string;
  challengeAddress?: `0x${string}`;
  challengeType?: ChallengeType;
}

export function EvidenceUploader({ challengeId, nonce, challengeAddress, challengeType }: EvidenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [ipfsCid, setIpfsCid] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { submitEvidence, isPending, isSuccess } = useSubmitEvidence(challengeAddress, challengeType ?? "GROUP");

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

  const handleUpload = async () => {
    if (!file) return;
    setUploadError(null);
    setUploadState("uploading");
    try {
      const cid = await uploadToIPFS(file);
      setIpfsCid(cid);
      setUploadState("submitting");
      submitEvidence(cid, nonce as `0x${string}`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploadState("error");
    }
  };

  const isDone = isSuccess || uploadState === "done";

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--line-soft)" }} className="row">
        <div className="eyebrow flex-1">Submit today&apos;s photo</div>
        <span className="muted mono" style={{ fontSize: 11 }}>→ ipfs (pinata) → {challengeId}.submitEvidence(cid)</span>
      </div>

      {isDone ? (
        <div className="col gap-3" style={{ padding: 24, alignItems: "center" }}>
          <div style={{ fontSize: 36 }}>✓</div>
          <div style={{ fontWeight: 500 }}>Evidence submitted on-chain</div>
          <div className="chip" style={{ fontSize: 10.5 }}>{ipfsCid?.slice(0, 20)}…</div>
          <div className="muted" style={{ fontSize: 12 }}>Nonce {nonce.slice(0, 10)}… recorded — Gemini will verify at deadline</div>
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
          {uploadError && (
            <div style={{ padding: "0 22px", marginBottom: 8, color: "var(--loss)", fontSize: 12, fontFamily: "var(--f-mono)" }}>
              {uploadError}
            </div>
          )}
          {file && (
            <div style={{ padding: "0 22px 22px" }}>
              <button
                className="btn primary"
                style={{ width: "100%", justifyContent: "center" }}
                disabled={uploadState === "uploading" || uploadState === "submitting" || isPending}
                onClick={handleUpload}
              >
                {uploadState === "uploading"  ? "⏳ Uploading to IPFS…"        :
                 uploadState === "submitting" || isPending ? "⏳ Waiting for wallet…" :
                 "Upload & submit evidence"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
