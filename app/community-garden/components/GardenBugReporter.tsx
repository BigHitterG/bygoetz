"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type GardenReportKind = "bug" | "idea";

const MAX_SCREENSHOT_BYTES = 2_500_000;
const MAX_SOURCE_SCREENSHOT_BYTES = 12_000_000;
const ALLOWED_SCREENSHOT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function formatMegabytes(bytes: number) {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The screenshot could not be read."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressScreenshot(file: File) {
  if (!ALLOWED_SCREENSHOT_TYPES.has(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP screenshot.");
  }
  if (file.size > MAX_SOURCE_SCREENSHOT_BYTES) {
    throw new Error("That screenshot is too large. Choose one under 12 MB.");
  }
  if (file.size <= MAX_SCREENSHOT_BYTES) return file;

  const image = await loadImage(file);
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, 1800 / longestEdge);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const context = canvas.getContext("2d");
  if (!context) throw new Error("The screenshot could not be prepared.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const compressed = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.82);
  });
  if (!compressed || compressed.size > MAX_SCREENSHOT_BYTES) {
    throw new Error("The screenshot is still too large after preparation.");
  }

  return new File([compressed], "basil-screenshot.jpg", {
    type: "image/jpeg",
  });
}

export function GardenBugReporter({ accessToken }: { accessToken: string }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<GardenReportKind>("bug");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;

    const focusTimer = window.setTimeout(() => textareaRef.current?.focus(), 40);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, submitting]);

  function close() {
    if (submitting) return;
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
    if (sent) {
      setKind("bug");
      setMessage("");
      setAttachment(null);
      setError("");
      setSent(false);
    }
  }

  async function selectAttachment(file: File | null) {
    setError("");
    if (!file) {
      setAttachment(null);
      return;
    }

    setAttachmentBusy(true);
    try {
      setAttachment(await compressScreenshot(file));
    } catch (selectionError) {
      setAttachment(null);
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "The screenshot could not be prepared.",
      );
    } finally {
      setAttachmentBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = message.trim();
    if (!note || submitting || attachmentBusy) return;

    setSubmitting(true);
    setError("");
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("message", note);
      if (attachment) {
        const extension =
          attachment.type === "image/png"
            ? "png"
            : attachment.type === "image/webp"
              ? "webp"
              : "jpg";
        form.set("attachment", attachment, `basil-screenshot.${extension}`);
      }

      const response = await fetch("/api/community-garden/feedback", {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        body: form,
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "The report could not be sent.");
      }

      setSent(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "The report could not be sent.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        className="cg-bug-report-trigger"
        type="button"
        aria-label="Report a bug or share an idea"
        title="Bug or feedback"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M12 7h8l2 4v2h4v3h-4v3h4v3h-5.2a7 7 0 0 1-9.6 0H6v-3h4v-3H6v-3h4v-2l2-4Zm2.2 3-1.2 2v6a3 3 0 0 0 6 0v-6l-1.2-2h-3.6ZM11 4l2-2 3 3 3-3 2 2-3 3h-4l-3-3Z" />
        </svg>
      </button>

      {open ? (
        <div
          className="cg-bug-report-scrim"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            ref={dialogRef}
            className="cg-bug-report-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cg-bug-report-title"
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const focusable = Array.from(
                dialogRef.current?.querySelectorAll<HTMLElement>(
                  'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
                ) ?? [],
              ).filter((element) => !element.hasAttribute("hidden"));
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
            }}
          >
            <button
              className="cg-bug-report-close"
              type="button"
              aria-label="Close report"
              disabled={submitting}
              onClick={close}
            >
              ×
            </button>

            {sent ? (
              <div className="cg-bug-report-thanks" role="status">
                <span aria-hidden="true">✓</span>
                <p className="cg-kicker">Sent privately</p>
                <h2 id="cg-bug-report-title">Thank you</h2>
                <p>Your note is in the Basil garden notebook.</p>
                <button type="button" onClick={close}>
                  Back to the garden
                </button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <p className="cg-kicker">Garden notebook</p>
                <h2 id="cg-bug-report-title">Report a bug or share an idea</h2>
                <p className="cg-bug-report-privacy">
                  For members only. Your name and email are not attached.
                </p>

                <fieldset className="cg-bug-report-kind">
                  <legend>What are you sending?</legend>
                  <button
                    type="button"
                    aria-pressed={kind === "bug"}
                    onClick={() => setKind("bug")}
                  >
                    Bug
                  </button>
                  <button
                    type="button"
                    aria-pressed={kind === "idea"}
                    onClick={() => setKind("idea")}
                  >
                    Idea
                  </button>
                </fieldset>

                <label htmlFor="cg-bug-report-message">What happened?</label>
                <textarea
                  ref={textareaRef}
                  id="cg-bug-report-message"
                  value={message}
                  maxLength={1200}
                  rows={6}
                  placeholder={
                    kind === "bug"
                      ? "Tell us what you expected and what happened instead…"
                      : "What would make the garden better?"
                  }
                  onChange={(event) => setMessage(event.target.value)}
                />
                <small className="cg-bug-report-count">
                  {message.length.toLocaleString()} / 1,200
                </small>

                <div className="cg-bug-report-attachment">
                  <label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={attachmentBusy || submitting}
                      onChange={(event) => {
                        void selectAttachment(event.currentTarget.files?.[0] ?? null);
                        event.currentTarget.value = "";
                      }}
                    />
                    {attachmentBusy
                      ? "Preparing screenshot…"
                      : attachment
                        ? "Replace screenshot"
                        : "Attach a screenshot"}
                  </label>
                  {attachment ? (
                    <span>
                      Screenshot ready · {formatMegabytes(attachment.size)}
                      <button
                        type="button"
                        aria-label="Remove screenshot"
                        onClick={() => setAttachment(null)}
                      >
                        Remove
                      </button>
                    </span>
                  ) : null}
                </div>

                {error ? (
                  <p className="cg-bug-report-error" role="alert">
                    {error}
                  </p>
                ) : null}

                <button
                  className="cg-bug-report-submit"
                  type="submit"
                  disabled={!message.trim() || attachmentBusy || submitting}
                >
                  {submitting ? "Sending…" : "Submit"}
                </button>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
