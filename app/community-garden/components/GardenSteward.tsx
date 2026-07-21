"use client";

import type { Session } from "@supabase/supabase-js";
import {
  FormEvent,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import type { MyGardenState } from "@/lib/communityGarden/myGarden";
import { trackMetaCustomEvent } from "@/lib/analytics/metaPixel";
import { getGardenAccountClient } from "../lib/supabaseAccount";
import {
  getBasilLaunchSessionId,
  trackBasilFunnelEvent,
} from "../lib/launchFunnel";
import { GardenHealthPanel } from "./GardenHealthPanel";

const PENDING_VERIFICATION_KEY = "basil-account-verification-pending-v1";

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
  myGarden: MyGardenState;
};

type FreeAccount = { active: false; email: string };
type AccountResponse = ActiveAccount | FreeAccount;

type AccountState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "free"; email: string }
  | { status: "error"; message: string }
  | { status: "active"; account: ActiveAccount };

type AuthView = "signin" | "signup" | "recovery";
type PendingAccountLink = {
  tokenHash: string;
  type: "signup" | "recovery" | "magiclink";
  checkout: boolean;
  setup: boolean;
  verified: boolean;
};

type VerificationPending = {
  email: string;
  existingAccount: boolean;
};

type PaidPurchaseStatus = {
  pending: true;
  email: string;
  paid: boolean;
  verificationSent: boolean;
  verified: boolean;
  finalized: boolean;
  status: string;
  error: string | null;
};

function loadPendingVerification() {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(PENDING_VERIFICATION_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as VerificationPending & { expiresAt?: number };
    if (!parsed.email || Number(parsed.expiresAt) <= Date.now()) {
      window.localStorage.removeItem(PENDING_VERIFICATION_KEY);
      return null;
    }
    return {
      email: parsed.email,
      existingAccount: Boolean(parsed.existingAccount),
    } satisfies VerificationPending;
  } catch {
    return null;
  }
}

function savePendingVerification(value: VerificationPending | null) {
  if (typeof window === "undefined") return;
  if (!value) {
    window.localStorage.removeItem(PENDING_VERIFICATION_KEY);
    return;
  }
  window.localStorage.setItem(
    PENDING_VERIFICATION_KEY,
    JSON.stringify({
      ...value,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }),
  );
}

async function getResponseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

function clearAccountLinkFromAddress() {
  const url = new URL(window.location.href);
  url.searchParams.delete("steward");
  url.searchParams.delete("token_hash");
  url.searchParams.delete("type");
  url.searchParams.delete("checkout");
  url.searchParams.delete("setup");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function GardenSteward() {
  const [session, setSession] = useState<Session | null>(null);
  const [accountState, setAccountState] = useState<AccountState>({ status: "loading" });
  const [authView, setAuthView] = useState<AuthView>("signin");
  const [pendingLink, setPendingLink] = useState<PendingAccountLink | null>(null);
  const [verificationPending, setVerificationPending] =
    useState<VerificationPending | null>(null);
  const [paidVerificationPending, setPaidVerificationPending] = useState(false);
  const [paidPurchaseStatus, setPaidPurchaseStatus] =
    useState<PaidPurchaseStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [category, setCategory] = useState("plants");
  const [idea, setIdea] = useState("");
  const confirmationStartedRef = useRef("");
  const handoffStartedRef = useRef(false);

  const loadAccount = useCallback(async (activeSession: Session) => {
    try {
      const response = await fetch("/api/community-garden/account", {
        cache: "no-store",
        headers: { authorization: `Bearer ${activeSession.access_token}` },
      });
      if (!response.ok) throw new Error(await getResponseError(response, "Could not load the membership."));
      const account = (await response.json()) as AccountResponse;
      setAccountState(
        account.active
          ? { status: "active", account }
          : { status: "free", email: account.email || activeSession.user.email || "" },
      );
      return account;
    } catch (error) {
      setAccountState({
        status: "error",
        message: error instanceof Error ? error.message : "Could not load the membership.",
      });
      return null;
    }
  }, []);

  const finalizePaidVerification = useCallback(async (activeSession: Session) => {
    try {
      await fetch("/api/community-garden/purchase/verified", {
        method: "POST",
        headers: { authorization: `Bearer ${activeSession.access_token}` },
      });
    } catch {
      // The entitlement and server preview are already safe; account load can retry later.
    }
  }, []);

  const refreshPaidPurchaseStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/community-garden/purchase/status", {
        cache: "no-store",
      });
      if (!response.ok) return null;
      const status = (await response.json()) as PaidPurchaseStatus;
      setPaidPurchaseStatus(status);

      if (!status.verified || session || handoffStartedRef.current) return status;
      handoffStartedRef.current = true;
      const handoffResponse = await fetch(
        "/api/community-garden/purchase/status",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "handoff" }),
        },
      );
      if (!handoffResponse.ok) {
        throw new Error(
          await getResponseError(
            handoffResponse,
            "Basil could not finish signing in on this browser.",
          ),
        );
      }
      const handoff = (await handoffResponse.json()) as {
        tokenHash: string;
        type: "magiclink";
      };
      const client = getGardenAccountClient();
      if (!client) throw new Error("Private Basil accounts are unavailable right now.");
      const { data, error } = await client.auth.verifyOtp({
        token_hash: handoff.tokenHash,
        type: handoff.type,
      });
      if (error || !data.session) {
        throw new Error(error?.message ?? "Basil could not finish signing in.");
      }
      savePendingVerification(null);
      setVerificationPending(null);
      setPaidVerificationPending(false);
      setSession(data.session);
      trackMetaCustomEvent("BasilVerificationCompleted");
      void trackBasilFunnelEvent("verification_completed");
      await finalizePaidVerification(data.session);
      await loadAccount(data.session);
      setNotice("Account confirmed. Your saved garden is ready.");
      return status;
    } catch (error) {
      handoffStartedRef.current = false;
      setNotice(
        error instanceof Error
          ? error.message
          : "Basil could not finish this account yet.",
      );
      return null;
    }
  }, [finalizePaidVerification, loadAccount, session]);

  const beginCheckout = useCallback(async (activeSession: Session) => {
    setBusy("checkout");
    setNotice("");
    trackMetaCustomEvent("BasilCheckoutStarted");
    void trackBasilFunnelEvent("checkout_started");
    try {
      const response = await fetch("/api/community-garden/checkout", {
        method: "POST",
        headers: {
          authorization: `Bearer ${activeSession.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ launchSessionId: getBasilLaunchSessionId() }),
      });
      if (!response.ok) throw new Error(await getResponseError(response, "Checkout could not start."));
      const payload = (await response.json()) as { url: string };
      window.location.assign(payload.url);
    } catch (error) {
      console.error("Basil checkout session creation failed", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
      setNotice(error instanceof Error ? error.message : "Checkout could not start.");
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => setVerificationPending(loadPendingVerification()));
    const client = getGardenAccountClient();
    if (!client) {
      queueMicrotask(() => {
        setAccountState({ status: "error", message: "Private accounts are not configured yet." });
      });
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const stewardStatus = params.get("steward");
    const tokenHash = params.get("token_hash");
    const verificationType = params.get("type");
    if (
      stewardStatus === "confirm-account" &&
      tokenHash &&
      (verificationType === "signup" ||
        verificationType === "recovery" ||
        verificationType === "magiclink")
    ) {
      queueMicrotask(() => {
        setPendingLink({
          tokenHash,
          type: verificationType,
          checkout: params.get("checkout") === "1",
          setup: params.get("setup") === "1",
          verified: false,
        });
      });
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

    queueMicrotask(() => {
      if (stewardStatus === "welcome") {
        trackMetaCustomEvent("BasilCheckoutCompleted");
        setNotice("Purchase complete. Your Garden Membership is ready on this account.");
      } else if (stewardStatus === "verification-sent") {
        trackMetaCustomEvent("BasilCheckoutCompleted");
        setPaidVerificationPending(true);
        setNotice("Payment complete. Your preview garden is safely stored on the server.");
      } else if (stewardStatus === "unverified") {
        setNotice("The purchase could not be verified. Please check your Stripe receipt.");
      } else if (params.get("checkout") === "cancelled") {
        trackMetaCustomEvent("BasilCheckoutCanceled");
        void trackBasilFunnelEvent("checkout_canceled");
        setNotice("Checkout cancelled. The community garden is still free to play.");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadAccount]);

  useEffect(() => {
    if (!paidVerificationPending || session) return;
    queueMicrotask(() => void refreshPaidPurchaseStatus());
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshPaidPurchaseStatus();
      }
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [paidVerificationPending, refreshPaidPurchaseStatus, session]);

  async function sendAccountEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = authView === "signup" ? "signup" : "recovery";
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    if (intent === "signup" && password !== passwordConfirm) {
      setNotice("Those passwords do not match.");
      return;
    }

    setBusy("account-email");
    setNotice("");
    if (intent === "signup") {
      void trackBasilFunnelEvent("signup_started");
    }
    try {
      const response = await fetch("/api/community-garden/auth/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intent,
          email: trimmedEmail,
          password: intent === "signup" ? password : undefined,
        }),
      });
      if (!response.ok) {
        throw new Error(await getResponseError(response, "The account email could not be sent."));
      }
      const payload = (await response.json()) as {
        message?: string;
        accountStatus?: "new" | "existing";
      };
      setPassword("");
      setPasswordConfirm("");
      const pending = {
        email: trimmedEmail,
        existingAccount: payload.accountStatus === "existing",
      };
      setVerificationPending(pending);
      savePendingVerification(pending);
      trackMetaCustomEvent("BasilVerificationEmailSent", {
        account_status: payload.accountStatus ?? "new",
      });
      void trackBasilFunnelEvent("verification_sent");
      setNotice(
        payload.message ??
          "Check your email for a private account message from Basil by Goetz.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The account email could not be sent.");
    } finally {
      setBusy(null);
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getGardenAccountClient();
    if (!client || !email.trim() || !password) return;

    setBusy("sign-in");
    setNotice("");
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error || !data.session) {
      setBusy(null);
      if (
        error?.message.toLowerCase().includes("email not confirmed") ||
        error?.message.toLowerCase().includes("email_not_confirmed")
      ) {
        const pending = { email: email.trim(), existingAccount: true };
        setVerificationPending(pending);
        savePendingVerification(pending);
        setNotice(
          "This account already exists but has not yet been verified. Check your email or resend the verification link.",
        );
        return;
      }
      setNotice(
        error?.message === "Invalid login credentials"
          ? "That email or password was not recognized. You can reset the password below."
          : error?.message ?? "Basil could not sign in.",
      );
      return;
    }

    setSession(data.session);
    setPassword("");
    const account = await loadAccount(data.session);
    if (account?.active) {
      setNotice("Signed in. Your Garden Membership is active.");
      setBusy(null);
      return;
    }
    if (account) {
      await beginCheckout(data.session);
      return;
    }
    setBusy(null);
  }

  async function confirmAccountLink() {
    const client = getGardenAccountClient();
    if (!client || !pendingLink || pendingLink.verified) return;

    setBusy("confirm-account");
    setNotice("");
    const { data, error } = await client.auth.verifyOtp({
      token_hash: pendingLink.tokenHash,
      type: pendingLink.type,
    });
    if (error || !data.session) {
      setBusy(null);
      clearAccountLinkFromAddress();
      setPendingLink(null);
      setVerificationPending(loadPendingVerification());
      setNotice(
        "That verification link has expired or was already used. Resend a fresh link or return to sign in.",
      );
      return;
    }

    clearAccountLinkFromAddress();
    savePendingVerification(null);
    setVerificationPending(null);
    setPaidVerificationPending(false);
    trackMetaCustomEvent("BasilVerificationCompleted");
    void trackBasilFunnelEvent("verification_completed");
    setSession(data.session);
    await finalizePaidVerification(data.session);
    if (pendingLink.type === "recovery" || pendingLink.setup) {
      setPendingLink({ ...pendingLink, verified: true });
      setPassword("");
      setPasswordConfirm("");
      setBusy(null);
      setNotice("Email confirmed. Choose the password you want to use on your devices.");
      return;
    }

    setPendingLink(null);
    if (pendingLink.checkout) {
      await beginCheckout(data.session);
    } else {
      await loadAccount(data.session);
      setBusy(null);
    }
  }

  async function setNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getGardenAccountClient();
    if (!client || !session || !pendingLink?.verified) return;
    if (password !== passwordConfirm) {
      setNotice("Those passwords do not match.");
      return;
    }
    if (password.length < 10 || password.length > 128) {
      setNotice("Use a password between 10 and 128 characters.");
      return;
    }

    setBusy("set-password");
    setNotice("");
    const { error } = await client.auth.updateUser({ password });
    if (error) {
      setBusy(null);
      setNotice(error.message);
      return;
    }

    const continueToCheckout = pendingLink.checkout;
    setPassword("");
    setPasswordConfirm("");
    setPendingLink(null);
    if (continueToCheckout) {
      await beginCheckout(session);
    } else {
      await loadAccount(session);
      setNotice("Password updated. You are signed in on this device.");
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

  async function resendVerification() {
    if (!verificationPending?.email) return;
    setBusy("resend-verification");
    setNotice("");
    try {
      const response = await fetch("/api/community-garden/auth/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intent: "recovery",
          email: verificationPending.email,
        }),
      });
      if (!response.ok) {
        throw new Error(
          await getResponseError(
            response,
            "The verification email could not be resent.",
          ),
        );
      }
      setNotice(
        "A fresh Basil verification email was sent. Check spam, junk, promotions, and other filtered folders too.",
      );
      trackMetaCustomEvent("BasilVerificationEmailResent");
      void trackBasilFunnelEvent("verification_sent");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The verification email could not be resent.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function resendPaidVerification() {
    setBusy("resend-paid-verification");
    setNotice("");
    try {
      const response = await fetch("/api/community-garden/purchase/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "resend" }),
      });
      if (!response.ok) {
        throw new Error(
          await getResponseError(
            response,
            "The Basil confirmation email could not be resent.",
          ),
        );
      }
      const payload = (await response.json()) as { email?: string };
      setNotice(
        `A fresh Basil confirmation was sent${
          payload.email ? ` to ${payload.email}` : ""
        }. Check spam, junk, and promotions too.`,
      );
      trackMetaCustomEvent("BasilVerificationEmailResent");
      await refreshPaidPurchaseStatus();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The Basil confirmation email could not be resent.",
      );
    } finally {
      setBusy(null);
    }
  }

  const confirmAccountLinkEvent = useEffectEvent(confirmAccountLink);

  useEffect(() => {
    if (!pendingLink || pendingLink.verified) return;
    if (confirmationStartedRef.current === pendingLink.tokenHash) return;
    confirmationStartedRef.current = pendingLink.tokenHash;
    queueMicrotask(() => void confirmAccountLinkEvent());
  }, [pendingLink]);

  const showAccountLink = Boolean(pendingLink);
  const showVerificationPending =
    Boolean(verificationPending) &&
    !showAccountLink &&
    accountState.status !== "active";
  const showPaidVerificationPending =
    paidVerificationPending &&
    !showAccountLink &&
    accountState.status !== "active";

  return (
    <section className="cg-steward" aria-labelledby="garden-steward-title">
      <p className="cg-kicker">One time · $6.99</p>
      <h2 id="garden-steward-title">Community Garden Membership</h2>
      <p className="cg-steward-lead">
        Keep playing the Community Garden for free and try three flowers in My
        Garden. Membership keeps what you started and saves it across devices.
      </p>

      {notice ? <p className="cg-steward-notice" aria-live="polite">{notice}</p> : null}

      {accountState.status !== "active" && !showAccountLink && !showVerificationPending && !showPaidVerificationPending ? (
        <div className="cg-pass-preview">
          <div className="cg-pass-ticket" aria-label="Basil Community Garden Membership">
            <div className="cg-pass-ticket-art" aria-hidden="true">
              <span className="cg-pass-sun" />
              <span className="cg-pass-flower is-one" />
              <span className="cg-pass-flower is-two" />
              <span className="cg-pass-flower is-three" />
            </div>
            <div className="cg-pass-ticket-copy">
              <small>Basil Community Garden</small>
              <strong>Garden Member</strong>
              <span>My Garden forever · One payment, no subscription</span>
            </div>
          </div>

          <div className="cg-pass-promise">
            <p className="cg-auth-step">Keep what you started</p>
            <h3>Let your preview garden grow</h3>
            <p>
              Save your preview flowers and Care, then grow your garden by
              helping the Community Garden flourish.
            </p>
          </div>

          <ul className="cg-pass-benefits">
            <li>
              <span className="cg-benefit-icon is-almanac" aria-hidden="true">01</span>
              <div>
                <strong>Keep your cozy garden</strong>
                <p>Your preview flowers remain, plus a walkable property, little shed, and 8 starter Care.</p>
              </div>
            </li>
            <li>
              <span className="cg-benefit-icon is-ideas" aria-hidden="true">02</span>
              <div>
                <strong>Earn Care by helping everyone</strong>
                <p>Everyone sees Care earned. Membership permanently banks it for your home garden.</p>
              </div>
            </li>
            <li>
              <span className="cg-benefit-icon is-devices" aria-hidden="true">03</span>
              <div>
                <strong>Keep it on every device</strong>
                <p>Your garden, Almanac, and membership follow your private account.</p>
              </div>
            </li>
          </ul>

          <div className="cg-pass-offer">
            <div>
              <span>One-time membership</span>
              <strong>$6.99</strong>
            </div>
            <p>No subscription. Community play stays free for everyone.</p>
          </div>
        </div>
      ) : null}

      {accountState.status === "loading" && !showAccountLink && !showVerificationPending && !showPaidVerificationPending ? (
        <p className="cg-steward-loading">Checking for a private Basil account…</p>
      ) : null}

      {accountState.status === "error" && !showAccountLink && !showVerificationPending && !showPaidVerificationPending ? (
        <div className="cg-steward-error" role="alert">
          <p>{accountState.message}</p>
          {session ? (
            <button type="button" onClick={() => void loadAccount(session)}>Try again</button>
          ) : null}
        </div>
      ) : null}

      {pendingLink && !pendingLink.verified ? (
        <div className="cg-sign-in cg-auth-confirm">
          <p className="cg-auth-step">Account confirmation</p>
          <h3>Verifying your Basil account</h3>
          <p>
            Please wait while Basil confirms your email
            {pendingLink.checkout ? " and resumes your purchase." : "."}
          </p>
          <button
            type="button"
            disabled={busy === "confirm-account"}
            onClick={() => void confirmAccountLink()}
          >
            {busy === "confirm-account"
              ? "Confirming account…"
              : pendingLink.checkout
                ? "Confirm account & continue to payment"
                : "Confirm Basil account"}
          </button>
        </div>
      ) : null}

      {showVerificationPending && verificationPending ? (
        <div className="cg-sign-in cg-auth-confirm cg-verification-pending">
          <p className="cg-auth-step">Account created</p>
          <h3>Check your email to verify your account</h3>
          <p>
            We sent a verification link to <strong>{verificationPending.email}</strong>.
            Open the email and follow the link before signing in or continuing your
            purchase.
          </p>
          {verificationPending.existingAccount ? (
            <p className="cg-auth-existing">
              This account already exists but may not yet be verified. Check your email
              or resend the verification link.
            </p>
          ) : null}
          <p className="cg-auth-folder-reminder">
            The message is from Basil by Goetz. If it is not in your inbox, check spam,
            junk, promotions, and other filtered folders.
          </p>
          <button
            type="button"
            disabled={busy === "resend-verification"}
            onClick={() => void resendVerification()}
          >
            {busy === "resend-verification"
              ? "Sending a fresh link..."
              : "Resend verification email"}
          </button>
          <button
            className="cg-auth-text-button"
            type="button"
            onClick={() => {
              savePendingVerification(null);
              setVerificationPending(null);
              setEmail("");
              setAuthView("signup");
              setNotice("");
            }}
          >
            Change email address
          </button>
          <button
            className="cg-auth-text-button"
            type="button"
            onClick={() => {
              savePendingVerification(null);
              setVerificationPending(null);
              setAuthView("signin");
              setNotice("After verifying, sign in here to continue your purchase.");
            }}
          >
            Return to sign in after verification
          </button>
        </div>
      ) : null}

      {showPaidVerificationPending ? (
        <div className="cg-sign-in cg-auth-confirm cg-verification-pending">
          <p className="cg-auth-step">Payment complete</p>
          <h3>Check your email to finish your Basil account</h3>
          <p>
            We sent a Basil verification link
            {paidPurchaseStatus?.email ? (
              <> to <strong>{paidPurchaseStatus.email}</strong></>
            ) : null}
            . {paidPurchaseStatus?.paid
              ? "Your preview flowers, paths, and remaining Care are already stored safely."
              : "Basil is finishing the secure save of your preview garden."}
          </p>
          {paidPurchaseStatus?.error ? (
            <p className="cg-auth-existing" role="alert">
              Your payment is safe, but Basil needs another moment to finish saving
              the garden. This page will keep trying.
            </p>
          ) : null}
          <p className="cg-auth-folder-reminder">
            The message is from Basil by Goetz. If it is not in your inbox, check spam,
            junk, promotions, and other filtered folders.
          </p>
          <button
            type="button"
            disabled={busy === "resend-paid-verification"}
            onClick={() => void resendPaidVerification()}
          >
            {busy === "resend-paid-verification"
              ? "Sending a fresh confirmation…"
              : "Resend confirmation email"}
          </button>
          <button
            className="cg-auth-text-button"
            type="button"
            onClick={() => void refreshPaidPurchaseStatus()}
          >
            I verified — continue on this device
          </button>
        </div>
      ) : null}

      {pendingLink?.verified ? (
        <div className="cg-sign-in cg-auth-confirm">
          <p className="cg-auth-step">Private password</p>
          <h3>Choose your Basil password</h3>
          <p>This password is only for signing in. Nothing becomes public in the garden.</p>
          <form onSubmit={setNewPassword}>
            <label htmlFor="basil-new-password">New password</label>
            <input
              id="basil-new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
            />
            <label htmlFor="basil-new-password-confirm">Confirm password</label>
            <input
              id="basil-new-password-confirm"
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
            />
            <small className="cg-auth-help">Use at least 10 characters.</small>
            <button
              type="submit"
              disabled={
                busy === "set-password" ||
                password.length < 10 ||
                password !== passwordConfirm
              }
            >
              {busy === "set-password"
                ? "Saving password…"
                : pendingLink.checkout
                  ? "Save password & continue to payment"
                  : "Save new password"}
            </button>
          </form>
        </div>
      ) : null}

      {accountState.status === "signed-out" && !showAccountLink && !showVerificationPending && !showPaidVerificationPending ? (
        <div className="cg-sign-in">
          <ol className="cg-auth-steps" aria-label="Purchase steps">
            <li><span>1</span>Private account</li>
            <li><span>2</span>Email confirmation</li>
            <li><span>3</span>Secure payment</li>
          </ol>
          <div className="cg-auth-tabs" role="group" aria-label="Account options">
            <button
              type="button"
              aria-pressed={authView === "signin"}
              onClick={() => {
                setAuthView("signin");
                setNotice("");
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              aria-pressed={authView === "signup"}
              onClick={() => {
                setAuthView("signup");
                setNotice("");
              }}
            >
              Create account
            </button>
          </div>

          {authView === "signin" ? (
            <>
              <h3>Sign in & continue</h3>
              <p>
                Your email is your private login. There is no public username, profile,
                or name attached to what you plant.
              </p>
              <form onSubmit={signIn}>
                <label htmlFor="basil-signin-email">Email address</label>
                <input
                  id="basil-signin-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
                <label htmlFor="basil-signin-password">Password</label>
                <input
                  id="basil-signin-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="submit"
                  disabled={busy === "sign-in" || !email.trim() || !password}
                >
                  {busy === "sign-in" ? "Signing in…" : "Sign in & continue"}
                </button>
              </form>
              <button
                className="cg-auth-text-button"
                type="button"
                onClick={() => {
                  setAuthView("recovery");
                  setPassword("");
                  setNotice("");
                }}
              >
                Forgot your password?
              </button>
            </>
          ) : null}

          {authView === "signup" ? (
            <>
              <h3>Create a private account</h3>
              <p>
                Use the same email on your other devices. We will send one confirmation
                from Basil by Goetz, then take you to the $6.99 Stripe checkout.
              </p>
              <form onSubmit={sendAccountEmail}>
                <label htmlFor="basil-signup-email">Email address</label>
                <input
                  id="basil-signup-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
                <label htmlFor="basil-signup-password">Create password</label>
                <input
                  id="basil-signup-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                />
                <label htmlFor="basil-signup-password-confirm">Confirm password</label>
                <input
                  id="basil-signup-password-confirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                />
                <small className="cg-auth-help">Use at least 10 characters.</small>
                <button
                  type="submit"
                  disabled={
                    busy === "account-email" ||
                    !email.trim() ||
                    password.length < 10 ||
                    password !== passwordConfirm
                  }
                >
                  {busy === "account-email"
                    ? "Sending confirmation…"
                    : "Create account & continue to payment"}
                </button>
              </form>
            </>
          ) : null}

          {authView === "recovery" ? (
            <>
              <h3>Reset your password</h3>
              <p>
                We will send a private password-reset email from Basil by Goetz. You will
                stay signed in on this device afterward.
              </p>
              <form onSubmit={sendAccountEmail}>
                <label htmlFor="basil-recovery-email">Email address</label>
                <input
                  id="basil-recovery-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
                <button
                  type="submit"
                  disabled={busy === "account-email" || !email.trim()}
                >
                  {busy === "account-email" ? "Sending reset…": "Email me a password reset"}
                </button>
              </form>
              <button
                className="cg-auth-text-button"
                type="button"
                onClick={() => {
                  setAuthView("signin");
                  setNotice("");
                }}
              >
                Back to sign in
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {accountState.status === "free" && !showAccountLink && !showVerificationPending && !showPaidVerificationPending ? (
        <div className="cg-pass-card">
          <div className="cg-signed-in-row">
            <span>Signed in privately as {accountState.email}</span>
            <button type="button" onClick={() => void signOut()}>Sign out</button>
          </div>
          <div className="cg-pass-price">
            <span>Garden Membership</span>
            <strong>$6.99</strong>
            <small>once, not a subscription</small>
          </div>
          <ul>
            <li>Keep your preview flowers and remaining temporary Care</li>
            <li>Starter pack: a walkable fenced property, cozy shed, and 8 Care</li>
            <li>Plant and uproot inside your personal garden</li>
            <li>Permanent plants plus benches, birdhouses, and pavers to place</li>
            <li>Use membership on any browser or device with the same email</li>
            <li>Garden Almanac with live community totals</li>
            <li>Feedback tracked through the upgrade queue</li>
          </ul>
          <button
            className="cg-support-button"
            type="button"
            disabled={busy === "checkout" || !session}
            onClick={() => session && void beginCheckout(session)}
          >
            {busy === "checkout" ? "Opening secure checkout…" : "Keep My Garden · $6.99"}
          </button>
        </div>
      ) : null}

      {accountState.status === "active" && !showAccountLink ? (
        <div className="cg-steward-account">
          <div className="cg-steward-welcome">
            <div className="cg-signed-in-row">
              <span>Signed in privately as {accountState.account.steward.email}</span>
              <button type="button" disabled={busy === "sign-out"} onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
            <p className="cg-kicker">Community Garden Membership</p>
            <h3>Membership active</h3>
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

      {session && !showAccountLink && !showVerificationPending && !showPaidVerificationPending ? (
        <GardenHealthPanel session={session} />
      ) : null}

      <div className="cg-steward-privacy">
        <strong>Private account, anonymous play</strong>
        <p>
          Basil stores your private account email, payment entitlement, and feedback.
          Stripe handles card and receipt details. The public garden never shows who you
          are or connects your identity to plants. You stay signed in on a device until
          you sign out. Future verified store purchases can attach to this same account.
        </p>
      </div>
    </section>
  );
}
