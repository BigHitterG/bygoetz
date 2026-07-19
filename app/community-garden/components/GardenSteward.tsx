"use client";

import type { Session } from "@supabase/supabase-js";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { getGardenAccountClient } from "../lib/supabaseAccount";

const FEEDBACK_CATEGORIES = [
  ["plants", "Plants"],
  ["care", "Plant care"],
  ["exploration", "Exploration"],
  ["almanac", "Almanac"],
  ["accessibility", "Accessibility"],
  ["other", "Something else"],
] as const;

type FeedbackItem = {
  id: string;
  category: string;
  message: string;
  status: "received" | "shortlisted" | "planned" | "shipped" | "declined";
  created_at: string;
};

type ActiveAccount = {
  active: true;
  steward: {
    gardenName: string;
    purchasedAt: string;
    email: string;
  };
  almanac: {
    total: number;
    planted24h: number;
    active24h: number;
    byType: { rose: number; sunflower: number; lavender: number };
    measuredAt: string;
  };
  feedback: FeedbackItem[];
};

type AccountState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "free"; email: string }
  | { status: "error"; message: string }
  | { status: "active"; account: ActiveAccount };

async function getResponseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function GardenSteward() {
  const [session, setSession] = useState<Session | null>(null);
  const [accountState, setAccountState] = useState<AccountState>({ status: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("plants");
  const [idea, setIdea] = useState("");

  const loadAccount = useCallback(async (activeSession: Session) => {
    try {
      const response = await fetch("/api/community-garden/account", {
        cache: "no-store",
        headers: { authorization: `Bearer ${activeSession.access_token}` },
      });
      if (!response.ok) throw new Error(await getResponseError(response, "Could not load the pass."));
      const account = (await response.json()) as ActiveAccount | { active: false; email: string };
      setAccountState(
        account.active
          ? { status: "active", account }
          : { status: "free", email: account.email || activeSession.user.email || "" },
      );
    } catch (error) {
      setAccountState({
        status: "error",
        message: error instanceof Error ? error.message : "Could not load the pass.",
      });
    }
  }, []);

  useEffect(() => {
    const client = getGardenAccountClient();
    if (!client) {
      queueMicrotask(() => {
        setAccountState({ status: "error", message: "Private accounts are not configured yet." });
      });
      return;
    }

    void client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) void loadAccount(data.session);
      else setAccountState({ status: "signed-out" });
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) void loadAccount(nextSession);
      else setAccountState({ status: "signed-out" });
    });

    const params = new URLSearchParams(window.location.search);
    const stewardStatus = params.get("steward");
    queueMicrotask(() => {
      if (stewardStatus === "welcome") {
        setNotice("Purchase complete. Your pass now follows this private account.");
      } else if (stewardStatus === "unverified") {
        setNotice("The purchase could not be verified. Please check your Stripe receipt.");
      } else if (params.get("checkout") === "cancelled") {
        setNotice("Checkout cancelled. The community garden is still free to play.");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadAccount]);

  async function sendSignInLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getGardenAccountClient();
    if (!client || !email.trim()) return;

    setBusy("sign-in");
    setNotice("");
    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/community-garden?steward=signed-in`,
      },
    });
    setBusy(null);
    setNotice(
      error
        ? error.message
        : "Check your email and tap the Basil sign-in link. No password is needed.",
    );
  }

  async function beginCheckout() {
    if (!session) return;
    setBusy("checkout");
    setNotice("");
    try {
      const response = await fetch("/api/community-garden/checkout", {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error(await getResponseError(response, "Checkout could not start."));
      const payload = (await response.json()) as { url: string };
      window.location.assign(payload.url);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Checkout could not start.");
      setBusy(null);
    }
  }

  async function submitIdea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !idea.trim()) return;

    setBusy("feedback");
    setNotice("");
    try {
      const response = await fetch("/api/community-garden/feedback", {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ category, message: idea.trim() }),
      });
      if (!response.ok) throw new Error(await getResponseError(response, "The idea could not be sent."));
      setIdea("");
      setNotice("Idea received. It is now in the practical upgrade queue.");
      await loadAccount(session);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The idea could not be sent.");
    } finally {
      setBusy(null);
    }
  }

  async function signOut() {
    setBusy("sign-out");
    await getGardenAccountClient()?.auth.signOut();
    setBusy(null);
    setNotice("Signed out on this device. Your purchase remains on your account.");
  }

  return (
    <section className="cg-steward" aria-labelledby="garden-steward-title">
      <p className="cg-kicker">One time · $6.99</p>
      <h2 id="garden-steward-title">Founding Gardener Pass</h2>
      <p className="cg-steward-lead">
        Basil stays free and anonymous to play. The pass funds the shared garden and
        unlocks a live Garden Almanac plus a direct upgrade queue.
      </p>

      {notice ? <p className="cg-steward-notice" aria-live="polite">{notice}</p> : null}

      {accountState.status === "loading" ? (
        <p className="cg-steward-loading">Checking for a private Basil account…</p>
      ) : null}

      {accountState.status === "error" ? (
        <div className="cg-steward-error" role="alert">
          <p>{accountState.message}</p>
          {session ? (
            <button type="button" onClick={() => void loadAccount(session)}>Try again</button>
          ) : null}
        </div>
      ) : null}

      {accountState.status === "signed-out" ? (
        <div className="cg-sign-in">
          <h3>Sign in privately</h3>
          <p>
            Use your email on any device. We send a secure sign-in link, so there is no
            username or password to remember.
          </p>
          <form onSubmit={sendSignInLink}>
            <label htmlFor="basil-email">Email address</label>
            <input
              id="basil-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
            <button type="submit" disabled={busy === "sign-in" || !email.trim()}>
              {busy === "sign-in" ? "Sending link…" : "Email me a sign-in link"}
            </button>
          </form>
        </div>
      ) : null}

      {accountState.status === "free" ? (
        <div className="cg-pass-card">
          <div className="cg-signed-in-row">
            <span>Signed in privately as {accountState.email}</span>
            <button type="button" onClick={() => void signOut()}>Sign out</button>
          </div>
          <div className="cg-pass-price">
            <span>Founding Gardener</span>
            <strong>$6.99</strong>
            <small>once, not a subscription</small>
          </div>
          <ul>
            <li>Use the pass on any browser or device with the same email</li>
            <li>Garden Almanac with live community totals</li>
            <li>Feedback tracked through the upgrade queue</li>
            <li>No stronger plants, boosts, or gameplay advantage</li>
          </ul>
          <button
            className="cg-support-button"
            type="button"
            disabled={busy === "checkout"}
            onClick={() => void beginCheckout()}
          >
            {busy === "checkout" ? "Opening secure checkout…" : "Get the $6.99 pass"}
          </button>
        </div>
      ) : null}

      {accountState.status === "active" ? (
        <div className="cg-steward-account">
          <div className="cg-steward-welcome">
            <div className="cg-signed-in-row">
              <span>Signed in privately as {accountState.account.steward.email}</span>
              <button type="button" disabled={busy === "sign-out"} onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
            <p className="cg-kicker">Founding Gardener account</p>
            <h3>Pass active</h3>
            <p>
              Your account works across devices. Nothing you plant is labeled with your
              email or linked to a public profile.
            </p>
          </div>

          <div className="cg-almanac" aria-labelledby="garden-almanac-title">
            <div className="cg-steward-section-heading">
              <h3 id="garden-almanac-title">Garden Almanac</h3>
              <small>Live community totals</small>
            </div>
            <dl>
              <div><dt>Growing</dt><dd>{accountState.account.almanac.total}</dd></div>
              <div><dt>Planted today</dt><dd>{accountState.account.almanac.planted24h}</dd></div>
              <div><dt>Watered today</dt><dd>{accountState.account.almanac.active24h}</dd></div>
              <div><dt>Roses</dt><dd>{accountState.account.almanac.byType.rose}</dd></div>
              <div><dt>Sunflowers</dt><dd>{accountState.account.almanac.byType.sunflower}</dd></div>
              <div><dt>Lavender</dt><dd>{accountState.account.almanac.byType.lavender}</dd></div>
            </dl>
          </div>

          <form className="cg-feedback-form" onSubmit={submitIdea}>
            <div className="cg-steward-section-heading">
              <h3>Shape the next upgrade</h3>
              <small>Ideas are reviewed, never auto-published</small>
            </div>
            <label htmlFor="feedback-category">Area</label>
            <select
              id="feedback-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {FEEDBACK_CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <label htmlFor="feedback-idea">What would make you return to the garden?</label>
            <textarea
              id="feedback-idea"
              value={idea}
              onChange={(event) => setIdea(event.target.value.slice(0, 280))}
              maxLength={280}
              rows={4}
            />
            <div className="cg-feedback-submit">
              <small>{idea.length}/280</small>
              <button type="submit" disabled={busy === "feedback" || !idea.trim()}>
                {busy === "feedback" ? "Sending…" : "Send idea"}
              </button>
            </div>
          </form>

          {accountState.account.feedback.length ? (
            <div className="cg-feedback-history">
              <h3>Your upgrade queue</h3>
              <ul>
                {accountState.account.feedback.map((item) => (
                  <li key={item.id}>
                    <span>{item.category}</span>
                    <p>{item.message}</p>
                    <small>{item.status}</small>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="cg-steward-privacy">
        <strong>Private account, anonymous play</strong>
        <p>
          Basil stores your private account email, payment entitlement, and feedback.
          Stripe handles card and receipt details. The public garden never shows who you
          are or connects your identity to plants. Future verified store purchases can
          attach to this same account.
        </p>
      </div>
    </section>
  );
}
