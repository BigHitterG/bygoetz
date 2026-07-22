"use client";

import { useEffect, useRef, useState } from "react";

type Review = {
  id: string;
  title: string;
  subject: string;
  htmlBody: string;
  status: string;
  expired: boolean;
  sentAt: string | null;
};

export function NewsletterReview() {
  const tokenRef = useRef("");
  const issueIdRef = useRef("");
  const [review, setReview] = useState<Review | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "sending" | "sent" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const issue = new URL(window.location.href).searchParams.get("issue") ?? "";
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const approvalToken = fragment.get("token") ?? "";
    window.history.replaceState({}, "", `${window.location.pathname}?issue=${encodeURIComponent(issue)}`);
    issueIdRef.current = issue;
    tokenRef.current = approvalToken;
    if (!issue || !approvalToken) {
      queueMicrotask(() => {
        setState("error");
        setMessage("This private review link is incomplete.");
      });
      return;
    }
    void fetch("/api/community-garden/newsletter/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ issueId: issue, token: approvalToken }),
    }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The draft could not be loaded.");
      setReview(payload as Review);
      setState(payload.status === "sent" ? "sent" : "ready");
    }).catch((error) => {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The draft could not be loaded.");
    });
  }, []);

  async function approve() {
    if (!review || review.expired || state !== "ready") return;
    if (!window.confirm("Send this Basil monthly letter to eligible Garden Members now?")) return;
    setState("sending");
    try {
      const response = await fetch("/api/community-garden/newsletter/review?action=send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ issueId: issueIdRef.current, token: tokenRef.current }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The letter could not be sent.");
      setState("sent");
      setMessage("The Basil monthly letter was approved and sent once.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The letter could not be sent.");
    }
  }

  return (
    <main className="cg-newsletter-review">
      <header>
        <span>Private owner review</span>
        <h1>Basil Garden Letter</h1>
        <p>Opening this page never sends an email. Only the confirmation button below can send it.</p>
      </header>
      {state === "loading" ? <p className="cg-newsletter-status">Loading the immutable garden snapshot…</p> : null}
      {state === "error" ? <p className="cg-newsletter-status is-error" role="alert">{message}</p> : null}
      {state === "sent" ? <p className="cg-newsletter-status is-success">{message || "This newsletter has already been sent. The approval link cannot be used again."}</p> : null}
      {review ? (
        <>
          <section className="cg-newsletter-summary">
            <strong>{review.subject}</strong>
            <span>{review.expired ? "Approval link expired" : review.status === "sent" ? "Sent" : "Ready for your approval"}</span>
          </section>
          <iframe title="Basil newsletter draft" srcDoc={review.htmlBody} sandbox="" />
          {state === "ready" ? (
            <div className="cg-newsletter-actions">
              <button type="button" onClick={() => void approve()} disabled={review.expired}>Approve and send</button>
              <p>This sends one Resend Broadcast to eligible members. It cannot be undone.</p>
            </div>
          ) : null}
          {state === "sending" ? <p className="cg-newsletter-status">Preparing the member list and sending once…</p> : null}
        </>
      ) : null}
    </main>
  );
}
