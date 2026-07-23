import { createHash, randomBytes } from "node:crypto";
import { getNewsletterResend, getResend } from "@/lib/resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getBasilUrl } from "./urls";

const SEGMENT_ID = process.env.RESEND_BASIL_SEGMENT_ID ?? "f61b5a6a-3767-4b6b-a8dd-d714cbd78987";
const TOPIC_ID = process.env.RESEND_BASIL_NEWSLETTER_TOPIC_ID ?? "b44d061d-8cad-43b6-ac0e-5a32e5689448";
const REVIEWERS = (process.env.BASIL_NEWSLETTER_REVIEW_EMAILS ?? "info@bygoetz.com")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const FROM = process.env.BASIL_NEWSLETTER_FROM ?? "Basil Community Garden <garden@send.bygoetz.com>";
const REPLY_TO = process.env.BASIL_NEWSLETTER_REPLY_TO ?? "info@bygoetz.com";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type BasilNewsletterStats = {
  measuredAt: string;
  communityFlowers: number;
  roses: number;
  sunflowers: number;
  lavender: number;
  weeds: number;
  gardenMembers: number;
  personalGardenFlowers: number;
  careSharedThisMonth: number;
};

type NewsletterIssue = {
  id: string;
  period_key: string;
  title: string;
  subject: string;
  preview_text: string;
  html_body: string;
  text_body: string;
  stats: BasilNewsletterStats;
  status: "review_ready" | "sending" | "sent" | "failed";
  approval_expires_at: string;
  resend_broadcast_id: string | null;
  sent_at: string | null;
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function count(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function parseStats(value: unknown): BasilNewsletterStats {
  const stats = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    measuredAt: typeof stats.measuredAt === "string" ? stats.measuredAt : new Date().toISOString(),
    communityFlowers: count(stats.communityFlowers),
    roses: count(stats.roses),
    sunflowers: count(stats.sunflowers),
    lavender: count(stats.lavender),
    weeds: count(stats.weeds),
    gardenMembers: count(stats.gardenMembers),
    personalGardenFlowers: count(stats.personalGardenFlowers),
    careSharedThisMonth: count(stats.careSharedThisMonth),
  };
}

function pretty(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

async function ensureSubscribedContact(email: string) {
  const resend = getNewsletterResend();
  const { data: existing } = await resend.contacts.get({ email });
  if (existing?.id) {
    const [{ error: segmentError }, { error: topicError }] = await Promise.all([
      resend.contacts.segments.add({ email, segmentId: SEGMENT_ID }),
      resend.contacts.topics.update({ email, topics: [{ id: TOPIC_ID, subscription: "opt_in" }] }),
    ]);
    if (segmentError && !/already/i.test(segmentError.message)) throw new Error(segmentError.message);
    if (topicError) throw new Error(topicError.message);
    return existing.id;
  }
  const { data, error } = await resend.contacts.create({
    email,
    segments: [{ id: SEGMENT_ID }],
    topics: [{ id: TOPIC_ID, subscription: "opt_in" }],
  });
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "America/Chicago" }).format(date);
}

function renderNewsletter(stats: BasilNewsletterStats, date: Date) {
  const month = monthLabel(date);
  const title = `${month} in the Community Garden`;
  const subject = `🌱 ${month} in Basil`;
  const previewText = `${pretty(stats.communityFlowers)} flowers are growing in the shared garden.`;
  const statCards = [
    ["Community flowers", stats.communityFlowers],
    ["Roses", stats.roses],
    ["Sunflowers", stats.sunflowers],
    ["Lavender", stats.lavender],
    ["Garden members", stats.gardenMembers],
    ["Flowers in My Gardens", stats.personalGardenFlowers],
  ];
  const cards = statCards.map(([label, value]) => `<td style="width:50%;padding:8px"><div style="border:2px solid #3a2927;background:#fff8e8;padding:18px;text-align:center"><div style="font:700 28px Georgia,serif;color:#b33a3a">${pretty(Number(value))}</div><div style="font:600 13px Arial,sans-serif;color:#4a3b35;margin-top:5px">${label}</div></div></td>`);
  const rows = Array.from({ length: Math.ceil(cards.length / 2) }, (_, index) => `<tr>${cards[index * 2]}${cards[index * 2 + 1] ?? "<td></td>"}</tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#e9e1d3;color:#302321"><div style="display:none;max-height:0;overflow:hidden">${previewText}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border:3px solid #302321;background:#f7ecd2"><tr><td style="padding:34px 30px 18px;text-align:center"><div style="font-size:34px">🌹</div><div style="font:700 30px Georgia,serif;letter-spacing:2px">BASIL</div><div style="font:700 12px Arial,sans-serif;letter-spacing:2px;margin-top:5px">THE COMMUNITY GARDEN LETTER</div></td></tr><tr><td style="padding:10px 30px 28px"><h1 style="font:700 28px Georgia,serif;margin:0 0 14px;text-align:center">${title}</h1><p style="font:17px/1.6 Georgia,serif;margin:0 0 20px">People from many places have been tending the same little landscape. Here is what the garden has grown into this month.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table><p style="font:17px/1.6 Georgia,serif;margin:22px 0 8px">Together, gardeners have shared <strong>${pretty(stats.careSharedThisMonth)} Care</strong> this month. Even the <strong>${pretty(stats.weeds)} weeds</strong> are part of the garden finding its balance.</p><p style="font:17px/1.6 Georgia,serif;margin:0 0 24px">Thank you for tending this shared space with us.</p><p style="text-align:center"><a href="${getBasilUrl()}" style="display:inline-block;background:#b33a3a;color:#fff8e8;border:2px solid #302321;padding:13px 20px;text-decoration:none;font:700 15px Arial,sans-serif">Visit the garden</a></p></td></tr><tr><td style="border-top:2px solid #302321;padding:20px 30px;text-align:center;font:12px/1.5 Arial,sans-serif;color:#665651">Basil Community Garden by Goetz<br><a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#665651">Unsubscribe from the monthly garden letter</a></td></tr></table></td></tr></table></body></html>`;
  const text = `${title}\n\nPeople from many places have been tending the same little landscape.\n\nCommunity flowers: ${pretty(stats.communityFlowers)}\nRoses: ${pretty(stats.roses)}\nSunflowers: ${pretty(stats.sunflowers)}\nLavender: ${pretty(stats.lavender)}\nGarden members: ${pretty(stats.gardenMembers)}\nFlowers in My Gardens: ${pretty(stats.personalGardenFlowers)}\nCare shared this month: ${pretty(stats.careSharedThisMonth)}\n\nVisit the garden: ${getBasilUrl()}\n\nUnsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}`;
  return { title, subject, previewText, html, text };
}

async function getIssue(id: string) {
  const { data, error } = await getSupabaseAdmin().from("garden_newsletter_issues").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as NewsletterIssue | null;
}

export async function syncEligibleNewsletterMembers() {
  const supabase = getSupabaseAdmin();
  const { data: entitlements, error } = await supabase
    .from("garden_entitlements")
    .select("steward_id,garden_stewards!inner(user_id)")
    .eq("status", "active");
  if (error) throw error;
  let synced = 0;
  for (const entitlement of entitlements ?? []) {
    const relation = entitlement.garden_stewards as unknown as { user_id?: string } | { user_id?: string }[];
    const userId = Array.isArray(relation) ? relation[0]?.user_id : relation?.user_id;
    if (!userId) continue;
    const { data: preference, error: preferenceError } = await supabase
      .from("garden_newsletter_preferences")
      .select("subscribed,resend_contact_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (preferenceError) throw preferenceError;
    if (preference && !preference.subscribed) continue;
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError) throw authError;
    const email = authData.user?.email?.trim().toLowerCase();
    if (!email) continue;
    const contactId = await ensureSubscribedContact(email);
    const now = new Date().toISOString();
    const { error: upsertError } = await supabase.from("garden_newsletter_preferences").upsert({
      user_id: userId,
      steward_id: entitlement.steward_id,
      subscribed: true,
      resend_contact_id: contactId ?? preference?.resend_contact_id ?? null,
      subscribed_at: now,
      unsubscribed_at: null,
      updated_at: now,
    }, { onConflict: "user_id" });
    if (upsertError) throw upsertError;
    synced += 1;
  }
  return synced;
}

export async function createMonthlyNewsletterIssue(periodKey: string, date = new Date()) {
  const supabase = getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabase.from("garden_newsletter_issues").select("id,status,review_email_sent_at").eq("period_key", periodKey).maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { id: existing.id as string, created: false, status: existing.status as string };
  const { data: rawStats, error: statsError } = await supabase.rpc("get_basil_newsletter_stats");
  if (statsError) throw statsError;
  const stats = parseStats(rawStats);
  const rendered = renderNewsletter(stats, date);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const { data: issue, error: insertError } = await supabase.from("garden_newsletter_issues").insert({
    period_key: periodKey,
    title: rendered.title,
    subject: rendered.subject,
    preview_text: rendered.previewText,
    html_body: rendered.html,
    text_body: rendered.text,
    stats,
    approval_token_hash: tokenHash(token),
    approval_expires_at: expiresAt,
  }).select("id").single();
  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raced } = await supabase.from("garden_newsletter_issues").select("id,status").eq("period_key", periodKey).single();
      return { id: raced!.id as string, created: false, status: raced!.status as string };
    }
    throw insertError;
  }
  const reviewUrl = `${getBasilUrl(`/community-garden/newsletter/review?issue=${issue.id}`)}#token=${token}`;
  const { data: email, error: emailError } = await getResend().emails.send({
    from: FROM,
    to: REVIEWERS,
    replyTo: REPLY_TO,
    subject: `Review before sending: ${rendered.subject}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h1>Your Basil monthly letter is ready</h1><p>This is a private review only. Nothing has been sent to members.</p><p><a href="${reviewUrl}" style="display:inline-block;padding:12px 18px;background:#b33a3a;color:white;text-decoration:none">Review the draft</a></p><p>Opening the link never sends the newsletter. Sending requires a separate confirmation button on the review page. This link expires in seven days.</p><hr>${rendered.html}</div>`,
    text: `Your Basil monthly letter is ready. Nothing has been sent to members. Review it here: ${reviewUrl}\n\nOpening the link never sends the newsletter. Sending requires a separate confirmation.`,
    headers: { "X-Entity-Ref-ID": `basil-newsletter-review-${issue.id}` },
  }, { idempotencyKey: `basil-newsletter-review-${issue.id}` });
  if (emailError) {
    await supabase.from("garden_newsletter_issues").delete().eq("id", issue.id).is("review_email_sent_at", null);
    throw new Error(emailError.message);
  }
  const { error: reviewUpdateError } = await supabase.from("garden_newsletter_issues").update({ review_email_id: email?.id ?? null, review_email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", issue.id);
  if (reviewUpdateError) throw reviewUpdateError;
  return { id: issue.id as string, created: true, status: "review_ready" };
}

export async function reviewNewsletterIssue(issueId: string, token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(issueId) || token.length < 32 || token.length > 100) return null;
  const { data, error } = await getSupabaseAdmin().from("garden_newsletter_issues")
    .select("id,title,subject,preview_text,html_body,stats,status,approval_expires_at,sent_at")
    .eq("id", issueId).eq("approval_token_hash", tokenHash(token)).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    title: data.title,
    subject: data.subject,
    previewText: data.preview_text,
    htmlBody: data.html_body,
    stats: parseStats(data.stats),
    status: data.status,
    expiresAt: data.approval_expires_at,
    sentAt: data.sent_at,
    expired: new Date(data.approval_expires_at).getTime() <= Date.now(),
  };
}

export async function approveAndSendNewsletter(issueId: string, token: string) {
  const supabase = getSupabaseAdmin();
  const issue = await getIssue(issueId);
  if (!issue || tokenHash(token) !== (await supabase.from("garden_newsletter_issues").select("approval_token_hash").eq("id", issueId).single()).data?.approval_token_hash) throw new Error("This review link is invalid.");
  if (new Date(issue.approval_expires_at).getTime() <= Date.now()) throw new Error("This review link has expired.");
  if (issue.status === "sent") return { status: "sent" as const, sentAt: issue.sent_at };
  await syncEligibleNewsletterMembers();
  let broadcastId = issue.resend_broadcast_id;
  if (!broadcastId) {
    const { data: broadcast, error: createError } = await getNewsletterResend().broadcasts.create({
      segmentId: SEGMENT_ID,
      topicId: TOPIC_ID,
      from: FROM,
      replyTo: REPLY_TO,
      name: `Basil ${issue.period_key}`,
      subject: issue.subject,
      previewText: issue.preview_text,
      html: issue.html_body,
      text: issue.text_body,
      send: false,
    }, { headers: { "Idempotency-Key": `basil-newsletter-broadcast-${issue.id}` } });
    if (createError) throw new Error(createError.message);
    broadcastId = broadcast?.id ?? null;
    if (!broadcastId) throw new Error("Resend did not create the newsletter broadcast.");
    await supabase.from("garden_newsletter_issues").update({ resend_broadcast_id: broadcastId, updated_at: new Date().toISOString() }).eq("id", issue.id).is("resend_broadcast_id", null);
  }
  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase.from("garden_newsletter_issues").update({ status: "sending", approved_at: claimedAt, last_error: null, updated_at: claimedAt }).eq("id", issue.id).in("status", ["review_ready", "failed"]).select("id").maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) {
    const latest = await getIssue(issue.id);
    return { status: latest?.status ?? "sending", sentAt: latest?.sent_at ?? null };
  }
  const { error: sendError } = await getNewsletterResend().broadcasts.send(broadcastId);
  if (sendError) {
    await supabase.from("garden_newsletter_issues").update({ status: "failed", failed_at: new Date().toISOString(), last_error: sendError.message.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", issue.id);
    throw new Error(sendError.message);
  }
  const sentAt = new Date().toISOString();
  await supabase.from("garden_newsletter_issues").update({ status: "sent", sent_at: sentAt, approval_token_hash: tokenHash(randomBytes(32).toString("base64url")), updated_at: sentAt }).eq("id", issue.id);
  return { status: "sent" as const, sentAt };
}

export async function setNewsletterPreference(userId: string, subscribed: boolean) {
  const supabase = getSupabaseAdmin();
  const { data: steward, error } = await supabase.from("garden_stewards").select("id").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!steward) throw new Error("A Garden Membership is required for the monthly letter.");
  const { data: entitlement, error: entitlementError } = await supabase.from("garden_entitlements").select("id").eq("steward_id", steward.id).eq("status", "active").limit(1).maybeSingle();
  if (entitlementError) throw entitlementError;
  if (!entitlement) throw new Error("A Garden Membership is required for the monthly letter.");
  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId);
  if (authError) throw authError;
  const email = authData.user?.email?.trim().toLowerCase();
  if (!email) throw new Error("This account does not have an email address.");
  const now = new Date().toISOString();
  if (subscribed) {
    const contactId = await ensureSubscribedContact(email);
    await supabase.from("garden_newsletter_preferences").upsert({ user_id: userId, steward_id: steward.id, subscribed: true, resend_contact_id: contactId, subscribed_at: now, unsubscribed_at: null, updated_at: now }, { onConflict: "user_id" });
  } else {
    const { error: topicError } = await getNewsletterResend().contacts.topics.update({ email, topics: [{ id: TOPIC_ID, subscription: "opt_out" }] });
    if (topicError) throw new Error(topicError.message);
    await supabase.from("garden_newsletter_preferences").upsert({ user_id: userId, steward_id: steward.id, subscribed: false, unsubscribed_at: now, updated_at: now }, { onConflict: "user_id" });
  }
  return subscribed;
}

export async function getNewsletterPreference(userId: string) {
  const { data, error } = await getSupabaseAdmin().from("garden_newsletter_preferences").select("subscribed").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data?.subscribed ?? null;
}

export function isMonthlyDraftDue(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short", day: "2-digit" }).formatToParts(date);
  const day = Number(parts.find((part) => part.type === "day")?.value ?? 0);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  return weekday === "Tue" && day <= 7;
}

export function monthlyPeriodKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit" }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}
