"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GardenShareScope = "whole" | "current";

type PublicGardenShare = {
  token: string;
  scope: GardenShareScope;
  width: number;
  height: number;
  createdAt: string;
  url: string;
  imageUrl: string;
};

type GardenShareProps = {
  accessToken: string;
  disabled?: boolean;
  onCapture: (scope: GardenShareScope) => Promise<File | null>;
};

async function responsePayload(response: Response) {
  return (await response.json().catch(() => null)) as
    | {
        error?: string;
        share?: PublicGardenShare;
        shares?: PublicGardenShare[];
      }
    | null;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("The link could not be copied.");
}

export function GardenShare({
  accessToken,
  disabled = false,
  onCapture,
}: GardenShareProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previewUrlRef = useRef("");
  const captureRequestRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<GardenShareScope>("whole");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [activeShares, setActiveShares] = useState<PublicGardenShare[]>([]);
  const [published, setPublished] = useState<PublicGardenShare | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loadingShares, setLoadingShares] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadShares = useCallback(async () => {
    setLoadingShares(true);
    try {
      const response = await fetch("/api/community-garden/shares", {
        headers: { authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await responsePayload(response);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Your shared gardens could not be loaded.");
      }
      setActiveShares(payload?.shares ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Your shared gardens could not be loaded.",
      );
    } finally {
      setLoadingShares(false);
    }
  }, [accessToken]);

  const replacePreview = useCallback((nextFile: File | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextUrl = nextFile ? URL.createObjectURL(nextFile) : "";
    previewUrlRef.current = nextUrl;
    setFile(nextFile);
    setPreviewUrl(nextUrl);
  }, []);

  const capture = useCallback(async (nextScope: GardenShareScope) => {
    const requestId = ++captureRequestRef.current;
    setCapturing(true);
    replacePreview(null);
    setPublished(null);
    setMessage("");
    setError("");

    try {
      const nextFile = await onCapture(nextScope);
      if (requestId !== captureRequestRef.current) return;
      if (!nextFile) {
        throw new Error("Return to My Garden before creating a snapshot.");
      }
      replacePreview(nextFile);
    } catch (captureError) {
      if (requestId === captureRequestRef.current) {
        setError(
          captureError instanceof Error
            ? captureError.message
            : "The garden preview could not be prepared.",
        );
      }
    } finally {
      if (requestId === captureRequestRef.current) setCapturing(false);
    }
  }, [onCapture, replacePreview]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !publishing) {
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], summary, [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
        ?.focus();
    });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, publishing]);

  function close() {
    if (publishing) return;
    setOpen(false);
    setMessage("");
    setError("");
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openDialog() {
    setOpen(true);
    setMessage("");
    setError("");
    void loadShares();
    void capture(scope);
  }

  function chooseScope(nextScope: GardenShareScope) {
    if (nextScope === scope) return;
    setScope(nextScope);
    void capture(nextScope);
  }

  async function publish() {
    if (!file || publishing) return;
    setPublishing(true);
    setMessage("");
    setError("");
    try {
      const form = new FormData();
      form.set("scope", scope);
      form.set("image", file, "basil-my-garden.png");
      const response = await fetch("/api/community-garden/shares", {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const payload = await responsePayload(response);
      if (!response.ok || !payload?.share) {
        throw new Error(payload?.error ?? "The garden snapshot could not be shared.");
      }

      setPublished(payload.share);
      setActiveShares((current) => [
        payload.share!,
        ...current.filter((share) => share.token !== payload.share?.token),
      ]);
      setMessage("Your private garden snapshot now has a public read-only link.");
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "The garden snapshot could not be shared.",
      );
    } finally {
      setPublishing(false);
    }
  }

  async function shareNative(share: PublicGardenShare) {
    setMessage("");
    setError("");
    const shareText = `See this My Garden grown in Basil: ${share.url}`;
    try {
      if (navigator.share) {
        const data: ShareData = {
          title: "A garden grown in Basil",
          text: shareText,
          url: share.url,
        };
        if (file && navigator.canShare?.({ files: [file] })) {
          data.files = [file];
          delete data.url;
        }
        await navigator.share(data);
        setMessage("Garden shared.");
        return;
      }

      await copyText(share.url);
      setMessage("Share link copied.");
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      setError(
        shareError instanceof Error ? shareError.message : "The garden could not be shared.",
      );
    }
  }

  async function copyLink(share: PublicGardenShare) {
    setMessage("");
    setError("");
    try {
      await copyText(share.url);
      setMessage("Share link copied.");
    } catch (copyError) {
      setError(
        copyError instanceof Error ? copyError.message : "The link could not be copied.",
      );
    }
  }

  function saveImage(share?: PublicGardenShare) {
    const url = previewUrl || share?.imageUrl;
    if (!url) return;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "basil-my-garden.png";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setMessage("Garden image saved.");
  }

  async function revoke(share: PublicGardenShare) {
    setMessage("");
    setError("");
    try {
      const response = await fetch(
        `/api/community-garden/shares/${encodeURIComponent(share.token)}`,
        {
          method: "DELETE",
          headers: { authorization: `Bearer ${accessToken}` },
        },
      );
      const payload = await responsePayload(response);
      if (!response.ok) {
        throw new Error(payload?.error ?? "That garden could not be unshared.");
      }
      setActiveShares((current) =>
        current.filter((candidate) => candidate.token !== share.token),
      );
      if (published?.token === share.token) setPublished(null);
      setMessage("That public garden link has been stopped.");
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "That garden could not be unshared.",
      );
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        className="cg-share-trigger"
        type="button"
        aria-label="Share My Garden"
        title="Share My Garden"
        disabled={disabled}
        onClick={openDialog}
      >
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M22 4h6v6h-3V9.1l-8.6 8.6-2.1-2.1L22.9 7H22V4ZM6 8h10v3H9v12h12v-7h3v10H6V8Z" />
        </svg>
      </button>

      {open ? (
        <div
          className="cg-share-scrim"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            ref={dialogRef}
            className="cg-share-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cg-share-title"
          >
            <button
              className="cg-share-close"
              type="button"
              aria-label="Close sharing"
              disabled={publishing}
              onClick={close}
            >
              ×
            </button>

            <p className="cg-kicker">A garden worth sharing</p>
            <h2 id="cg-share-title">Share My Garden</h2>
            <p className="cg-share-privacy">
              Creates an anonymous, read-only snapshot. Your email, Care balance,
              and account are never shown.
            </p>

            <div className="cg-share-scope" role="group" aria-label="Garden view">
              <button
                type="button"
                aria-pressed={scope === "whole"}
                onClick={() => chooseScope("whole")}
              >
                Whole Garden
                <small>Fit the full property</small>
              </button>
              <button
                type="button"
                aria-pressed={scope === "current"}
                onClick={() => chooseScope("current")}
              >
                Current View
                <small>Share this corner</small>
              </button>
            </div>

            <div className="cg-share-preview" aria-live="polite">
              {capturing ? (
                <span>Preparing your garden…</span>
              ) : previewUrl ? (
                // The preview is a local object URL generated from Basil's canvas.
                <img src={previewUrl} alt="Preview of the garden snapshot" />
              ) : (
                <span>Garden preview unavailable.</span>
              )}
            </div>

            {published ? (
              <div className="cg-share-actions">
                <button type="button" onClick={() => void shareNative(published)}>
                  Share
                </button>
                <button type="button" onClick={() => void copyLink(published)}>
                  Copy Link
                </button>
                <button type="button" onClick={() => saveImage(published)}>
                  Save Image
                </button>
                <button
                  className="is-quiet"
                  type="button"
                  onClick={() => void revoke(published)}
                >
                  Stop Sharing
                </button>
              </div>
            ) : (
              <button
                className="cg-share-publish"
                type="button"
                disabled={!file || capturing || publishing}
                onClick={() => void publish()}
              >
                {publishing ? "Creating link…" : "Create Share"}
              </button>
            )}

            {message ? (
              <p className="cg-share-message" role="status">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="cg-share-error" role="alert">
                {error}
              </p>
            ) : null}

            {activeShares.length ? (
              <details className="cg-share-history">
                <summary>
                  Shared snapshots ({activeShares.length})
                </summary>
                <ul>
                  {activeShares.slice(0, 5).map((share) => (
                    <li key={share.token}>
                      <span>
                        {share.scope === "whole" ? "Whole Garden" : "Current View"}
                        <small>
                          {new Date(share.createdAt).toLocaleDateString()}
                        </small>
                      </span>
                      <button type="button" onClick={() => void copyLink(share)}>
                        Copy
                      </button>
                      <button type="button" onClick={() => void revoke(share)}>
                        Stop
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            ) : loadingShares ? (
              <small className="cg-share-loading">Loading shared snapshots…</small>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
