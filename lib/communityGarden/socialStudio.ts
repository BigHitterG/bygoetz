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

type AssetRow = {
  id: string;
  story_id: string;
  kind: "video" | "poster" | "image" | "audio";
  bucket_id: string;
  object_path: string;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  validation_status: "pending" | "valid" | "invalid";
  metadata: Record<string, unknown>;
};

type FeedbackRow = {
  id: string;
  story_id: string;
  feedback: string;
  status: "queued" | "resolved" | "dismissed";
  created_at: string;
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
  const value = Number(process.env.BASIL_SOCIAL_DAILY_STORY_COUNT ?? 1);
  return Number.isInteger(value) ? Math.max(1, Math.min(3, value)) : 1;
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

function renderDigestEmail(digestId: string, token: string, stories: Array<{ title: string; whyToday: string; assetUrl: string; assetKind: "image" | "video" }>) {
  const reviewUrl = `${getBasilUrl(`/community-garden/social-studio?digest=${digestId}`)}#token=${token}`;
  const cards = stories.map((story, index) => {
    const visual = story.assetKind === "image"
      ? `<img src="${escapeHtml(getBasilUrl(story.assetUrl))}" alt="Actual Basil gameplay for ${escapeHtml(story.title)}" width="580" style="display:block;width:100%;height:auto;max-height:340px;object-fit:cover">`
      : `<div style="padding:44px 20px;background:#314239;color:#fff8e8;text-align:center"><div style="font:800 12px Arial,sans-serif;letter-spacing:1.6px;color:#e7c879">FINISHED VERTICAL VIDEO</div><div style="font:700 24px Georgia,serif;margin-top:9px">Poster + MP4 ready in Studio</div></div>`;
    return `
    <tr><td style="padding:0 0 18px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:2px solid #352823;background:#fff8e8">
        <tr><td>${visual}</td></tr>
        <tr><td style="padding:18px 20px"><div style="font:700 12px Arial,sans-serif;letter-spacing:1.4px;color:#a43d3d">${story.assetKind === "video" ? "VIDEO PACKAGE" : "STORY"} ${index + 1}</div><h2 style="font:700 22px Georgia,serif;margin:6px 0 8px;color:#302321">${escapeHtml(story.title)}</h2><p style="font:15px/1.55 Arial,sans-serif;color:#5b4a42;margin:0">${escapeHtml(story.whyToday)}</p></td></tr>
      </table>
    </td></tr>`;
  }).join("");
  const videoCount = stories.filter((story) => story.assetKind === "video").length;
  const html = `<!doctype html><html><body style="margin:0;background:#e7dfcf;color:#302321"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px"><tr><td style="border:3px solid #302321;background:#f5e8ca;padding:28px 26px;text-align:center"><div style="font:700 30px Georgia,serif;letter-spacing:2px">BASIL</div><div style="font:700 12px Arial,sans-serif;letter-spacing:2px;margin-top:5px">SOCIAL STUDIO</div><h1 style="font:700 27px Georgia,serif;margin:22px 0 10px">Todayâ€™s package is ready</h1><p style="font:16px/1.5 Arial,sans-serif;margin:0;color:#5b4a42">${videoCount} finished video${videoCount === 1 ? "" : "s"}, ${stories.length} stories, poster thumbnails, and channel copy are waiting for review.</p><p style="margin:22px 0 4px"><a href="${reviewUrl}" style="display:inline-block;background:#a94343;color:#fff8e8;border:2px solid #302321;padding:13px 22px;text-decoration:none;font:700 15px Arial,sans-serif">Watch and review the package</a></p><p style="font:12px/1.5 Arial,sans-serif;color:#6b5a51;margin:10px 0 0">Opening the Studio never publishes anything. Approve All and revision controls are inside.</p></td></tr><tr><td style="height:18px"></td></tr>${cards}<tr><td style="font:12px/1.5 Arial,sans-serif;color:#6b5a51;text-align:center;padding:8px 20px">Sent privately to ${escapeHtml(REVIEWERS.join(", "))}. This review link expires in seven days.</td></tr></table></td></tr></table></body></html>`;
  const text = `Basil Social Studio\n\n${stories.length} stories are ready for review. Opening the Studio never publishes anything.\n\n${stories.map((story, index) => `${index + 1}. ${story.title}\n${story.whyToday}`).join("\n\n")}\n\nReview: ${reviewUrl}`;
  return { reviewUrl, html, text };
}

export async function createDailySocialDigest(date = new Date(), options: { sendEmail?: boolean } = {}) {
  const sendEmail = options.sendEmail !== false;
  const supabase = getSupabaseAdmin();
  const runKey = chicagoRunKey(date);
  const { data: existing, error: existingError } = await supabase
    .from("basil_social_digests")
    .select("id,status,review_email_sent_at")
    .eq("run_key", runKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    if (sendEmail && !existing.review_email_sent_at) {
      const sent = await resendLatestSocialDigest(`daily-fallback-${runKey}`);
      return { id: sent.id, created: false, status: "review_ready", emailSent: true };
    }
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
    const emailStories: Array<{ title: string; whyToday: string; assetUrl: string; assetKind: "image" | "video" }> = [];
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
      emailStories.push({ title: draft.title, whyToday: draft.whyToday, assetUrl: draft.assetUrl, assetKind: draft.assetKind });
    }
    if (!sendEmail) return { id: digest.id as string, created: true, status: "review_ready", emailSent: false };
    const rendered = renderDigestEmail(digest.id as string, token, emailStories);
    const { data: email, error: emailError } = await getResend().emails.send({
      from: FROM,
      to: REVIEWERS,
      replyTo: REPLY_TO,
      subject: `Basil Social Studio: todayâ€™s video package is ready`,
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

export async function resendLatestSocialDigest(requestKey: string) {
  if (requestKey.lenæÚ$z{-®éÜj×WVW7D¶W’æÆVæwF‚â#’F‡&÷ræWrW'&÷"‚$–çfÆ–B6ö6–Â7GVF–ò&W6VæB¶W’â"“°Ğ¢6öç7B7W&6RÒvWE7W&6TFÖ–â‚“°Ğ¢6öç7B²FF¢F–vW7BÂW'&÷#¢F–vW7DW'&÷"ÒÒv—B7W&6PĞ¢æg&öÒ‚&&6–Å÷6ö6–ÅöF–vW7G2"Ğ¢ç6VÆV7B‚&–BÆ&÷fÅ÷Fö¶Våö†6‚Æ&÷fÅöW‡—&W5öB"Ğ¢æ÷&FW"‚&7&VFVEöB"Â²66VæF–æs¢fÇ6RÒĞ¢æÆ–Ö—BƒĞ¢ç6–ævÆR‚“°Ğ¢–b†F–vW7DW'&÷"’F‡&÷rF–vW7DW'&÷#°Ğ Ğ¢6öç7B²FF¢7F÷&–W2ÂW'&÷#¢7F÷&–W4W'&÷"ÒÒv—B7W&6PĞ¢æg&öÒ‚&&6–Å÷6ö6–Å÷7F÷&–W2"Ğ¢ç6VÆV7B‚'F—FÆRÇv‡•÷FöF’Æ76WE÷W&ÂÆ76WEö¶–æB"Ğ¢æW‚&F–vW7Eö–B"ÂF–vW7Bæ–BĞ¢æ÷&FW"‚'&æ²"Â²66VæF–æs¢G'VRÒ“°Ğ¢–b‡7F÷&–W4W'&÷"’F‡&÷r7F÷&–W4W'&÷#°Ğ¢–b‚7F÷&–W3òæÆVæwF‚’F‡&÷ræWrW'&÷"‚%F†RÆFW7B6ö6–Â7GVF–òF–vW7B†2æò7F÷&–W2â"“°Ğ Ğ¢6öç7BFö¶VâÒ&æFöÔ'—FW2ƒ3"’çFõ7G&–ær‚&&6ScGW&Â"“°Ğ¢6öç7Bæ÷rÒæWrFFR‚’çFô•4õ7G&–ær‚“°Ğ¢6öç7BW‡—&W4BÒæWrFFR„FFRææ÷r‚’²Dô´TåõEDÅôÕ2’çFô•4õ7G&–ær‚“°Ğ¢6öç7B&Wf–÷W5Fö¶VâÒ°Ğ¢&÷fÅ÷Fö¶Våö†6ƒ¢F–vW7Bæ&÷fÅ÷Fö¶Våö†6‚27G&–ærÀĞ¢&÷fÅöW‡—&W5öC¢F–vW7Bæ&÷fÅöW‡—&W5öB27G&–ærÀĞ¢Ó°Ğ¢6öç7B²W'&÷#¢Fö¶VäW'&÷"ÒÒv—B7W&6Ræg&öÒ‚&&6–Å÷6ö6–ÅöF–vW7G2"’çWFFR‡°Ğ¢&÷fÅ÷Fö¶Våö†6ƒ¢Fö¶Vä†6‚‡Fö¶Vâ’ÀĞ¢&÷fÅöW‡—&W5öC¢W‡—&W4BÀĞ¢7FGW3¢'&Wf–Wu÷&VG’"ÀĞ¢WFFVEöC¢æ÷rÀĞ¢Ò’æW‚&–B"ÂF–vW7Bæ–B“°Ğ¢–b‡Fö¶VäW'&÷"’F‡&÷rFö¶VäW'&÷#°Ğ Ğ¢6öç7BVÖ–Å7F÷&–W2Ò7F÷&–W2æÖ‚‡7F÷'’’Óâ‡°Ğ¢F—FÆS¢7F÷'’çF—FÆR27G&–ærÀĞ¢v‡•FöF“¢7F÷'’çv‡•÷FöF’27G&–ærÀĞ¢76WEW&Ã¢7F÷'’æ76WE÷W&Â27G&–ærÀĞ¢76WD¶–æC¢7F÷'’æ76WEö¶–æB2&–ÖvR"Â'f–FVò"ÀĞ¢Ò’“°Ğ¢6öç7B&VæFW&VBÒ&VæFW$F–vW7DVÖ–Â†F–vW7Bæ–B27G&–ærÂFö¶VâÂVÖ–Å7F÷&–W2“°Ğ¢G'’°Ğ¢6öç7B²FF¢VÖ–ÂÂW'&÷#¢VÖ–ÄW'&÷"ÒÒv—BvWE&W6VæB‚’æVÖ–Ç2ç6VæB‡°Ğ¢g&öÓ¢e$ôÒÀĞ¢Fó¢$Ud”UtU%2ÀĞ¢&WÇ•Fó¢$UÅ•õDòÀĞ¢7V&¦V7C¢&6–Â6ö6–Â7GVF–ó¢G·7F÷&–W2æÆVæwF‡Ò7F÷&–W2&VG’‡&W6VçB–ÀĞ¢‡FÖÃ¢&VæFW&VBæ‡FÖÂÀĞ¢FW‡C¢&VæFW&VBçFW‡BÀĞ¢†VFW'3¢²%‚ÔVçF—G’Õ&VbÔ”B#¢&6–Â×6ö6–Â×&W6VæBÒG¶F–vW7Bæ–GÖÒÀĞ¢ÒÂ²–FV×÷FVæ7”¶W“¢&6–Â×6ö6–Â×&W6VæBÒG¶F–vW7Bæ–GÒÒG·Fö¶Vä†6‚‡&WVW7D¶W’’ç6Æ–6RƒÂ#B—ÖÒ“°Ğ¢–b†VÖ–ÄW'&÷"’F‡&÷ræWrW'&÷"†VÖ–ÄW'&÷"æÖW76vR“°Ğ¢6öç7B²W'&÷#¢WFFTW'&÷"ÒÒv—B7W&6Ræg&öÒ‚&&6–Å÷6ö6–ÅöF–vW7G2"’çWFFR‡°Ğ¢&Wf–WuöVÖ–Åö–C¢VÖ–Ãòæ–BóòçVÆÂÀĞ¢&Wf–WuöVÖ–Å÷6VçEöC¢æ÷rÀĞ¢WFFVEöC¢æ÷rÀĞ¢Ò’æW‚&–B"ÂF–vW7Bæ–B“°Ğ¢–b‡WFFTW'&÷"’F‡&÷rWFFTW'&÷#°Ğ¢&WGW&â²–C¢F–vW7Bæ–B27G&–ærÂVÖ–Ä–C¢VÖ–Ãòæ–BóòçVÆÂÂVÖ–Å6VçC¢G'VRÂ&Wf–WtVÖ–Ã¢$Ud”UtU%2Ó°Ğ¢Ò6F6‚†W'&÷"’°Ğ¢v—B7W&6Ræg&öÒ‚&&6–Å÷6ö6–ÅöF–vW7G2"’çWFFR‡²ââç&Wf–÷W5Fö¶VâÂWFFVEöC¢æWrFFR‚’çFô•4õ7G&–ær‚’Ò’æW‚&–B"ÂF–vW7Bæ–B“°Ğ¢F‡&÷rW'&÷#°Ğ¢ĞĞ§ĞĞ Ğ¦W‡÷'B7–æ2gVæ7F–öâ&Wf–Wu6ö6–ÄF–vW7B†F–vW7D–C¢7G&–ærÂFö¶Vã¢7G&–ær’°Ğ¢6öç7BF–vW7BÒv—Bf–æDWF†÷&—¦VDF–vW7B†F–vW7D–BÂFö¶Vâ“°Ğ¢–b‚F–vW7B’&WGW&âçVÆÃ°Ğ¢6öç7B7W&6RÒvWE7W&6TFÖ–â‚“°Ğ¢6öç7B²FF¢7F÷&–W2ÂW'&÷#¢7F÷&–W4W'&÷"ÒÒv—B7W&6PĞ¢æg&öÒ‚&&6–Å÷6ö6–Å÷7F÷&–W2"Ğ¢ç6VÆV7B‚"¢"Ğ¢æW‚&F–vW7Eö–B"ÂF–vW7D–BĞ¢æ÷&FW"‚'&æ²"Â²66VæF–æs¢G'VRÒ“°Ğ¢–b‡7F÷&–W4W'&÷"’F‡&÷r7F÷&–W4W'&÷#°Ğ¢6öç7B7F÷'•&÷w2Ò‡7F÷&–W2óòµÒ’27F÷'•&÷uµÓ°Ğ¢6öç7B7F÷'”–G2Ò7F÷'•&÷w2æÖ‚‡7F÷'’’Óâ7F÷'’æ–B“°Ğ¢6öç7B·f&–çG5&W7VÇBÂ76WG5&W7VÇBÂfVVF&6µ&W7VÇEÒÒ7F÷'”–G2æÆVæwF€Ğ¢òv—B&öÖ—6RæÆÂ…°Ğ¢7W&6Ræg&öÒ‚&&6–Å÷6ö6–Å÷f&–çG2"’ç6VÆV7B‚"¢"’æ–â‚'7F÷'•ö–B"Â7F÷'”–G2’æ÷&FW"‚&6†ææVÂ"Â²66VæF–æs¢G'VRÒ’ÀĞ¢7W&6Ræg&öÒ‚&&6–Å÷6ö6–Åö76WG2"’ç6VÆV7B‚"¢"’æ–â‚'7F÷'•ö–B"Â7F÷'”–G2’æW‚'fÆ–FF–öå÷7FGW2"Â'fÆ–B"’æ÷&FW"‚&7&VFVEöB"Â²66VæF–æs¢fÇ6RÒ’ÀĞ¢7W&6Ræg&öÒ‚&&6–Å÷6ö6–ÅöfVVF&6²"’ç6VÆV7B‚&–BÇ7F÷'•ö–BÆfVVF&6²Ç7FGW2Æ7&VFVEöB"’æW‚&F–vW7Eö–B"ÂF–vW7D–B’æ÷&FW"‚&7&VFVEöB"Â²66VæF–æs¢fÇ6RÒ’ÀĞ¢ÒĞ¢¢°Ğ¢²FF¢µÒÂW'&÷#¢çVÆÂÒÀĞ¢²FF¢µÒÂW'&÷#¢çVÆÂÒÀĞ¢²FF¢µÒÂW'&÷#¢çVÆÂÒÀĞ¢Ó°Ğ¢–b‡f&–çG5&W7VÇBæW'&÷"’F‡&÷rf&–çG5&W7VÇBæW'&÷#°Ğ¢–b†76WG5&W7VÇBæW'&÷"’F‡&÷r76WG5&W7VÇBæW'&÷#°Ğ¢–b†fVVF&6µ&W7VÇBæW'&÷"’F‡&÷rfVVF&6µ&W7VÇBæW'&÷#°Ğ¢6öç7Bf&–çG2Òf&–çG5&W7VÇBæFF°Ğ¢6öç7Bf&–çE&÷w2Ò‡f&–çG2óòµÒ’2f&–çE&÷uµÓ°Ğ¢6öç7B76WE&÷w2Ò†76WG5&W7VÇBæFFóòµÒ’276WE&÷uµÓ°Ğ¢6öç7BfVVF&6µ&÷w2Ò†fVVF&6µ&W7VÇBæFFóòµÒ’2fVVF&6µ&÷uµÓ°Ğ¢6öç7B6–væVD76WG2Òv—B&öÖ—6RæÆÂ†76WE&÷w2æÖ†7–æ2†76WB’Óâ°Ğ¢6öç7B²FFÂW'&÷"ÒÒv—B7W&6Rç7F÷&vPĞ¢æg&öÒ†76WBæ'V6¶WEö–BĞ¢æ7&VFU6–væVEW&Â†76WBæö&¦V7E÷F‚Âc¢c“°Ğ¢–b†W'&÷"’F‡&÷rW'&÷#°Ğ¢&WGW&â°Ğ¢–C¢76WBæ–BÀĞ¢7F÷'”–C¢76WBç7F÷'•ö–BÀĞ¢¶–æC¢76WBæ¶–æBÀĞ¢W&Ã¢FFç6–væVEW&ÂÀĞ¢Ö–ÖUG—S¢76WBæÖ–ÖU÷G—RÀĞ¢'—FU6—¦S¢76WBæ'—FU÷6—¦RÀĞ¢v–GFƒ¢76WBçv–GF‚ÀĞ¢†V–v‡C¢76WBæ†V–v‡BÀĞ¢GW&F–öä×3¢76WBæGW&F–öåö×2ÀĞ¢fÆ–FF–öå7FGW3¢76WBçfÆ–FF–öå÷7FGW2ÀĞ¢ÖWFFF¢76WBæÖWFFFÀĞ¢Ó°Ğ¢Ò’“°Ğ¢&WGW&â°Ğ¢–C¢F–vW7Bæ–BÀĞ¢'Vä¶W“¢F–vW7Bç'Våö¶W’ÀĞ¢7FGW3¢F–vW7Bç7FGW2ÀĞ¢W‡—&W4C¢F–vW7Bæ&÷fÅöW‡—&W5öBÀĞ¢W‡—&VC¢æWrFFR†F–vW7Bæ&÷fÅöW‡—&W5öB’ævWEF–ÖR‚’ÃÒFFRææ÷r‚’ÀĞ¢VÖ–Å6VçDC¢F–vW7Bç&Wf–WuöVÖ–Å÷6VçEöBÀĞ¢7&VFVDC¢F–vW7Bæ7&VFVEöBÀĞ¢&Wf–WvW'3¢$Ud”UtU%2ÀĞ¢6öææV7F÷'3¢6öææV7F÷%7FGW2‚’ÀĞ¢7F÷&–W3¢7F÷'•&÷w2æÖ‚‡7F÷'’’Óâ°Ğ¢6öç7B7F÷'”76WG2Ò6–væVD76WG2æf–ÇFW"‚†76WB’Óâ76WBç7F÷'”–BÓÓÒ7F÷'’æ–B“°Ğ¢6öç7B&–Ö'•f–FVòÒ7F÷'”76WG2æf–æB‚†76WB’Óâ76WBæ¶–æBÓÓÒ'f–FVò"“°Ğ¢6öç7B&–Ö'”–ÖvRÒ7F÷'”76WG2æf–æB‚†76WB’Óâ76WBæ¶–æBÓÓÒ&–ÖvR"“°Ğ¢6öç7B÷7FW"Ò7F÷'”76WG2æf–æB‚†76WB’Óâ76WBæ¶–æBÓÓÒ'÷7FW""“°Ğ¢&WGW&â°Ğ¢–C¢7F÷'’æ–BÀĞ¢¶W“¢7F÷'’ç7F÷'•ö¶W’ÀĞ¢6÷W&6UG—S¢7F÷'’ç6÷W&6U÷G—RÀĞ¢6÷W&6U&Vc¢7F÷'’ç6÷W&6U÷&VbÀĞ¢F—FÆS¢7F÷'’çF—FÆRÀĞ¢7VÖÖ'“¢7F÷'’ç7VÖÖ'’ÀĞ¢v‡•FöF“¢7F÷'’çv‡•÷FöF’ÀĞ¢76WEW&Ã¢&–Ö'•f–FVóòçW&Âóò&–Ö'”–ÖvSòçW&Âóò7F÷'’æ76WE÷W&ÂÀĞ¢76WD¶–æC¢&–Ö'•f–FVòò'f–FVò"¢&–Ö'”–ÖvRò&–ÖvR"¢7F÷'’æ76WEö¶–æBÀĞ¢÷7FW%W&Ã¢÷7FW#òçW&ÂóòçVÆÂÀĞ¢76WG3¢7F÷'”76WG2ÀĞ¢fVVF&6³¢fVVF&6µ&÷w2æf–ÇFW"‚†—FVÒ’Óâ—FVÒç7F÷'•ö–BÓÓÒ7F÷'’æ–B’ÀĞ¢Wf–FVæ6S¢7F÷'’æWf–FVæ6RÀĞ¢&æ³¢7F÷'’ç&æ²ÀĞ¢7FGW3¢7F÷'’ç7FGW2ÀĞ¢f&–çG3¢f&–çE&÷w2æf–ÇFW"‚‡f&–çB’Óâf&–çBç7F÷'•ö–BÓÓÒ7F÷'’æ–B’æÖ‚‡f&–çB’Óâ‡°Ğ¢–C¢f&–çBæ–BÀĞ¢6†ææVÃ¢f&–çBæ6†ææVÂÀĞ¢†VFÆ–æS¢f&–çBæ†VFÆ–æRÀĞ¢&öG“¢f&–çBæ&öG’ÀĞ¢†6‡Fw3¢'&’æ—4'&’‡f&–çBæ†6‡Fw2’òf&–çBæ†6‡Fw2¢µÒÀĞ¢7FGW3¢f&–çBç7FGW2ÀĞ¢&÷fVDC¢f&–çBæ&÷fVEöBÀĞ¢V&Æ—6†VDC¢f&–çBçV&Æ—6†VEöBÀĞ¢V&Æ—6†VEW&Ã¢f&–çBçV&Æ—6†VE÷W&ÂÀĞ¢Æ7DW'&÷#¢f&–çBæÆ7EöW'&÷"ÀĞ¢Ò’’ÀĞ¢Ó°Ğ¢Ò’ÀĞ¢Ó°Ğ§ĞĞ Ğ¦7–æ2gVæ7F–öâf–æEf&–çDf÷$F–vW7B†F–vW7D–C¢7G&–ærÂf&–çD–C¢7G&–ær’°Ğ¢–b‚õå³Ó–ÖbÕ×³3gÒBö’çFW7B‡f&–çD–B’’&WGW&âçVÆÃ°Ğ¢6öç7B7W&6RÒvWE7W&6TFÖ–â‚“°Ğ¢6öç7B²FF¢7F÷&–W2ÂW'&÷#¢7F÷&–W4W'&÷"ÒÒv—B7W&6Ræg&öÒ‚&&6–Å÷6ö6–Å÷7F÷&–W2"’ç6VÆV7B‚&–B"’æW‚&F–vW7Eö–B"ÂF–vW7D–B“°Ğ¢–b‡7F÷&–W4W'&÷"’F‡&÷r7F÷&–W4W'&÷#°Ğ¢6öç7B7F÷'”–G2Ò‡7F÷&–W2óòµÒ’æÖ‚‡7F÷'’’Óâ7F÷'’æ–B27G&–ær“°Ğ¢–b‚7F÷'”–G2æÆVæwF‚’&WGW&âçVÆÃ°Ğ¢6öç7B²FFÂW'&÷"ÒÒv—B7W&6Ræg&öÒ‚&&6–Å÷6ö6–Å÷f&–çG2"’ç6VÆV7B‚"¢"’æW‚&–B"Âf&–çD–B’æ–â‚'7F÷'•ö–B"Â7F÷'”–G2’æÖ–&U6–ævÆR‚“°Ğ¢–b†W'&÷"’F‡&÷rW'&÷#°Ğ¢&WGW&âFF2f&–çE&÷rÂçVÆÃ°Ğ§ĞĞ Ğ¦7–æ2gVæ7F–öâ&Vg&W6„F–vW7E7FGW2†F–vW7D–C¢7G&–ær’°Ğ¢6öç7B7W&6RÒvWE7W&6TFÖ–â‚“°Ğ¢6öç7B²FF¢7F÷&–W2ÒÒv—B7W&6Ræg&öÒ‚&&6–Å÷6ö6–Å÷7F÷&–W2"’ç6VÆV7B‚&–B"’æW‚&F–vW7Eö–B"ÂF–vW7D–B“°Ğ¢6öç7B7F÷'”–G2Ò‡7F÷&–W2óòµÒ’æÖ‚‡7F÷'’’Óâ7F÷'’æ–B27G&–ær“°Ğ¢–b‚7F÷'”–G2æÆVæwF‚’&WGW&ã°Ğ¢6öç7B²FF¢f&–çG2ÒÒv—B7W&6Ræg&öÒ‚&&6–Å÷6ö6–Å÷f&–çG2"’ç6VÆV7B‚'7FGW2"’æ–â‚'7F÷'•ö–B"Â7F÷'”–G2“°Ğ¢6öç7B7FGW6W2Ò‡f&–çG2óòµÒ’æÖ‚‡f&–çB’Óâf&–çBç7FGW227G&–ær“°Ğ¢6öç7B7FGW2Ò7FGW6W2ç6öÖR‚‡fÇVR’ÓâfÇVRÓÓÒ&G&gB"’ò&–å÷&Wf–Wr"¢&6ö×ÆWFVB#°Ğ¢v—B7W&6Ræg&öÒ‚&&6–Å÷6ö6–ÅöF–vW7G2"’çWFFR‡²7FGW2ÂWFFVEöC¢æWrFFR‚’çFô•4õ7G&–ær‚’Ò’æW‚&–B"ÂF–vW7D–B“°Ğ§ĞĞ Ğ¦W‡÷'B7–æ2gVæ7F–öâ6fU6ö6–Åf&–çB€Ğ¢F–vW7D–C¢7G&–ærÀĞ¢Fö¶Vã¢7G&–ærÀĞ¢f&–çD–C¢7G&–ærÀĞ¢f–VÆG3¢²†VFÆ–æSó¢7G&–æs²&öG“ó¢7G&–æs²†6‡Fw3ó¢7G&–æuµÒÒÀĞ¢’°Ğ¢6öç7BF–vW7BÒv—Bf–æDWF†÷&—¦VDF–vW7B†F–vW7D–BÂFö¶Vâ“°Ğ¢–b‚F–vW7B’F‡&÷ræWrW'&÷"‚%F†—26ö6–Â7GVF–òÆ–æ²—2–çfÆ–Bâ"“°Ğ¢–b†æWrFFR†F–vW7Bæ&÷fÅöW‡—&W5öB’ævWEF–ÖR‚’ÃÒFFRææ÷r‚’’F‡&÷ræWrW'&÷"‚%F†—26ö6–Â7GVF–òÆ–æ²†2W‡—&VBâ"“°Ğ¢6öç7Bf&–çBÒv—Bf–æEf&–çDf÷$F–vW7B†F–vW7D–BÂf&–çD–B“°Ğ¢–b‚f&–çB’F‡&÷ræWrW'&÷"‚%F†—26ö6–ÂG&gBFöW2æ÷B&VÆöærFòF†R&Wf–Wrâ"“°Ğ¢–b‡f&–çBç7FGW2ÓÓÒ'V&Æ—6†VB"’F‡&÷ræWrW'&÷"‚%V&Æ—6†VB6÷’—2&W6W'fVB2â–Ö×WF&ÆR&V6÷&Bâ"“°Ğ¢6öç7B†VFÆ–æRÒf–VÆG2æ†VFÆ–æSòçG&–Ò‚’ç6Æ–6RƒÂ3“°Ğ¢6öç7B&öG’Òf–VÆG2æ&öG“òçG&–Ò‚’ç6Æ–6RƒÂó“°Ğ¢6öç7B†6‡Fw2Òf–VÆG2æ†6‡Fw3òæÖ‚‡Fr’ÓâFrçG&–Ò‚’ç&WÆ6R‚õâ2òÂ""’’æf–ÇFW"„&ööÆVâ’ç6Æ–6RƒÂ"“°Ğ¢–b††VFÆ–æRÓÒVæFVf–æVBbb†VFÆ–æR’F‡&÷ræWrW'&÷"‚$†VFÆ–æR—2&WV—&VBâ"“°Ğ¢–b†&öG’ÓÒVæFVf–æVBbb&öG’’F‡&÷ræWrW'&÷"‚%÷7B6÷’—2&WV—&VBâ"“°Ğ¢6öç7BWFFS¢&V6÷&CÇ7G&–ærÂVæ¶æ÷vãâÒ²WFFVEöC¢æWrFFR‚’çFô•4õ7G&–ær‚’Ó°Ğ¢–b††VFÆ–æRÓÒVæFVf–æVB’WFFRæ†VFÆ–æRÒ†VFÆ–æS°Ğ¢–b†&öG’ÓÒVæFVf–æVB’WFFRæ&öG’Ò&öG“°Ğ¢–b††6‡Fw2ÓÒVæFVf–æVB’WFFRæ†6‡Fw2Ò†6‡Fw3°Ğ¢–b‡f&–çBç7FGW2ÓÒ'&V¦V7FVB"’WFFRç7FGW2Ò&G&gB#°Ğ¢6öç7B²FFÂW'&÷"ÒÒv—BvWE7W&6TFÖ–â‚’æg&öÒ‚&&6–Å÷6ö6–Å÷f&–çG2"’çWFFR‡WFFR’æW‚&–B"Âf&–çD–B’ç6VÆV7B‚"¢"’ç6–ævÆR‚“°Ğ¢–b†W'&÷"’F‡&÷rW'&÷#°Ğ¢v—B&Vg&W6„F–vW7E7FGW2†F–vW7D–B“°Ğ¢&WGW&âFF2f&–çE&÷s°Ğ§ĞĞ Ğ¦W‡÷'B7–æ2gVæ7F–öâFV6–FU6ö6–Åf&–çB€Ğ¢F–vW7D–C¢7G&–ærÀĞ¢Fö¶Vã¢7G&–ærÀĞ¢f&–çD–C¢7G&–ærÀĞ¢FV6—6–öã¢&&÷fR"Â'&V¦V7B"Â&G&gB"Â'V&Æ—6†VB"ÀĞ¢V&Æ—6†VEW&Ãó¢7G&–ærÀĞ¢’°Ğ¢6öç7BF–vW7BÒv—Bf–æDWF†÷&—¦VDF–vW7B†F–vW7D–BÂFö¶Vâ“°Ğ¢–b‚F–vW7B’F‡&÷ræWrW'&÷"‚%F†—26ö6–Â7GVF–òÆ–æ²—2–çfÆ–Bâ"“°Ğ¢–b†æWrFFR†F–vW7Bæ&÷fÅöW‡—&W5öB’ævWEF–ÖR‚’ÃÒFFRææ÷r‚’’F‡&÷ræWrW'&÷"‚%F†—26ö6–Â7GVF–òÆ–æ²†2W‡—&VBâ"“°Ğ¢6öç7Bf&–çBÒv—Bf–æEf&–çDf÷$F–vW7B†F–vW7D–BÂf&–çD–B“°Ğ¢–b‚f&–çB’F‡&÷ræWrW'&÷"‚%F†—26ö6–ÂG&gBFöW2æ÷B&VÆöærFòF†R&Wf–Wrâ"“°Ğ¢–b‡f&–çBç7FGW2ÓÓÒ'V&Æ—6†VB"bbFV6—6–öâÓÒ'V&Æ—6†VB"’F‡&÷ræWrW'&÷"‚$V&Æ—6†VBG&gB6ææ÷B&RÖ÷fVB&6²–çFò&Wf–Wrâ"“°Ğ¢6öç7Bæ÷rÒæWrFFR‚’çFô•4õ7G&–ær‚“°Ğ¢6öç7B7FGW2ÒFV6—6–öâÓÓÒ&&÷fR"ò&ÖçVÅ÷&VG’"¢FV6—6–öâÓÓÒ'&V¦V7B"ò'&V¦V7FVB"¢FV6—6–öã°Ğ¢6öç7B6ÆVåV&Æ—6†VEW&ÂÒV&Æ—6†VEW&ÃòçG&–Ò‚’ç6Æ–6RƒÂ#’ÇÂçVÆÃ°Ğ¢–b†FV6—6–öâÓÓÒ'V&Æ—6†VB"bb6ÆVåV&Æ—6†VEW&Âbbõæ‡GG3ó¥ÂõÂòö’çFW7B†6ÆVåV&Æ—6†VEW&Â’’°Ğ¢F‡&÷ræWrW'&÷"‚%V&Æ—6†VBÆ–æ·2×W7B&Vv–âv—F‚‡GG¢òò÷"‡GG3¢òòâ"“°Ğ¢ĞĞ¢6öç7B²FFÂW'&÷"ÒÒv—BvWE7W&6TFÖ–â‚’æg&öÒ‚&&6–Å÷6ö6–Å÷f&–çG2"’çWFFR‡°Ğ¢7FGW2ÀĞ¢&÷fVEöC¢7FGW2ÓÓÒ&ÖçVÅ÷&VG’"ÇÂ7FGW2ÓÓÒ'V&Æ—6†VB"ò‡f&–çBæ&÷fVEöBóòæ÷r’¢çVÆÂÀĞ¢V&Æ—6†VEöC¢7FGW2ÓÓÒ'V&Æ—6†VB"ò‡f&–çBçV&Æ—6†VEöBóòæ÷r’¢çVÆÂÀĞ¢V&Æ—6†VE÷W&Ã¢7FGW2ÓÓÒ'V&Æ—6†VB"ò6ÆVåV&Æ—6†VEW&Â¢çVÆÂÀĞ¢Æ7EöW'&÷#¢çVÆÂÀĞ¢WFFVEöC¢æ÷rÀĞ¢Ò’æW‚&–B"Âf&–çD–B’ç6VÆV7B‚"¢"’ç6–ævÆR‚“°Ğ¢–b†W'&÷"’F‡&÷rW'&÷#°Ğ¢v—B&Vg&W6„F–vW7E7FGW2†F–vW7D–B“°Ğ¢&WGW&âFF2f&–çE&÷s°Ğ§ĞĞ Ğ¦W‡÷'B7–æ2gVæ7F–öâ&÷fTÆÅ6ö6–Åf&–çG2†F–vW7D–C¢7G&–ærÂFö¶Vã¢7G&–ær’°Ğ¢6öç7BF–vW7BÒv—Bf–æDWF†÷&—¦VDF–vW7B†F–vW7D–BÂFö¶Vâ“°Ğ¢–b‚F–vW7B’F‡&÷ræWrW'&÷"‚%F†—26ö6–Â7GVF–òÆ–æ²—2–çfÆ–Bâ"“°Ğ¢–b†æWrFFR†F–vW7Bæ&÷fÅöW‡—&W5öB’ævWEF–ÖR‚’ÃÒFFRææ÷r‚’’F‡&÷ræWrW'&÷"‚%F†—26ö6–Â7GVF–òÆ–æ²†2W‡—&VBâ"“°Ğ¢6öç7B7W&6RÒvWE7W&6TFÖ–â‚“°Ğ¢6öç7B²FF¢7F÷'’ÂW'&÷#¢7F÷&–W4W'&÷"ÒÒv—B7W&6PĞ¢æg&öÒ‚&&6–Å÷6ö6–Å÷7F÷&–W2"Ğ¢ç6VÆV7B‚&–B"Ğ¢æW‚&F–vW7Eö–B"ÂF–vW7D–BĞ¢æ÷&FW"‚'&æ²"Â²66VæF–æs¢G'VRÒĞ¢æÆ–Ö—BƒĞ¢æÖ–&U6–ævÆR‚“°Ğ¢–b‡7F÷&–W4W'&÷"’F‡&÷r7F÷&–W4W'&÷#°Ğ¢–b‚7F÷'’’&WGW&â²&÷fVC¢Â&V6öã¢&æõ÷&–Ö'•÷7F÷'’"Ó°Ğ¢6öç7B²FF¢f–FVòÂW'&÷#¢f–FVôW'&÷"ÒÒv—B7W&6PĞ¢æg&öÒ‚&&6–Å÷6ö6–Åö76WG2"Ğ¢ç6VÆV7B‚&–B"Ğ¢æW‚'7F÷'•ö–B"Â7F÷'’æ–BĞ¢æW‚&¶–æB"Â'f–FVò"Ğ¢æW‚'fÆ–FF–öå÷7FGW2"Â'fÆ–B"Ğ¢æÆ–Ö—BƒĞ¢æÖ–&U6–ævÆR‚“°Ğ¢–b‡f–FVôW'&÷"’F‡&÷rf–FVôW'&÷#°Ğ¢–b‚f–FVò’&WGW&â²&÷fVC¢Â&V6öã¢'f–FVõöæ÷E÷&VG’"Ó°Ğ¢6öç7Bæ÷rÒæWrFFR‚’çFô•4õ7G&–ær‚“°Ğ¢6öç7B²FFÂW'&÷"ÒÒv—B7W&6PĞ¢æg&öÒ‚&&6–Å÷6ö6–Å÷f&–çG2"Ğ¢çWFFR‡²7FGW3¢&ÖçVÅ÷&VG’"Â&÷fVEöC¢æ÷rÂÆ7EöW'&÷#¢çVÆÂÂWFFVEöC¢æ÷rÒĞ¢æW‚'7F÷'•ö–B"Â7F÷'’æ–BĞ¢æ–â‚&6†ææVÂ"Â²'–÷WGV&R"Â&–ç7Fw&Ò"Â'&VFF—B%ÒĞ¢æ–â‚'7FGW2"Â²&G&gB"Â&f–ÆVB%ÒĞ¢ç6VÆV7B‚&–B"“°Ğ¢–b†W'&÷"’F‡&÷rW'&÷#°Ğ¢v—B&Vg&W6„F–vW7E7FGW2†F–vW7D–B“°Ğ¢&WGW&â²&÷fVC¢FFòæÆVæwF‚óòÓ°Ğ§ĞĞ Ğ¦W‡÷'B7–æ2gVæ7F–öâ&WVW7E6ö6–Å&Wf—6–öâ€Ğ¢F–vW7D–C¢7G&–ærÀĞ¢Fö¶Vã¢7G&–ærÀĞ¢7F÷'”–C¢7G&–ærÀĞ¢fVVF&6³¢7G&–ærÀĞ¢’°Ğ¢6öç7BF–vW7BÒv—Bf–æDWF†÷&—¦VDF–vW7B†F–vW7D–BÂFö¶Vâ“°Ğ¢–b‚F–vW7B’F‡&÷ræWrW'&÷"‚%F†—26ö6–Â7GVF–òÆ–æ²—2–çfÆ–Bâ"“°Ğ¢–b†æWrFFR†F–vW7Bæ&÷fÅöW‡—&W5öB’ævWEF–ÖR‚’ÃÒFFRææ÷r‚’’F‡&÷ræWrW'&÷"‚%F†—26ö6–Â7GVF–òÆ–æ²†2W‡—&VBâ"“°Ğ¢6öç7B6ÆVäfVVF&6²ÒfVVF&6²çG&–Ò‚’ç6Æ–6RƒÂ#“°Ğ¢–b†6ÆVäfVVF&6²æÆVæwF‚Â"’F‡&÷ræWrW'&÷"‚%FVÆÂ&6–Âv†B–÷RvçB6†ævVBâ"“°Ğ¢6öç7B7W&6RÒvWE7W&6TFÖ–â‚“°Ğ¢6öç7B²FF¢7F÷'’ÂW'&÷#¢7F÷'”W'&÷"ÒÒv—B7W&6PĞ¢æg&öÒ‚&&6–Å÷6ö6–Å÷7F÷&–W2"Ğ¢ç6VÆV7B‚&–B"Ğ¢æW‚&–B"Â7F÷'”–BĞ¢æW‚&F–vW7Eö–B"ÂF–vW7D–BĞ¢æÖ–&U6–ævÆR‚“°Ğ¢–b‡7F÷'”W'&÷"’F‡&÷r7F÷'”W'&÷#°Ğ¢–b‚7F÷'’’F‡&÷ræWrW'&÷"‚%F†—27F÷'’FöW2æ÷B&VÆöærFòF†R&Wf–Wrâ"“°Ğ¢6öç7B²FFÂW'&÷"ÒÒv—B7W&6Ræg&öÒ‚&&6–Å÷6ö6–ÅöfVVF&6²"’æ–ç6W'B‡°Ğ¢F–vW7Eö–C¢F–vW7D–BÀĞ¢7F÷'•ö–C¢7F÷'”–BÀĞ¢fVVF&6³¢6ÆVäfVVF&6²ÀĞ¢Ò’ç6VÆV7B‚&–BÇ7F÷'•ö–BÆfVVF&6²Ç7FGW2Æ7&VFVEöB"’ç6–ævÆR‚“°Ğ¢–b†W'&÷"’F‡&÷rW'&÷#°Ğ¢6öç7Bæ÷rÒæWrFFR‚’çFô•4õ7G&–ær‚“°Ğ¢v—B&öÖ—6RæÆÂ…°Ğ¢7W&6Ræg&öÒ‚&&6–Å÷6ö6–Å÷7F÷&–W2"’çWFFR‡²7FGW3¢&†VÆB"ÂWFFVEöC¢æ÷rÒ’æW‚&–B"Â7F÷'”–B’ÀĞ¢7W&6Ræg&öÒ‚&&6–Å÷6ö6–Å÷f&–çG2"’çWFFR‡²7FGW3¢&G&gB"Â&÷fVEöC¢çVÆÂÂWFFVEöC¢æ÷rÒ’æW‚'7F÷'•ö–B"Â7F÷'”–B’ææW‚'7FGW2"Â'V&Æ—6†VB"’ÀĞ¢Ò“°Ğ¢v—B&Vg&W6„F–vW7E7FGW2†F–vW7D–B“°Ğ¢&WGW&âFF2fVVF&6µ&÷s°Ğ§ĞĞ Ğ¦W‡÷'BgVæ7F–öâ—56ö6–Ä6†ææVÂ‡fÇVS¢Væ¶æ÷vâ“¢fÇVR—26ö6–Ä6†ææVÂ°Ğ¢&WGW&âG—VöbfÇVRÓÓÒ'7G&–ær"bb4ô4”Åô4„ääTÅ2æ–æ6ÇVFW2‡fÇVR26ö6–Ä6†ææVÂ“°Ğ§ĞĞ 