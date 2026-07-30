import { createHash, randomBytes } from "node:crypto";
import { getResend } from "@/lib/resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getBasilUrl } from "./urls";
import {
  buildDailyStoryDrafts,
  parseSocialStats,
  refineDraftsWithOpenAI,
  SOCIAL_CHANNELS,
  type RepositoryChange,
  type SocialChannel,
} from "./socialContent";

const REVIEWERS = (process.env.BASIL_SOCIAL_REVIEW_EMAILS ?? "info@bygoetz.com")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const FROM = process.env.BASIL_SOCIAL_FROM ?? "Basil Social Studio <garden@send.bygoetz.com>";
const REPLY_TO = process.env.BASIL_SOCIAL_REPLY_TO ?? "info@bygoetz.com";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type DigestRow = {
  id: string;
  run_key: string;
  status: string;
  approval_expires_at: string;
  review_email_sent_at: string | null;
  created_at: string;
};

type StoryRow = {
  id: string;
  digest_id: string;
  story_key: string;
  source_type: string;
  source_ref: string | null;
  title: string;
  summary: string;
  why_today: string;
  asset_url: string;
  asset_kind: "image" | "video";
  evidence: Record<string, unknown>;
  rank: number;
  status: string;
};

type VariantRow = {
  id: string;
  story_id: string;
  channel: SocialChannel;
  headline: string;
  body: string;
  hashtags: string[];
  status: "draft" | "manual_ready" | "rejected" | "published" | "failed";
  approved_at: string | null;
  published_at: string | null;
  published_url: string | null;
  last_error: string | null;
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function chicagoRunKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `daily-${year}-${month}-${day}`;
}

function configuredStoryCount() {
  const value = Number(process.env.BASIL_SOCIAL_DAILY_STORY_COUNT ?? 3);
  return Number.isInteger(value) ? Math.max(3, Math.min(5, value)) : 3;
}

async function collectRepositoryChanges(date: Date): Promise<RepositoryChange[]> {
  const repository = process.env.BASIL_SOCIAL_GITHUB_REPOSITORY ?? process.env.GITHUB_REPOSITORY ?? "BigHitterG/bygoetz";
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) return [];
  const since = new Date(date.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const headers: HeadersInit = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "basil-social-studio",
  };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/commits?per_page=30&since=${encodeURIComponent(since)}`, {
      headers,
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload = await response.json() as unknown;
    if (!Array.isArray(payload)) return [];
    return payload.flatMap((value): RepositoryChange[] => {
      if (!value || typeof value !== "object") return [];
      const commit = value as Record<string, unknown>;
      const detail = commit.commit && typeof commit.commit === "object" ? commit.commit as Record<string, unknown> : {};
      const author = detail.author && typeof detail.author === "object" ? detail.author as Record<string, unknown> : {};
      const message = typeof detail.message === "string" ? detail.message.split("\n")[0]?.trim() : "";
      const sha = typeof commit.sha === "string" ? commit.sha : "";
      const url = typeof commit.html_url === "string" ? commit.html_url : "";
      const committedAt = typeof author.date === "string" ? author.date : "";
      if (!message || !sha || !url || !committedAt) return [];
      return [{ sha, title: message.slice(0, 240), url, committedAt }];
    });
  } catch {
    return [];
  }
}

async function findAuthorizedDigest(digestId: string, token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(digestId) || token.length < 32 || token.length > 100) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("basil_social_digests")
    .select("id,run_key,status,approval_expires_at,review_email_sent_at,created_at")
    .eq("id", digestId)
    .eq("approval_token_hash", tokenHash(token))
    .maybeSingle();
  if (error) throw error;
  return data as DigestRow | null;
}

function connectorStatus() {
  return {
    email: { mode: process.env.RESEND_API_KEY ? "connected" : "needs_configuration", label: "Daily review email" },
    github: { mode: "connected", label: process.env.BASIL_SOCIAL_GITHUB_REPOSITORY ?? "BigHitterG/bygoetz" },
    openai: { mode: process.env.OPENAI_API_KEY ? "connected" : "optional", label: process.env.OPENAI_SOCIAL_MODEL ?? "Template drafts" },
    reddit: { mode: process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET ? "ready_for_oauth" : "manual", label: "Copy and post manually" },
    youtube: { mode: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? "ready_for_oauth" : "manual", label: "Upload manually" },
    instagram: { mode: process.env.META_APP_ID && process.env.META_APP_SECRET ? "ready_for_oauth" : "manual", label: "Post manually" },
    tiktok: { mode: process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET ? "ready_for_oauth" : "manual", label: "Post manually" },
  };
}

function renderDigestEmail(digestId: string, token: string, stories: Array<{ title: string; whyToday: string; assetUrl: string }>) {
  const reviewUrl = `${getBasilUrl(`/community-garden/social-studio?digest=${digestId}`)}#token=${token}`;
  const cards = stories.map((story, index) => `
    <tr><td style="padding:0 0 18px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:2px solid #352823;background:#fff8e8">
        <tr><td><img src="${escapeHtml(getBasilUrl(story.assetUrl))}" alt="Actual Basil gameplay for ${escapeHtml(story.title)}" width="580" style="display:block;width:100%;height:auto;max-height:340px;object-fit:cover"></td></tr>
        <tr><td style="padding:18px 20px"><div style="font:700 12px Arial,sans-serif;letter-spacing:1.4px;color:#a43d3d">STORY ${index + 1}</div><h2 style="font:700 22px Georgia,serif;margin:6px 0 8px;color:#302321">${escapeHtml(story.title)}</h2><p style="font:15px/1.55 Arial,sans-serif;color:#5b4a42;margin:0">${escapeHtml(story.whyToday)}</p></td></tr>
      </table>
    </td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#e7dfcf;color:#302321"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px"><tr><td style="border:3px solid #302321;background:#f5e8ca;padding:28px 26px;text-align:center"><div style="font:700 30px Georgia,serif;letter-spacing:2px">BASIL</div><div style="font:700 12px Arial,sans-serif;letter-spacing:2px;margin-top:5px">SOCIAL STUDIO</div><h1 style="font:700 27px Georgia,serif;margin:22px 0 10px">${stories.length} stories are ready</h1><p style="font:16px/1.5 Arial,sans-serif;margin:0;color:#5b4a42">Review the copy, edit anything you like, and approve only the channels you want to post.</p><p style="margin:22px 0 4px"><a href="${reviewUrl}" style="display:inline-block;background:#a94343;color:#fff8e8;border:2px solid #302321;padding:13px 22px;text-decoration:none;font:700 15px Arial,sans-serif">Open Basil Social Studio</a></p><p style="font:12px/1.5 Arial,sans-serif;color:#6b5a51;margin:10px 0 0">Opening the Studio never publishes anything. Final approval happens on the review page.</p></td></tr><tr><td style="height:18px"></td></tr>${cards}<tr><td style="font:12px/1.5 Arial,sans-serif;color:#6b5a51;text-align:center;padding:8px 20px">Sent privately to ${escapeHtml(REVIEWERS.join(", "))}. This review link expires in seven days.</td></tr></table></td></tr></table></body></html>`;
  const text = `Basil Social Studio\n\n${stories.length} stories are ready for review. Opening the Studio never publishes anything.\n\n${stories.map((story, index) => `${index + 1}. ${story.title}\n${story.whyToday}`).join("\n\n")}\n\nReview: ${reviewUrl}`;
  return { reviewUrl, html, text };
}

export async function createDailySocialDigest(date = new Date()) {
  const supabase = getSupabaseAdmin();
  const runKey = chicagoRunKey(date);
  const { data: existing, error: existingError } = await supabase
    .from("basil_social_digests")
    .select("id,status,review_email_sent_at")
    .eq("run_key", runKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    return { id: existing.id as string, created: false, status: existing.status as string, emailSent: Boolean(existing.review_email_sent_at) };
  }

  const [changes, statsResult] = await Promise.all([
    collectRepositoryChanges(date),
    supabase.rpc("get_basil_social_stats"),
  ]);
  if (statsResult.error) throw statsResult.error;
  const stats = parseSocialStats(statsResult.data);
  const baseDrafts = buildDailyStoryDrafts(date, changes, stats, configuredStoryCount());
  const drafts = await refineDraftsWithOpenAI(baseDrafts, changes);
  const token = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const { data: digest, error: digestError } = await supabase.from("basil_social_digests").insert({
    run_key: runKey,
    reviewer_emails: REVIEWERS,
    approval_token_hash: tokenHash(token),
    approval_expires_at: expiresAt,
    source_snapshot: {
      measuredAt: stats.measuredAt,
      aggregateStats: stats,
      repositoryChanges: changes,
      generator: process.env.OPENAI_API_KEY ? (process.env.OPENAI_SOCIAL_MODEL ?? "gpt-5.6-terra") : "curated-template-library",
    },
  }).select("id").single();
  if (digestError) {
    if (digestError.code === "23505") {
      const { data: raced } = await supabase.from("basil_social_digests").select("id,status,review_email_sent_at").eq("run_key", runKey).single();
      return { id: raced!.id as string, created: false, status: raced!.status as string, emailSent: Boolean(raced!.review_email_sent_at) };
    }
    throw digestError;
  }

  try {
    const emailStories: Array<{ title: string; whyToday: string; assetUrl: string }> = [];
    for (const [index, draft] of drafts.entries()) {
      const { data: story, error: storyError } = await supabase.from("basil_social_stories").insert({
        digest_id: digest.id,
        story_key: draft.key,
        source_type: draft.sourceType,
        source_ref: draft.sourceRef,
        title: draft.title,
        summary: draft.summary,
        why_today: draft.whyToday,
        asset_url: draft.assetUrl,
        asset_kind: draft.assetKind,
        evidence: draft.evidence,
        rank: index + 1,
        status: "ready",
      }).select("id").single();
      if (storyError) throw storyError;
      const { error: variantError } = await supabase.from("basil_social_variants").insert(draft.variants.map((variant) => ({
        story_id: story.id,
        channel: variant.channel,
        headline: variant.headline,
        body: variant.body,
        hashtags: variant.hashtags,
      })));
      if (variantError) throw variantError;
      emailStories.push({ title: draft.title, whyToday: draft.whyToday, assetUrl: draft.assetUrl });
    }
    const rendered = renderDigestEmail(digest.id as string, token, emailStories);
    const { data: email, error: emailError } = await getResend().emails.send({
      from: FROM,
      to: REVIEWERS,
      replyTo: REPLY_TO,
      subject: `Basil Social Studio: ${drafts.length} stories ready`,
      html: rendered.html,
      text: rendered.text,
      headers: { "X-Entity-Ref-ID": `basil-social-${runKey}` },
    }, { idempotencyKey: `basil-social-review-${runKey}` });
    if (emailError) throw new Error(emailError.message);
    const { error: updateError } = await supabase.from("basil_social_digests").update({
      review_email_id: email?.id ?? null,
      review_email_sent_at: now,
      updated_at: now,
    }).eq("id", digest.id);
    if (updateError) throw updateError;
    return { id: digest.id as string, created: true, status: "review_ready", emailSent: true };
  } catch (error) {
    await supabase.from("basil_social_digests").delete().eq("id", digest.id).is("review_email_sent_at", null);
    throw error;
  }
}

export async function reviewSocialDigest(digestId: string, token: string) {
  const digest = await findAuthorizedDigest(digestId, token);
  if (!digest) return null;
  const supabase = getSupabaseAdmin();
  const { data: stories, error: storiesError } = await supabase
    .from("basil_social_stories")
    .select("*")
    .eq("digest_id", digestId)
    .order("rank", { ascending: true });
  if (storiesError) throw storiesError;
  const storyRows = (stories ?? []) as StoryRow[];
  const storyIds = storyRows.map((story) => story.id);
  const { data: variants, error: variantsError } = storyIds.length
    ? await supabase.from("basil_social_variants").select("*").in("story_id", storyIds).order("channel", { ascending: true })
    : { data: [], error: null };
  if (variantsError) throw variantsError;
  const variantRows = (variants ?? []) as VariantRow[];
  return {
    id: digest.id,
    runKey: digest.run_key,
    status: digest.status,
    expiresAt: digest.approval_expires_at,
    expired: new Date(digest.approval_expires_at).getTime() <= Date.now(),
    emailSentAt: digest.review_email_sent_at,
    createdAt: digest.created_at,
    reviewers: REVIEWERS,
    connectors: connectorStatus(),
    stories: storyRows.map((story) => ({
      id: story.id,
      key: story.story_key,
      sourceType: story.source_type,
      sourceRef: story.source_ref,
      title: story.title,
      summary: story.summary,
      whyToday: story.why_today,
      assetUrl: story.asset_url,
      assetKind: story.asset_kind,
      evidence: story.evidence,
      rank: story.rank,
      status: story.status,
      variants: variantRows.filter((variant) => variant.story_id === story.id).map((variant) => ({
        id: variant.id,
        channel: variant.channel,
        headline: variant.headline,
        body: variant.body,
        hashtags: Array.isArray(variant.hashtags) ? variant.hashtags : [],
        status: variant.status,
        approvedAt: variant.approved_at,
        publishedAt: variant.published_at,
        publishedUrl: variant.published_url,
        lastError: variant.last_error,
      })),
    })),
  };
}

async function findVariantForDigest(digestId: string, variantId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(variantId)) return null;
  const supabase = getSupabaseAdmin();
  const { data: stories, error: storiesError } = await supabase.from("basil_social_stories").select("id").eq("digest_id", digestId);
  if (storiesError) throw storiesError;
  const storyIds = (stories ?? []).map((story) => story.id as string);
  if (!storyIds.length) return null;
  const { data, error } = await supabase.from("basil_social_variants").select("*").eq("id", variantId).in("story_id", storyIds).maybeSingle();
  if (error) throw error;
  return data as VariantRow | null;
}

async function refreshDigestStatus(digestId: string) {
  const supabase = getSupabaseAdmin();
  const { data: stories } = await supabase.from("basil_social_stories").select("id").eq("digest_id", digestId);
  const storyIds = (stories ?? []).map((story) => story.id as string);
  if (!storyIds.length) return;
  const { data: variants } = await supabase.from("basil_social_variants").select("status").in("story_id", storyIds);
  const statuses = (variants ?? []).map((variant) => variant.status as string);
  const status = statuses.some((value) => value === "draft") ? "in_review" : "completed";
  await supabase.from("basil_social_digests").update({ status, updated_at: new Date().toISOString() }).eq("id", digestId);
}

export async function saveSocialVariant(
  digestId: string,
  token: string,
  variantId: string,
  fields: { headline?: string; body?: string; hashtags?: string[] },
) {
  const digest = await findAuthorizedDigest(digestId, token);
  if (!digest) throw new Error("This Social Studio link is invalid.");
  if (new Date(digest.approval_expires_at).getTime() <= Date.now()) throw new Error("This Social Studio link has expired.");
  const variant = await findVariantForDigest(digestId, variantId);
  if (!variant) throw new Error("This social draft does not belong to the review.");
  if (variant.status === "published") throw new Error("Published copy is preserved as an immutable record.");
  const headline = fields.headline?.trim().slice(0, 300);
  const body = fields.body?.trim().slice(0, 10_000);
  const hashtags = fields.hashtags?.map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean).slice(0, 12);
  if (headline !== undefined && !headline) throw new Error("A headline is required.");
  if (body !== undefined && !body) throw new Error("Post copy is required.");
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (headline !== undefined) update.headline = headline;
  if (body !== undefined) update.body = body;
  if (hashtags !== undefined) update.hashtags = hashtags;
  if (variant.status !== "rejected") update.status = "draft";
  const { data, error } = await getSupabaseAdmin().from("basil_social_variants").update(update).eq("id", variantId).select("*").single();
  if (error) throw error;
  await refreshDigestStatus(digestId);
  return data as VariantRow;
}

export async function decideSocialVariant(
  digestId: string,
  token: string,
  variantId: string,
  decision: "approve" | "reject" | "draft" | "published",
  publishedUrl?: string,
) {
  const digest = await findAuthorizedDigest(digestId, token);
  if (!digest) throw new Error("This Social Studio link is invalid.");
  if (new Date(digest.approval_expires_at).getTime() <= Date.now()) throw new Error("This Social Studio link has expired.");
  const variant = await findVariantForDigest(digestId, variantId);
  if (!variant) throw new Error("This social draft does not belong to the review.");
  if (variant.status === "published" && decision !== "published") throw new Error("A published draft cannot be moved back into review.");
  const now = new Date().toISOString();
  const status = decision === "approve" ? "manual_ready" : decision === "reject" ? "rejected" : decision;
  const cleanPublishedUrl = publishedUrl?.trim().slice(0, 2000) || null;
  if (decision === "published" && cleanPublishedUrl && !/^https?:\/\//i.test(cleanPublishedUrl)) {
    throw new Error("Published links must begin with http:// or https://.");
  }
  const { data, error } = await getSupabaseAdmin().from("basil_social_variants").update({
    status,
    approved_at: status === "manual_ready" || status === "published" ? (variant.approved_at ?? now) : null,
    published_at: status === "published" ? (variant.published_at ?? now) : null,
    published_url: status === "published" ? cleanPublishedUrl : null,
    last_error: null,
    updated_at: now,
  }).eq("id", variantId).select("*").single();
  if (error) throw error;
  await refreshDigestStatus(digestId);
  return data as VariantRow;
}

export function isSocialChannel(value: unknown): value is SocialChannel {
  return typeof value === "string" && SOCIAL_CHANNELS.includes(value as SocialChannel);
}
