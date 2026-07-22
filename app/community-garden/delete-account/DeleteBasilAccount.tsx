"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getGardenAccountClient } from "../lib/supabaseAccount";

const CONFIRMATION = "DELETE MY GARDEN";
const PRIVATE_BROWSER_KEYS = [
  "basil-private-account",
  "basil-account-verification-pending-v1",
  "basil-guest-garden-preview-v1",
  "basil-guest-garden-checkout-v1",
];

export function DeleteBasilAccount() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    const client = getGardenAccountClient();
    if (!client) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    void client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getGardenAccountClient();
    const email = session?.user.email;
    if (!client || !email) {
      setError("Sign in from the Basil Account screen, then return here.");
      return;
    }
    if (confirmation !== CONFIRMATION) {
      setError(`Type ${CONFIRMATION} exactly.`);
      return;
    }

    setBusy(true);
    setError("");
    const { data: reauthenticated, error: reauthError } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (reauthError || !reauthenticated.session) {
      setError("That password did not verify this account. Nothing was deleted.");
      setBusy(false);
      return;
    }

    const response = await fetch("/api/community-garden/account/delete", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${reauthenticated.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirmation }),
    }).catch(() => null);
    const payload = response
      ? await response.json().catch(() => ({} as { error?: string; requestId?: string }))
      : { error: "Basil could not reach the deletion service." };
    if (!response?.ok) {
      const recovery = payload.requestId ? ` Reference: ${payload.requestId}.` : "";
      setError(`${payload.error ?? "Deletion did not finish."}${recovery}`);
      setBusy(false);
      return;
    }

    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
    for (const key of PRIVATE_BROWSER_KEYS) {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    }
    setPassword("");
    setConfirmation("");
    setSession(null);
    setDeleted(true);
    setBusy(false);
  }

  if (loading) return <p className="cg-delete-status">Checking your private Basil account…</p>;

  if (deleted) {
    return (
      <div className="cg-delete-success" role="status">
        <h2>Your Basil account was deleted</h2>
        <p>
          Your private account, My Garden, feedback, entitlement, and active sessions
          were removed. Anonymous contributions may remain in the shared Community Garden.
        </p>
        <Link className="cg-legal-action" href="/community-garden">Return to free community play</Link>
      </div>
    );
  }

  if (!session?.user.email) {
    return (
      <div className="cg-delete-signed-out">
        <h2>Sign in first</h2>
        <p>Open Basil, choose <strong>Menu → Account</strong>, and sign in. Then return to this page.</p>
        <Link className="cg-legal-action" href="/community-garden">Open Basil Account</Link>
      </div>
    );
  }

  return (
    <form className="cg-delete-form" onSubmit={deleteAccount}>
      <p className="cg-delete-email">Signed in as <strong>{session.user.email}</strong></p>
      <div className="cg-delete-warning" role="alert">
        <h2>This is permanent</h2>
        <p>
          This removes your login, membership access, My Garden, Care history, private
          feedback, and private account records. It cannot be undone. Stripe may retain
          transaction records required for payment and legal purposes.
        </p>
        <p>
          Anonymous Community Garden contributions may remain because they are part of
          the shared canonical landscape and are not publicly tied to your account.
        </p>
      </div>
      <label htmlFor="basil-delete-password">Enter your password again</label>
      <input
        id="basil-delete-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      <label htmlFor="basil-delete-confirmation">Type {CONFIRMATION}</label>
      <input
        id="basil-delete-confirmation"
        type="text"
        autoComplete="off"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        required
      />
      {error ? <p className="cg-delete-error" role="alert">{error}</p> : null}
      <button
        type="submit"
        disabled={busy || !password || confirmation !== CONFIRMATION}
      >
        {busy ? "Permanently deleting…" : "Permanently delete my account"}
      </button>
      <Link href="/community-garden">Cancel and return to Basil</Link>
    </form>
  );
}
