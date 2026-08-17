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
import { GARDEN_MEMBERSHIP_PRICE_LABEL } from "@/lib/communityGarden/membershipConfig";
import {
  trackBasilMetaCheckout,
  trackBasilMetaStandardEvent,
} from "@/lib/analytics/basilMetaClient";
import { getGardenAccountClient } from "../lib/supabaseAccount";
import {
  getBasilLaunchSessionId,
  trackBasilFunnelEvent,
} from "../lib/launchFunnel";
import { GardenHealthPanel } from "./GardenHealthPanel";
import { GardenCatalogSprite } from "./GardenCatalogSprite";
import type { HeritageSeedStatus } from "@/lib/communityGarden/heritageSeeds";
import type { GardenStewardshipSummary } from "../lib/stewardshipTypes";
import { CommunityStewardshipPanel } from "./CommunityStewardship";
import type { getGuestPreviewImport } from "../lib/guestGardenPreview";

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
  newsletterSubscribed: boolean;
  heritage: HeritageSeedStatus;
  stewardship: GardenStewardshipSummary;
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

export type GardenGiftPreview = ReturnType<typeof getGuestPreviewImport>;

type GardenStewardProps = {
  giftPreview: GardenGiftPreview;
  onMembershipActivated: () => void;
  onVisitHeritage?: (gridX: number, gridY: number) => void;
  onViewCommunityGarden: () => void;
};

function flowerName(type: "rose" | "sunflower" | "lavender") {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function GardenSteward({
  giftPreview,
  onMembershipActivated,
  onVisitHeritage,
  onViewCommunityGarden,
}: GardenStewardProps) {
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
  const [promoCode, setPromoCode] = useState("");
  const [category, setCategory] = useState("plants");
  const [idea, setIdea] = useState("");
  const [replacingTaskId, setReplacingTaskId] = useState<string | null>(null);
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
      setAccountState((current) =>
        current.status === "active"
          ? current
          : {
              status: "error",
              message:
                error instanceof Error
                  ? error.message
                  : "Could not load the membership.",
            },
      );
      return null;
    }
  }, []);

  const replaceStewardshipTask = useCallback(async (assignmentId: string) => {
    if (!session || accountState.status !== "active") return;
    setReplacingTaskId(assignmentId);
    try {
      const response = await fetch("/api/community-garden/stewardship", {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "replace", assignmentId }),
      });
      if (!response.ok) {
        throw new Error(await getResponseError(response, "That task could not be replaced."));
      }
      const stewardship = (await response.json()) as GardenStewardshipSummary;
      setAccountState((current) =>
        current.status === "active"
          ? { ...current, account: { ...current.account, stewardship } }
          : current,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That task could not be replaced.");
    } finally {
      setReplacingTaskId(null);
    }
  }, [accountState.status, session]);

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
      trackBasilMetaStandardEvent(
        "CompleteRegistration",
        "complete_registration",
        { content_name: "Basil account" },
      );
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
      const payload = (await response.json()) as { url: string; metaEventId?: string };
      if (payload.metaEventId) trackBasilMetaCheckout(payload.metaEventId);
      window.location.assign(payload.url);
    } catch (error) {
      console.error("Basil checkout session creation failed", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
      setNotice(error instanceof Error ? error.message : "Checkout could not start.");
      setBusy(null);
    }
  }, []);

  const redeemGiftCode = useCallback(async ({
    activeSession,
    accountEmail,
    accountPassword,
  }: {
    activeSession?: Session | null;
    accountEmail?: string;
    accountPassword?: string;
  }) => {
    const normalizedCode = promoCode.trim().toLowerCase();
    if (!normalizedCode) {
      setNotice("Enter your Basil gift code first.");
      return;
    }

    setBusy("gift-code");
    setNotice("");
    try {
      const response = await fetch("/api/community-garden/promo", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(activeSession
            ? { authorization: `Bearer ${activeSession.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          preview: giftPreview,
          promoCode: normalizedCode,
          ...(accountEmail ? { email: accountEmail.trim().toLowerCase() } : {}),
          ...(accountPassword ? { password: accountPassword } : {}),
        }),
      });
      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "That gift code could not be used."),
        );
      }
      const gift = (await response.json()) as { createdAccount?: boolean };

      let memberSession = activeSession ?? null;
      if (!memberSession) {
        const client = getGardenAccountClient();
        if (!client || !accountEmail || !accountPassword) {
          throw new Error(
            "Your gift was accepted, but Basil could not sign you in automatically.",
          );
        }
        const { data, error } = await client.auth.signInWithPassword({
          email: accountEmail.trim().toLowerCase(),
          password: accountPassword,
        });
        if (error || !data.session) {
          throw new Error(
            error?.message ??
              "Your gift was accepted, but Basil could not sign you in automatically.",
          );
        }
        memberSession = data.session;
        setSession(data.session);
      }

      if (gift.createdAccount) {
        trackBasilMetaStandardEvent(
          "CompleteRegistration",
          "complete_registration",
          { content_name: "Basil gift account" },
        );
        void trackBasilFunnelEvent("verification_completed");
      }
      await loadAccount(memberSession);
      setPromoCode("");
      setPassword("");
      setPasswordConfirm("");
      setNotice("Gift accepted. Your Garden Membership is active.");
      setBusy(null);
      onMembershipActivated();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "That gift code could not be used.",
      );
      setBusy(null);
    }
  }, [giftPreview, loadAccount, onMembershipActivated, promoCode]);

  useEffect(() => {
    queueMicrotask(() => setVerificationPending(loadPendingVerification()÷~v¶‰žËkºwµçM¥¹ÕÀµÁÉ½µ¼ˆ(€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰Ñ•áÐˆ(€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÁÉ½µ½½‘•ô(€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•ÑAÉ½µ½½‘”¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¹Ñ½1½Ý•É…Í” ¤¥ô(€€€€€€€€€€€€€€€€€€€…ÕÑ½½µÁ±•Ñ”ô‰½™˜ˆ(€€€€€€€€€€€€€€€€€€€…ÕÑ½…Á¥Ñ…±¥é”ô‰¹½¹”ˆ(€€€€€€€€€€€€€€€€€€€…ÕÑ½½ÉÉ•Ðô‰½™˜ˆ(€€€€€€€€€€€€€€€€€€€ÍÁ•±±¡•¬õí™…±Í•ô(€€€€€€€€€€€€€€€€€€€µ…á1•¹Ñ õìÌÉô(€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰•¹Ñ•È¥™Ð½‘”ˆ(€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí‰ÕÍä€ôôô€‰…½Õ¹Ðµ•µ…¥°ˆñð‰ÕÍä€ôôô€‰¥™Ðµ½‘”‰ô(€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€ñÍµ…±°ù¥™Ð½‘”Í­¥ÁÌ•µ…¥°½¹™¥Éµ…Ñ¥½¸…¹Á…åµ•¹Ð¸ð½Íµ…±°ø(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ñ±…‰•°¡Ñµ±½Èô‰‰…Í¥°µÍ¥¹ÕÀµ•µ…¥°ˆùµ…¥°…‘‘É•ÍÌð½±…‰•°ø(€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ4(€€€€€€€€€€€€€€€€€¥ô‰‰…Í¥°µÍ¥¹ÕÀµ•µ…¥°ˆ4(€€€€€€€€€€€€€€€€€ÑåÁ”ô‰•µ…¥°ˆ4(€€€€€€€€€€€€€€€€€Ù…±Õ”õí•µ…¥±ô4(€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•Ñµ…¥°¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¥ô4(€€€€€€€€€€€€€€€€€…ÕÑ½½µÁ±•Ñ”ô‰•µ…¥°ˆ4(€€€€€€€€€€€€€€€€€É•ÅÕ¥É•4(€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€ñ±…‰•°¡Ñµ±½Èô‰‰…Í¥°µÍ¥¹ÕÀµÁ…ÍÍÝ½ÉˆùÉ•…Ñ”Á…ÍÍÝ½Éð½±…‰•°ø4(€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ4(€€€€€€€€€€€€€€€€€¥ô‰‰…Í¥°µÍ¥¹ÕÀµÁ…ÍÍÝ½Éˆ4(€€€€€€€€€€€€€€€€€ÑåÁ”ô‰Á…ÍÍÝ½Éˆ4(€€€€€€€€€€€€€€€€€Ù…±Õ”õíÁ…ÍÍÝ½É‘ô4(€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•ÑA…ÍÍÝ½É¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¥ô4(€€€€€€€€€€€€€€€€€…ÕÑ½½µÁ±•Ñ”ô‰¹•ÜµÁ…ÍÍÝ½Éˆ4(€€€€€€€€€€€€€€€€€µ¥¹1•¹Ñ õìÄÁô4(€€€€€€€€€€€€€€€€€µ…á1•¹Ñ õìÄÈáô4(€€€€€€€€€€€€€€€€€É•ÅÕ¥É•4(€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€ñ±…‰•°¡Ñµ±½Èô‰‰…Í¥°µÍ¥¹ÕÀµÁ…ÍÍÝ½Éµ½¹™¥É´ˆù½¹™¥É´Á…ÍÍÝ½Éð½±…‰•°ø4(€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ4(€€€€€€€€€€€€€€€€€¥ô‰‰…Í¥°µÍ¥¹ÕÀµÁ…ÍÍÝ½Éµ½¹™¥É´ˆ4(€€€€€€€€€€€€€€€€€ÑåÁ”ô‰Á…ÍÍÝ½Éˆ4(€€€€€€€€€€€€€€€€€Ù…±Õ”õíÁ…ÍÍÝ½É‘½¹™¥Éµô4(€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•ÑA…ÍÍÝ½É‘½¹™¥É´¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¥ô4(€€€€€€€€€€€€€€€€€…ÕÑ½½µÁ±•Ñ”ô‰¹•ÜµÁ…ÍÍÝ½Éˆ4(€€€€€€€€€€€€€€€€€µ¥¹1•¹Ñ õìÄÁô4(€€€€€€€€€€€€€€€€€µ…á1•¹Ñ õìÄÈáô4(€€€€€€€€€€€€€€€€€É•ÅÕ¥É•4(€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€ñÍµ…±°±…ÍÍ9…µ”ô‰œµ…ÕÑ µ¡•±ÀˆùUÍ”…Ð±•…ÍÐ€ÄÀ¡…É…Ñ•ÉÌ¸ð½Íµ…±°ø4(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸4(€€€€€€€€€€€€€€€€€ÑåÁ”ô‰ÍÕ‰µ¥Ðˆ4(€€€€€€€€€€€€€€€€€‘¥Í…‰±•õì(€€€€€€€€€€€€€€€€€€€‰ÕÍä€ôôô€‰…½Õ¹Ðµ•µ…¥°ˆñð‰ÕÍä€ôôô€‰¥™Ðµ½‘”ˆñð(€€€€€€€€€€€€€€€€€€€€…•µ…¥°¹ÑÉ¥´ ¤ñð(€€€€€€€€€€€€€€€€€€€Á…ÍÍÝ½É¹±•¹Ñ €ð€ÄÀñð(€€€€€€€€€€€€€€€€€€€Á…ÍÍÝ½É€„ôôÁ…ÍÍÝ½É‘½¹™¥É´(€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€í‰ÕÍä€ôôô€‰…½Õ¹Ðµ•µ…¥°ˆ(€€€€€€€€€€€€€€€€€€€€ü€‰M•¹‘¥¹œ½¹™¥Éµ…Ñ¥½»Š˜ˆ(€€€€€€€€€€€€€€€€€€€€è‰ÕÍä€ôôô€‰¥™Ðµ½‘”ˆ(€€€€€€€€€€€€€€€€€€€€€€ü€‰ÁÁ±å¥¹œ¥™ÓŠ˜ˆ(€€€€€€€€€€€€€€€€€€€€€€èÁÉ½µ½½‘”¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€€€€€€€€€ü€‰É•…Ñ”…½Õ¹Ð€˜ÕÍ”¥™Ð½‘”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€è€‰É•…Ñ”…½Õ¹Ð€˜½¹Ñ¥¹Õ”Ñ¼Á…åµ•¹Ð‰ô(€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ð½™½É´ø4(€€€€€€€€€€€€ð¼ø4(€€€€€€€€€€¤€è¹Õ±±ô4(4(€€€€€€€€€í…ÕÑ¡Y¥•Ü€ôôô€‰É•½Ù•Éäˆ€ü€ 4(€€€€€€€€€€€€ðø4(€€€€€€€€€€€€€€ñ ÌùI•Í•Ðå½ÕÈÁ…ÍÍÝ½Éð½ Ìø4(€€€€€€€€€€€€€€ñÀø4(€€€€€€€€€€€€€€€]”Ý¥±°Í•¹„ÁÉ¥Ù…Ñ”Á…ÍÍÝ½ÉµÉ•Í•Ð•µ…¥°™É½´	…Í¥°‰ä½•Ñè¸e½ÔÝ¥±°4(€€€€€€€€€€€€€€€ÍÑ…äÍ¥¹•¥¸½¸Ñ¡¥Ì‘•Ù¥”…™Ñ•ÉÝ…É¸4(€€€€€€€€€€€€€€ð½Àø4(€€€€€€€€€€€€€€ñ™½É´½¹MÕ‰µ¥ÐõíÍ•¹‘½Õ¹Ñµ…¥±ôø4(€€€€€€€€€€€€€€€€ñ±…‰•°¡Ñµ±½Èô‰‰…Í¥°µÉ•½Ù•Éäµ•µ…¥°ˆùµ…¥°…‘‘É•ÍÌð½±…‰•°ø4(€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ4(€€€€€€€€€€€€€€€€€¥ô‰‰…Í¥°µÉ•½Ù•Éäµ•µ…¥°ˆ4(€€€€€€€€€€€€€€€€€ÑåÁ”ô‰•µ…¥°ˆ4(€€€€€€€€€€€€€€€€€Ù…±Õ”õí•µ…¥±ô4(€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•Ñµ…¥°¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¥ô4(€€€€€€€€€€€€€€€€€…ÕÑ½½µÁ±•Ñ”ô‰•µ…¥°ˆ4(€€€€€€€€€€€€€€€€€É•ÅÕ¥É•4(€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸4(€€€€€€€€€€€€€€€€€ÑåÁ”ô‰ÍÕ‰µ¥Ðˆ4(€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí‰ÕÍä€ôôô€‰…½Õ¹Ðµ•µ…¥°ˆñð€…•µ…¥°¹ÑÉ¥´ ¥ô4(€€€€€€€€€€€€€€€€ø4(€€€€€€€€€€€€€€€€€í‰ÕÍä€ôôô€‰…½Õ¹Ðµ•µ…¥°ˆ€ü€‰M•¹‘¥¹œÉ•Í•ÓŠ˜ˆè€‰µ…¥°µ”„Á…ÍÍÝ½ÉÉ•Í•Ð‰ô4(€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø4(€€€€€€€€€€€€€€ð½™½É´ø4(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸4(€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰œµ…ÕÑ µÑ•áÐµ‰ÕÑÑ½¸ˆ4(€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ4(€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøì4(€€€€€€€€€€€€€€€€€Í•ÑÕÑ¡Y¥•Ü ‰Í¥¹¥¸ˆ¤ì4(€€€€€€€€€€€€€€€€€Í•Ñ9½Ñ¥” ˆˆ¤ì4(€€€€€€€€€€€€€€€õô4(€€€€€€€€€€€€€€ø4(€€€€€€€€€€€€€€€	…¬Ñ¼Í¥¸¥¸4(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø4(€€€€€€€€€€€€ð¼ø4(€€€€€€€€€€¤€è¹Õ±±ô4(€€€€€€€€ð½‘¥Øø4(€€€€€€¤€è¹Õ±±ô4(4(€€€€€í…½Õ¹ÑMÑ…Ñ”¹ÍÑ…ÑÕÌ€ôôô€‰™É•”ˆ€˜˜€…Í¡½Ý½Õ¹Ñ1¥¹¬€˜˜€…Í¡½ÝY•É¥™¥…Ñ¥½¹A•¹‘¥¹œ€˜˜€…Í¡½ÝA…¥‘Y•É¥™¥…Ñ¥½¹A•¹‘¥¹œ€ü€ 4(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰œµÁ…ÍÌµ…Éˆø4(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰œµÍ¥¹•µ¥¸µÉ½Üˆø4(€€€€€€€€€€€€ñÍÁ…¸ùM¥¹•¥¸ÁÉ¥Ù…Ñ•±ä…Ìí…½Õ¹ÑMÑ…Ñ”¹•µ…¥±ôð½ÍÁ…¸ø4(€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÙ½¥Í¥¹=ÕÐ ¥ôùM¥¸½ÕÐð½‰ÕÑÑ½¸ø4(€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰œµÁ…ÍÌµÁÉ¥”ˆø(€€€€€€€€€€€€ñÍÁ…¸ù…É‘•¸5•µ‰•ÉÍ¡¥Àð½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÑÉ½¹œùíI9}55	IM!%A}AI%}1	1ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€ñÍµ…±°ù½¹”°¹½Ð„ÍÕ‰ÍÉ¥ÁÑ¥½¸ð½Íµ…±°ø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰œµµ•µ‰•ÉÍ¡¥Àµ¥™Ðµ½‘”¥ÌµÁÉ½µ¥¹•¹Ðˆø(€€€€€€€€€€€€ñ±…‰•°¡Ñµ±½Èô‰‰…Í¥°µ…½Õ¹ÐµÁÉ½µ¼ˆù!…Ù”„¥™Ð½‘”üð½±…‰•°ø(€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€¥ô‰‰…Í¥°µ…½Õ¹ÐµÁÉ½µ¼ˆ(€€€€€€€€€€€€€ÑåÁ”ô‰Ñ•áÐˆ(€€€€€€€€€€€€€Ù…±Õ”õíÁÉ½µ½½‘•ô(€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•ÑAÉ½µ½½‘”¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¹Ñ½1½Ý•É…Í” ¤¥ô(€€€€€€€€€€€€€…ÕÑ½½µÁ±•Ñ”ô‰½™˜ˆ(€€€€€€€€€€€€€…ÕÑ½…Á¥Ñ…±¥é”ô‰¹½¹”ˆ(€€€€€€€€€€€€€…ÕÑ½½ÉÉ•Ðô‰½™˜ˆ(€€€€€€€€€€€€€ÍÁ•±±¡•¬õí™…±Í•ô(€€€€€€€€€€€€€µ…á1•¹Ñ õìÌÉô(€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰•¹Ñ•È¥™Ð½‘”ˆ(€€€€€€€€€€€€€‘¥Í…‰±•õí‰ÕÍä€ôôô€‰¥™Ðµ½‘”ˆñð‰ÕÍä€ôôô€‰¡•­½ÕÐ‰ô(€€€€€€€€€€€€¼ø(€€€€€€€€€€€€ñÍµ…±°ùÙ…±¥¥™Ð½‘”…Ñ¥Ù…Ñ•Ìµ•µ‰•ÉÍ¡¥ÀÝ¥Ñ¡½ÕÐÁ…åµ•¹Ð¸ð½Íµ…±°ø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰œµ¥™Ðµ½‘”µ‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€‘¥Í…‰±•õí‰ÕÍä€ôôô€‰¥™Ðµ½‘”ˆñð€…ÁÉ½µ½½‘”¹ÑÉ¥´ ¤ñð€…Í•ÍÍ¥½¹ô(€€€€€€€€€€€€€½¹±¥¬õì ¤€ôø(€€€€€€€€€€€€€€€Í•ÍÍ¥½¸€˜˜Ù½¥É•‘••µ¥™Ñ½‘”¡ì…Ñ¥Ù•M•ÍÍ¥½¸èÍ•ÍÍ¥½¸ô¤(€€€€€€€€€€€€€ô(€€€€€€€€€€€€ø(€€€€€€€€€€€€€í‰ÕÍä€ôôô€‰¥™Ðµ½‘”ˆ€ü€‰ÁÁ±å¥¹œ¥™ÓŠ˜ˆ€è€‰UÍ”¥™Ð½‘”‰ô(€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰œµµ•µ‰•ÉÍ¡¥ÀµÁ…åµ•¹Ðµ‘¥Ù¥‘•ÈˆøñÍÁ…¸ù½ÈÁ…äÍ•ÕÉ•±äð½ÍÁ…¸øð½Àø(€€€€€€€€€€ñÕ°ø(€€€€€€€€€€€€ñ±¤ù-••Àå½ÕÈÁÉ•Ù¥•Ü™±½Ý•ÉÌ…¹É•µ…¥¹¥¹œÑ•µÁ½É…Éä…É”ð½±¤ø4(€€€€€€€€€€€€ñ±¤ùMÑ…ÉÑ•ÈÁ…¬è„Ý…±­…‰±”™•¹•ÁÉ½Á•ÉÑä°½éäÍ¡•°…¹€à…É”ð½±¤ø4(€€€€€€€€€€€€ñ±¤ùA±…¹Ð…¹ÕÁÉ½½Ð¥¹Í¥‘”å½ÕÈÁ•ÉÍ½¹…°…É‘•¸ð½±¤ø4(€€€€€€€€€€€€ñ±¤ùA•Éµ…¹•¹ÐÁ±…¹ÑÌÁ±ÕÌ‰•¹¡•Ì°‰¥É‘¡½ÕÍ•Ì°…¹Á…Ù•ÉÌÑ¼Á±…”ð½±¤ø4(€€€€€€€€€€€€ñ±¤ùUÍ”µ•µ‰•ÉÍ¡¥À½¸…¹ä‰É½ÝÍ•È½È‘•Ù¥”Ý¥Ñ Ñ¡”Í…µ”•µ…¥°ð½±¤ø4(€€€€€€€€€€€€ñ±¤ù…É‘•¸±µ…¹…ŒÝ¥Ñ ±¥Ù”½µµÕ¹¥ÑäÑ½Ñ…±Ìð½±¤ø4(€€€€€€€€€€€€ñ±¤ù••‘‰…¬ÑÉ…­•Ñ¡É½Õ Ñ¡”ÕÁÉ…‘”ÅÕ•Õ”ð½±¤ø4(€€€€€€€€€€ð½Õ°ø4(€€€€€€€€€€ñ‰ÕÑÑ½¸4(€€€€€€€€€€€±…ÍÍ9…µ”ô‰œµÍÕÁÁ½ÉÐµ‰ÕÑÑ½¸ˆ(€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€‘¥Í…‰±•õí‰ÕÍä€ôôô€‰¡•­½ÕÐˆñð‰ÕÍä€ôôô€‰¥™Ðµ½‘”ˆñð€…Í•ÍÍ¥½¹ô(€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍ•ÍÍ¥½¸€˜˜Ù½¥‰•¥¹¡•­½ÕÐ¡Í•ÍÍ¥½¸¥ô4(€€€€€€€€€€ø4(€€€€€€€€€€€í‰ÕÍä€ôôô€‰¡•­½ÕÐˆ4(€€€€€€€€€€€€€€ü€‰=Á•¹¥¹œÍ•ÕÉ”¡•­½ÕÓŠ˜ˆ4(€€€€€€€€€€€€€€è-••À5ä…É‘•¸ƒ
Ü€‘íI9}55	IM!%A}AI%}1	1õô4(€€€€€€€€€€ð½‰ÕÑÑ½¸ø4(€€€€€€€€ð½‘¥Øø4(€€€€€€¤€è¹Õ±±ô4(4(€€€€€í…½Õ¹ÑMÑ…Ñ”¹ÍÑ…ÑÕÌ€ôôô€‰…Ñ¥Ù”ˆ€˜˜€…Í¡½Ý½Õ¹Ñ1¥¹¬€ü€ 4(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰œµÍÑ•Ý…Éµ…½Õ¹Ðˆø4(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰œµÍÑ•Ý…ÉµÝ•±½µ”ˆø4(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰œµÍ¥¹•µ¥¸µÉ½Üˆø4(€€€€€€€€€€€€€€ñÍÁ…¸ùM¥¹•¥¸ÁÉ¥Ù…Ñ•±ä…Ìí…½Õ¹ÑMÑ…Ñ”¹…½Õ¹Ð¹ÍÑ•Ý…É¹•µ…¥±ôð½ÍÁ…¸ø4(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘¥Í…‰±•õí‰ÕÍä€ôôô€‰Í¥¸µ½ÕÐ‰ô½¹±¥¬õì ¤€ôøÙ½¥Í¥¹=ÕÐ ¥ôø4(€€€€€€€€€€€€€€€M¥¸½ÕÐ4(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø4(€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰œµ­¥­•Èˆù½µµÕ¹¥Ñä…É‘•¸5•µ‰•ÉÍ¡¥Àð½Àø4(€€€€€€€€€€€€ñ Ìù5•µ‰•ÉÍ¡¥À…Ñ¥Ù”ð½ Ìø4(€€€€€€€€€€€€ñÀø4(€€€€€€€€€€€€€e½ÕÈ…½Õ¹ÐÝ½É­Ì…É½ÍÌ‘•Ù¥•Ì¸9½Ñ¡¥¹œå½ÔÁ±…¹Ð¥Ì±…‰•±•Ý¥Ñ å½ÕÈ4(€€€€€€€€€€€€€•µ…¥°½È±¥¹­•Ñ¼„ÁÕ‰±¥ŒÁÉ½™¥±”¸4(€€€€€€€€€€€€ð½Àø4(€€€€€€€€€€ð½‘¥Øø4(4(€€€€€€€€€í…½Õ¹ÑMÑ…Ñ”¹…½Õ¹Ð¹¡•É¥Ñ…”¹•±¥¥‰±”€ü€ 4(€€€€€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰œµ¡•É¥Ñ…”µÍ••ˆ…É¥„µ±…‰•±±•‘‰äô‰¡•É¥Ñ…”µÍ••µÑ¥Ñ±”ˆø4(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰œµÍÑ•Ý…ÉµÍ•Ñ¥½¸µ¡•…‘¥¹œˆø4(€€€€€€€€€€€€€€€€ñ‘¥Øø4(€€€€€€€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰œµ­¥­•Èˆù=¹”±¥™•Ñ¥µ”Í••ð½Àø4(€€€€€€€€€€€€€€€€€€ñ Ì¥ô‰¡•É¥Ñ…”µÍ••µÑ¥Ñ±”ˆø4(€€€€€€€€€€€€€€€€€€€í…½Õ¹ÑMÑ…Ñ”¹…½Õ¹Ð¹¡•É¥Ñ…”¹‰…‘•…É¹•4(€€€€€€€€€€€€€€€€€€€€€€ü€‰!•É¥Ñ…”…É‘•¹•Èˆ4(€€€€€€€€€€€€€€€€€€€€€€è€‰É½Ý¥¹œå½ÕÈ!•É¥Ñ…”±½Ý•È‰ô4(€€€€€€€€€€€€€€€€€€ð½ Ìø4(€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰œµ¡•É¥Ñ…”µ‰…‘”ˆ…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆûŠr˜ð½ÍÁ…¸ø4(€€€€€€€€€€€€€€ð½‘¥Øø4(4(€€€€€€€€€€€€€í…½Õ¹ÑMÑ…Ñ”¹…½Õ¹Ð¹¡•É¥Ñ…”¹¡•É¥Ñ…•±½Ý•È€ü€ 4(€€€€€€€€€€€€€€€€ðø4(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸4(€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰œµ¡•É¥Ñ…”µÙ¥Í¥Ðµ‰ÕÑÑ½¸ˆ4(€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ4(€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøì4(€€€€€€€€€€€€€€€€€€€€€½¹ÍÐ™±½Ý•È€ô…½Õ¹ÑMÑ…Ñ”¹…½Õ¹Ð¹¡•É¥Ñ…”¹¡•É¥Ñ…•±½Ý•Èì4(€€€€€€€€€€€€€€€€€€€€€¥˜€¡™±½Ý•È¤½¹Y¥Í¥Ñ!•É¥Ñ…”ü¸¡™±½Ý•È¹É¥‘`°™±½Ý•È¹É¥‘d¤ì4(€€€€€€€€€€€€€€€€€€€õô4(€€€€€€€€€€€€€€€€€€ø4(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùY¥Í¥Ðå½ÕÈ!•É¥Ñ…”±½Ý•Èð½ÍÑÉ½¹œø4(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù=Á•¸Ñ¡”½µµÕ¹¥ÑäÑ±…ÌÝ¥Ñ å½ÕÈ±…¹‘µ…É¬•¹Ñ•É•¸ð½ÍÁ…¸ø4(€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø4(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰œµ¡•É¥Ñ…”µ•…É¹•ˆø4(€€€€€€€€€€€€€€€€€€€€ñ…É‘•¹…Ñ…±½MÁÉ¥Ñ”4(€€€€€€€€€€€€€€€€€€€€€­¥¹ô‰Á±…¹Ðˆ4(€€€€€€€€€€€€€€€€€€€€€ÑåÁ”õí…½Õ¹ÑMÑ…Ñ”¹…½Õ¹Ð¹¡•É¥Ñ…”¹¡•É¥Ñ…•±½Ý•È¹Á±…¹ÑQåÁ•ô4(€€€€€€€€€€€€€€€€€€€€€¡•É¥Ñ…”4(€€€€€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø4(€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œø4(€€€€€€€€€€€€€€€€€€€€€€€í™±½Ý•É9…µ”¡…½Õ¹ÑMÑ…Ñ”¹…½Õ¹Ð¹¡•É¥Ñ…”¹¡•É¥Ñ…•±½Ý•È¹Á±…¹ÑQåÁ”¥ôƒ
Ü!•É¥Ñ…”±½Ý•È4(€€€€€€€€€€€€€€€€€€€€€€ð½ÍÑÉ½¹œø4(€€€€€€€€€€€€€€€€€€€€€€ñÀø4(€€€€€€€€€€€€€€€€€€€€€€€e½Ô…¹Ñ¡”½µµÕ¹¥Ñä•ÍÑ…‰±¥Í¡•Ñ¡¥ÌÁ•Éµ…¹•¹Ð±…¹‘µ…É¬¸e½ÕÈ4(€€€€€€€€€€€€€€€€€€€€€€€…½Õ¹Ð¡…Ì•…É¹•¥ÑÌ!•É¥Ñ…”…É‘•¹•È‰…‘”¸4(€€€€€€€€€€€€€€€€€€€€€€ð½Àø4(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€€€ð¼ø4(€€€€€€€€€€€€€€¤€è€ 4(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰œµ¡•É¥Ñ…”µ•µÁÑäˆø4(€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùe½Ô‘¼¹½Ð¡…Ù”„!•É¥Ñ…”±½Ý•ÈÑ¼Ù¥Í¥Ðå•Ð¸ð½ÍÑÉ½¹œø4(€€€€€€€€€€€€€€€€€€ñÀø4(€€€€€€€€€€€€€€€€€€€-••ÀÁ±…¹Ñ¥¹œ…¹…É¥¹œ™½ÈÑ¡”½µµÕ¹¥Ñä…É‘•¸¸=¹”½˜å½ÕÈ4(€€€€€€€€€€€€€€€€€€€™±½Ý•ÉÌµ…ä¹…ÑÕÉ…±±ä‰•½µ”!•É¥Ñ…”…™Ñ•È¥ÐÉ½ÝÌÝ¥Ñ •¹½Õ 4(€€€€€€€€€€€€€€€€€€€Ñ¥µ”°½µµÕ¹¥Ñä…É”°…¹¹•¥¡‰½É¥¹œ™±½Ý•ÉÌ¸]¡•¸Ñ¡…Ð¡…ÁÁ•¹Ì°4(€€€€€€€€€€€€€€€€€€€	…Í¥°Ý¥±°…‘Ñ¡”Ù¥Í¥Ð‰ÕÑÑ½¸¡•É”…¹±•Ðå½Ô­¹½Ü¥¸Ñ¡”…É‘•¸¸4(€€€€€€€€€€€€€€€€€€ð½Àø4(€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€¥ô4(€€€€€€€€€€€€ð½Í•Ñ¥½¸ø4(€€€€€€€€€€¤€è¹Õ±±ô4(4(€€€€€€€€€€ñ½µµÕ¹¥ÑåMÑ•Ý…É‘Í¡¥ÁA…¹•°4(€€€€€€€€€€€ÍÕµµ…Éäõí…½Õ¹ÑMÑ…Ñ”¹…½Õ¹Ð¹ÍÑ•Ý…É‘Í¡¥Áô4(€€€€€€€€€€€É•Á±…¥¹%õíÉ•Á±…¥¹Q…Í­%‘ô4(€€€€€€€€€€€½¹I•Á±…”õì¡…ÍÍ¥¹µ•¹Ñ%¤€ôøÙ½¥É•Á±…•MÑ•Ý…É‘Í¡¥ÁQ…Í¬¡…ÍÍ¥¹µ•¹Ñ%¥ô4(€€€€€€€€€€¼ø4(4(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰œµ…±µ…¹…Œˆ…É¥„µ±…‰•±±•‘‰äô‰…É‘•¸µ…±µ…¹…ŒµÑ¥Ñ±”ˆø4(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰œµÍÑ•Ý…ÉµÍ•Ñ¥½¸µ¡•…‘¥¹œˆø4(€€€€€€€€€€€€€€ñ Ì¥ô‰…É‘•¸µ…±µ…¹…ŒµÑ¥Ñ±”ˆù…É‘•¸±µ…¹…Œð½ Ìø4(€€€€€€€€€€€€€€ñÍµ…±°ù1¥Ù”½µµÕ¹¥ÑäÑ½Ñ…±Ìð½Íµ…±°ø4(€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€ñ‘°ø4(€€€€€€€€€€€€€€ñ‘¥Øøñ‘ÐùÉ½Ý¥¹œð½‘Ðøñ‘ùí…½Õ¹ÑMÑ…Ñ”¹…½Õ¹Ð¹…±µ…¹…Œ¹Ñ½Ñ…±ôð½‘øð½‘¥Øø4(€€€€€€€€€€€€€€ñ‘¥Øøñ‘ÐùA±…¹Ñ•Ñ½‘…äð½‘Ðøñ‘ùí…½Õ¹ÑMÑ…Ñ”¹…½Õ¹Ð¹…±µ…¹…Œ¹Á±…¹Ñ•ÈÑ¡ôð½‘øð½‘¥Øø4(€€€€€€€€€€€€€€ñ‘¥Øøñ‘Ðù]…Ñ•É•Ñ½‘…äð½‘Ðøñ‘ùí…½Õ¹ÑMÑ…Ñ”¹…½Õ¹Ð¹…±µ…¹…Œ¹…Ñ¥Ù”ÈÑ¡ôð½‘øð½‘¥Øø4(€€€€€€€€€€€€€€ñ‘¥Øøñ‘ÐùI½Í•Ìð½‘Ðøñ‘ùí…½Õ¹ÑMÑ…Ñ”¹…½Õ¹Ð¹…±µ…¹…Œ¹‰åQåÁ”¹É½Í•ôð½‘øð½‘¥Øø4(€€€€€€€€€€€€€€ñ‘¥Øøñ‘ÐùMÕ¹™±½Ý•ÉÌð½‘Ðøñ‘ùí…½Õ¹ÑMÑ…Ñ”¹…½Õ¹Ð¹…±µ…¹…Œ¹‰åQåÁ”¹ÍÕ¹™±½Ý•Éôð½‘øð½‘¥Øø4(€€€€€€€€€€€€€€ñ‘¥Øøñ‘Ðù1…Ù•¹‘•Èð½‘Ðøñ‘ùí…½Õ¹ÑMÑ…Ñ”¹…½Õ¹Ð¹…±µ…¹…Œ¹‰åQåÁ”¹±…Ù•¹‘•Éôð½‘øð½‘¥Øø4(€€€€€€€€€€€€ð½‘°ø4(€€€€€€€€€€ð½‘¥Øø4(4(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰œµ¹•ÝÍ±•ÑÑ•ÈµÁÉ•™•É•¹”ˆø4(€€€€€€€€€€€€ñ‘¥Øø4(€€€€€€€€€€€€€€ñÍÑÉ½¹œù5½¹Ñ¡±ä…É‘•¸1•ÑÑ•Èð½ÍÑÉ½¹œø4(€€€€€€€€€€€€€€ñÀùI••¥Ù”„µ½¹Ñ¡±äÍ¹…ÁÍ¡½Ð½˜Ý¡…ÐÑ¡”½µµÕ¹¥Ñä¡…ÌÉ½Ý¸¸Ù•Éä±•ÑÑ•È¥¹±Õ‘•Ì…¸Õ¹ÍÕ‰ÍÉ¥‰”±¥¹¬¸ð½Àø4(€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€ñ‰ÕÑÑ½¸4(€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ4(€€€€€€€€€€€€€‘¥Í…‰±•õí‰ÕÍä€ôôô€‰¹•ÝÍ±•ÑÑ•È‰ô4(€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÙ½¥ÕÁ‘…Ñ•9•ÝÍ±•ÑÑ•ÉAÉ•™•É•¹” ……½Õ¹ÑMÑ…Ñ”¹…½Õ¹Ð¹¹•ÝÍ±•ÑÑ•ÉMÕ‰ÍÉ¥‰•¥ô4(€€€€€€€€€€€€ø4(€€€€€€€€€€€€€í‰ÕÍä€ôôô€‰¹•ÝÍ±•ÑÑ•Èˆ4(€€€€€€€€€€€€€€€€ü€‰M…Ù¥¹ŸŠ˜ˆ4(€€€€€€€€€€€€€€€€è…½Õ¹ÑMÑ…Ñ”¹…½Õ¹Ð¹¹•ÝÍ±•ÑÑ•ÉMÕ‰ÍÉ¥‰•4(€€€€€€€€€€€€€€€€€€ü€‰U¹ÍÕ‰ÍÉ¥‰”ˆ4(€€€€€€€€€€€€€€€€€€è€‰MÕ‰ÍÉ¥‰”‰ô4(€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø4(€€€€€€€€€€ð½‘¥Øø4(4(€€€€€€€€€€ñ™½É´±…ÍÍ9…µ”ô‰œµ™••‘‰…¬µ™½É´ˆ½¹MÕ‰µ¥ÐõíÍÕ‰µ¥Ñ%‘•…ôø4(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰œµÍÑ•Ý…ÉµÍ•Ñ¥½¸µ¡•…‘¥¹œˆø4(€€€€€€€€€€€€€€ñ ÌùM¡…Á”Ñ¡”¹•áÐÕÁÉ…‘”ð½ Ìø4(€€€€€€€€€€€€€€ñÍµ…±°ù%‘•…Ì…É”É•Ù¥•Ý•°¹•Ù•È…ÕÑ¼µÁÕ‰±¥Í¡•ð½Íµ…±°ø4(€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€ñ±…‰•°¡Ñµ±½Èô‰™••‘‰…¬µ…Ñ•½ÉäˆùÉ•„ð½±…‰•°ø4(€€€€€€€€€€€€ñÍ•±•Ð4(€€€€€€€€€€€€€¥ô‰™••‘‰…¬µ…Ñ•½Éäˆ4(€€€€€€€€€€€€€Ù…±Õ”õí…Ñ•½Éåô4(€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•Ñ…Ñ•½Éä¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¥ô4(€€€€€€€€€€€€ø4(€€€€€€€€€€€€€í	-}Q=I%L¹µ…À ¡mÙ…±Õ”°±…‰•±t¤€ôø€ 4(€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸­•äõíÙ…±Õ•ôÙ…±Õ”õíÙ…±Õ•ôùí±…‰•±ôð½½ÁÑ¥½¸ø4(€€€€€€€€€€€€€€¤¥ô4(€€€€€€€€€€€€ð½Í•±•Ðø4(€€€€€€€€€€€€ñ±…‰•°¡Ñµ±½Èô‰™••‘‰…¬µ¥‘•„ˆù]¡…ÐÝ½Õ±µ…­”å½ÔÉ•ÑÕÉ¸Ñ¼Ñ¡”…É‘•¸üð½±…‰•°ø4(€€€€€€€€€€€€ñÑ•áÑ…É•„4(€€€€€€€€€€€€€¥ô‰™••‘‰…¬µ¥‘•„ˆ4(€€€€€€€€€€€€€Ù…±Õ”õí¥‘•…ô4(€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•Ñ%‘•„¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¹Í±¥” À°€ÈàÀ¤¥ô4(€€€€€€€€€€€€€µ…á1•¹Ñ õìÈàÁô4(€€€€€€€€€€€€€É½ÝÌõìÑô4(€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰œµ™••‘‰…¬µÍÕ‰µ¥Ðˆø4(€€€€€€€€€€€€€€ñÍµ…±°ùí¥‘•„¹±•¹Ñ¡ô¼ÈàÀð½Íµ…±°ø4(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰ÍÕ‰µ¥Ðˆ‘¥Í…‰±•õí‰ÕÍä€ôôô€‰™••‘‰…¬ˆñð€…¥‘•„¹ÑÉ¥´ ¥ôø4(€€€€€€€€€€€€€€€í‰ÕÍä€ôôô€‰™••‘‰…¬ˆ€ü€‰M•¹‘¥¹ŸŠ˜ˆ€è€‰M•¹¥‘•„‰ô4(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø4(€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€ð½™½É´ø4(4(€€€€€€€€€í…½Õ¹ÑMÑ…Ñ”¹…½Õ¹Ð¹™••‘‰…¬¹±•¹Ñ €ü€ 4(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰œµ™••‘‰…¬µ¡¥ÍÑ½Éäˆø4(€€€€€€€€€€€€€€ñ Ìùe½ÕÈÕÁÉ…‘”ÅÕ•Õ”ð½ Ìø4(€€€€€€€€€€€€€€ñÕ°ø4(€€€€€€€€€€€€€€€í…½Õ¹ÑMÑ…Ñ”¹…½Õ¹Ð¹™••‘‰…¬¹µ…À ¡¥Ñ•´¤€ôø€ 4(€€€€€€€€€€€€€€€€€€ñ±¤­•äõí¥Ñ•´¹¥‘ôø4(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùí¥Ñ•´¹…Ñ•½Éåôð½ÍÁ…¸ø4(€€€€€€€€€€€€€€€€€€€€ñÀùí¥Ñ•´¹µ•ÍÍ…•ôð½Àø4(€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ùí¥Ñ•´¹ÍÑ…ÑÕÍôð½Íµ…±°ø4(€€€€€€€€€€€€€€€€€€ð½±¤ø4(€€€€€€€€€€€€€€€€¤¥ô4(€€€€€€€€€€€€€€ð½Õ°ø4(€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€¤€è¹Õ±±ô4(€€€€€€€€ð½‘¥Øø4(€€€€€€¤€è¹Õ±±ô4(4(€€€€€íÍ•ÍÍ¥½¸€˜˜€…Í¡½Ý½Õ¹Ñ1¥¹¬€˜˜€…Í¡½ÝY•É¥™¥…Ñ¥½¹A•¹‘¥¹œ€˜˜€…Í¡½ÝA…¥‘Y•É¥™¥…Ñ¥½¹A•¹‘¥¹œ€ü€ 4(€€€€€€€€ñ…É‘•¹!•…±Ñ¡A…¹•°(€€€€€€€€€Í•ÍÍ¥½¸õíÍ•ÍÍ¥½¹ô(€€€€€€€€€½¹Y¥•Ý½µµÕ¹¥Ñå…É‘•¸õí½¹Y¥•Ý½µµÕ¹¥Ñå…É‘•¹ô(€€€€€€€€¼ø(€€€€€€¤€è¹Õ±±ô4(4(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰œµÍÑ•Ý…ÉµÁÉ¥Ù…äˆø4(€€€€€€€€ñÍÑÉ½¹œùAÉ¥Ù…Ñ”…½Õ¹Ð°…¹½¹åµ½ÕÌÁ±…äð½ÍÑÉ½¹œø4(€€€€€€€€ñÀø4(€€€€€€€€€	…Í¥°ÍÑ½É•Ìå½ÕÈÁÉ¥Ù…Ñ”…½Õ¹Ð•µ…¥°°Á…åµ•¹Ð•¹Ñ¥Ñ±•µ•¹Ð°…¹™••‘‰…¬¸4(€€€€€€€€€MÑÉ¥Á”¡…¹‘±•Ì…É…¹É••¥ÁÐ‘•Ñ…¥±Ì¸Q¡”ÁÕ‰±¥Œ…É‘•¸¹•Ù•ÈÍ¡½ÝÌÝ¡¼å½Ô4(€€€€€€€€€…É”½È½¹¹•ÑÌå½ÕÈ¥‘•¹Ñ¥ÑäÑ¼Á±…¹ÑÌ¸e½ÔÍÑ…äÍ¥¹•¥¸½¸„‘•Ù¥”Õ¹Ñ¥°4(€€€€€€€€€å½ÔÍ¥¸½ÕÐ¸ÕÑÕÉ”Ù•É¥™¥•ÍÑ½É”ÁÕÉ¡…Í•Ì…¸…ÑÑ… Ñ¼Ñ¡¥ÌÍ…µ”…½Õ¹Ð¸4(€€€€€€€€ð½Àø4(€€€€€€ð½‘¥Øø4(€€€€ð½Í•Ñ¥½¸ø4(€€¤ì4)ô4