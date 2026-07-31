"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./social-studio.module.css";

type Channel = "reddit" | "youtube" | "instagram" | "tiktok";
type Variant = {
  id: string;
  channel: Channel;
  headline: string;
  body: string;
  hashtags: string[];
  status: "draft" | "manual_ready" | "rejected" | "published" | "failed";
  publishedUrl: string | null;
};
type ReelPlan = {
  hook: string;
  shots: string[];
  payoff: string;
  targetSeconds: number;
  fallbackVisual: string;
};
type ProductionBrief = {
  objective: string;
  format: string;
  scene: string;
  intendedAudience: string;
  distribution: string;
  hypothesis: string;
  alternateHooks: string[];
  destinationUrl: string;
  trackingCode: string;
  truthClaims: Array<{ claim: string; supported: boolean; basis: string }>;
};
type SocialAsset = {
  id: string;
  kind: "video" | "poster" | "image" | "audio";
  url: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  validationStatus: "valid";
};
type Revision = {
  id: string;
  feedback: string;
  status: "queued" | "resolved" | "dismissed";
  created_at: string;
};
type Story = {
  id: string;
  key: string;
  title: string;
  summary: string;
  whyToday: string;
  sourceType: string;
  sourceRef: string | null;
  assetUrl: string;
  assetKind: "image" | "video";
  posterUrl: string | null;
  assets: SocialAsset[];
  feedback: Revision[];
  evidence: Record<string, unknown>;
  variants: Variant[];
};
type Connector = { mode: string; label: string };
type Digest = {
  id: string;
  runKey: string;
  status: string;
  expired: boolean;
  createdAt: string;
  reviewers: string[];
  connectors: Record<string, Connector>;
  feedback: Revision[];
  stories: Story[];
};

const CHANNEL_ORDER: Channel[] = ["instagram", "youtube", "reddit"];
const CHANNEL_LABELS: Record<Channel, string> = {
  instagram: "Instagram Reel",
  youtube: "YouTube Short",
  tiktok: "TikTok",
  reddit: "Reddit companion",
};

const DEVELOPMENT_PREVIEW: Digest = {
  id: "00000000-0000-4000-8000-000000000000",
  runKey: "development-preview",
  status: "review_ready",
  expired: false,
  createdAt: "2026-07-30T14:00:00.000Z",
  reviewers: ["info@bygoetz.com"],
  connectors: {
    email: { mode: "connected", label: "Daily review email" },
    instagram: { mode: "connected_desktop", label: "Scheduled through signed-in Codex desktop" },
    youtube: { mode: "connected_desktop", label: "Scheduled through signed-in Codex desktop" },
    reddit: { mode: "connected_desktop", label: "Scheduled through signed-in Codex desktop" },
  },
  feedback: [],
  stories: [{
    id: "10000000-0000-4000-8000-000000000000",
    key: "watering-spread",
    title: "Water is becoming a spreading gesture",
    summary: "A vertical-first explanation of Basil's two-tap watering rhythm and its goal of feeling like a small spread of water.",
    whyToday: "Watering is a repeatable action, so showing its rhythm can immediately improve how the garden feels to play.",
    sourceType: "repository",
    sourceRef: null,
    assetUrl: "/community-garden/social-captures/rose-garden-gameplay.jpg",
    assetKind: "image",
    posterUrl: null,
    assets: [],
    feedback: [],
    evidence: {
      reelPlan: {
        hook: "Water three flowers in two taps.",
        shots: ["Select a droplet beyond Mary's reach.", "Pause on the highlighted three-flower cluster.", "Tap again to show the spread and Care receipt."],
        payoff: "Replay the gesture once with: choose, spread, care.",
        targetSeconds: 12,
        fallbackVisual: "A three-frame Basil diagram: selected droplet, highlighted cluster, completed spread.",
      },
    },
    variants: CHANNEL_ORDER.map((channel, index) => ({
      id: `20000000-0000-4000-8000-00000000000${index}`,
      channel,
      headline: channel === "instagram" ? "Choose the droplet. Follow the spread." : channel === "reddit" ? "How watering works in Basil" : "Water three flowers in two taps",
      body: channel === "reddit"
        ? "First, choose a water droplet outside Mary's immediate reach. Basil highlights three adjacent flowers. Tap again to send the water across that group and receive the Care from the action."
        : "Pick the droplet, follow the highlighted spread, and collect your Care.",
      hashtags: channel === "reddit" ? [] : ["BasilCommunityGarden", "CozyGames"],
      status: "draft",
      publishedUrl: null,
    })),
  }],
};

function parseReelPlan(evidence: Record<string, unknown>): ReelPlan | null {
  const value = evidence.reelPlan;
  if (!value || typeof value !== "object") return null;
  const plan = value as Record<string, unknown>;
  if (typeof plan.hook !== "string" || !Array.isArray(plan.shots) || typeof plan.payoff !== "string") return null;
  return {
    hook: plan.hook,
    shots: plan.shots.filter((shot): shot is string => typeof shot === "string"),
    payoff: plan.payoff,
    targetSeconds: typeof plan.targetSeconds === "number" ? plan.targetSeconds : 15,
    fallbackVisual: typeof plan.fallbackVisual === "string" ? plan.fallbackVisual : "Use a clearly labeled Basil-style explainer.",
  };
}

function prettyDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function parseProductionBrief(evidence: Record<string, unknown>): ProductionBrief | null {
  const candidate = evidence.productionManifest ?? evidence.creativeBrief;
  if (!candidate || typeof candidate !== "object") return null;
  const value = candidate as Record<string, unknown>;
  const truthClaims = Array.isArray(value.truthClaims)
    ? value.truthClaims.flatMap((claim) => {
        if (!claim || typeof claim !== "object") return [];
        const item = claim as Record<string, unknown>;
        if (typeof item.claim !== "string" || typeof item.basis !== "string") return [];
        return [{ claim: item.claim, supported: item.supported === true, basis: item.basis }];
      })
    : [];
  return {
    objective: typeof value.objective === "string" ? value.objective : "Not assigned",
    format: typeof value.format === "string" ? value.format : typeof value.videoFormat === "string" ? value.videoFormat : "Not assigned",
    scene: typeof value.scene === "string" ? value.scene : typeof value.captureRecipe === "string" ? value.captureRecipe : "Not assigned",
    intendedAudience: typeof value.intendedAudience === "string" ? value.intendedAudience : "Not assigned",
    distribution: typeof value.distribution === "string" ? value.distribution : "organic",
    hypothesis: typeof value.hypothesis === "string" ? value.hypothesis : "Not assigned",
    alternateHooks: Array.isArray(value.alternateHooks) ? value.alternateHooks.filter((hook): hook is string => typeof hook === "string") : [],
    destinationUrl: typeof value.destinationUrl === "string" ? value.destinationUrl : "",
    trackingCode: typeof value.trackingCode === "string" ? value.trackingCode : "",
    truthClaims,
  };
}

function formatDuration(durationMs: number | null) {
  return durationMs ? `${(durationMs / 1000).toFixed(1)}s` : null;
}

function RevisionControl({
  story,
  disabled,
  request,
  onRefresh,
}: {
  story: Story;
  disabled: boolean;
  request: (action: string, payload: Record<string, unknown>) => Promise<unknown>;
  onRefresh: () => Promise<void>;
}) {
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function submit() {
    setBusy(true);
    setNotice("");
    try {
      await request("revision", { storyId: story.id, feedback });
      setFeedback("");
      setNotice("Revision queued");
      await onRefresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not request a revision");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.revisionControl}>
      <div>
        <p className={styles.eyebrow}>Feedback loop</p>
        <strong>Feedback for this video</strong>
        {story.feedback[0] ? <small>Latest: {story.feedback[0].feedback}</small> : null}
      </div>
      <label>
        Revision note
        <textarea
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="Example: show more roses in the background and shorten the opening."
          rows={3}
          disabled={disabled || busy}
        />
      </label>
      <button type="button" onClick={() => void submit()} disabled={disabled || busy || feedback.trim().length < 2}>
        Save feedback for the next run
      </button>
      {notice ? <span className={styles.notice} role="status">{notice}</span> : null}
    </div>
  );
}

function DailyFeedbackControl({
  feedback,
  disabled,
  request,
  onRefresh,
}: {
  feedback: Revision[];
  disabled: boolean;
  request: (action: string, payload: Record<string, unknown>) => Promise<unknown>;
  onRefresh: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function submit() {
    setBusy(true);
    setNotice("");
    try {
      await request("revision", { feedback: note });
      setNote("");
      setNotice("Daily feedback saved for the next scheduled creation run");
      await onRefresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save daily feedback");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.dailyFeedback}>
      <div>
        <p className={styles.eyebrow}>Daily feedback</p>
        <h2>Notes for all three videos</h2>
        <p>The next 6 a.m. Codex task reads queued notes before choosing scenes, narration, and platform copy.</p>
        {feedback[0] ? <small>Latest: {feedback[0].feedback}</small> : null}
      </div>
      <label>
        General direction
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Example: keep the calm voice, use denser backgrounds, and make tomorrow's hooks more direct." disabled={disabled || busy} />
      </label>
      <button type="button" onClick={() => void submit()} disabled={disabled || busy || note.trim().length < 2}>Save daily feedback</button>
      {notice ? <span className={styles.notice} role="status">{notice}</span> : null}
    </section>
  );
}

function VariantEditor({
  variant,
  disabled,
  onRefresh,
  request,
}: {
  variant: Variant;
  disabled: boolean;
  onRefresh: () => Promise<void>;
  request: (action: string, payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const [headline, setHeadline] = useState(variant.headline);
  const [body, setBody] = useState(variant.body);
  const [hashtags, setHashtags] = useState(variant.hashtags.join(" "));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function save() {
    setBusy(true);
    setNotice("");
    try {
      await request("save", {
        variantId: variant.id,
        headline,
        body,
        hashtags: hashtags.split(/[\s,]+/).map((tag) => tag.replace(/^#/, "")).filter(Boolean),
      });
      setNotice("Saved");
      await onRefresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "approve" | "reject" | "draft" | "published") {
    if (decision === "approve" && !window.confirm(`Approve this ${CHANNEL_LABELS[variant.channel]} for manual posting?`)) return;
    let publishedUrl = "";
    if (decision === "published") {
      publishedUrl = window.prompt("Optional: paste the live post URL so Basil can measure it later.", variant.publishedUrl ?? "") ?? "";
    }
    setBusy(true);
    setNotice("");
    try {
      if (decision === "approve") {
        await request("save", {
          variantId: variant.id,
          headline,
          body,
          hashtags: hashtags.split(/[\s,]+/).map((tag) => tag.replace(/^#/, "")).filter(Boolean),
        });
      }
      await request("decision", { variantId: variant.id, decision, publishedUrl });
      setNotice(decision === "approve" ? "Ready to post" : decision === "published" ? "Marked published" : "Updated");
      await onRefresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`${styles.variant} ${styles[`status_${variant.status}`] ?? ""}`}>
      <div className={styles.variantHeader}>
        <div>
          <span className={styles.channel}>{CHANNEL_LABELS[variant.channel]}</span>
          <span className={styles.status}>{variant.status.replaceAll("_", " ")}</span>
        </div>
      </div>
      <label>
        Headline
        <input value={headline} onChange={(event) => setHeadline(event.target.value)} disabled={disabled || variant.status === "published"} />
      </label>
      <label>
        Copy
        <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={variant.channel === "reddit" ? 10 : 6} disabled={disabled || variant.status === "published"} />
      </label>
      <label>
        Hashtags
        <input value={hashtags} onChange={(event) => setHashtags(event.target.value)} placeholder="BasilCommunityGarden CozyGames" disabled={disabled || variant.status === "published"} />
      </label>
      <div className={styles.variantActions}>
        {variant.status !== "published" ? <button type="button" onClick={() => void save()} disabled={disabled || busy}>Save</button> : null}
        {variant.status === "draft" || variant.status === "failed" ? <button className={styles.primaryAction} type="button" onClick={() => void decide("approve")} disabled={disabled || busy}>Approve</button> : null}
        {variant.status === "manual_ready" ? <button className={styles.publishAction} type="button" onClick={() => void decide("published")} disabled={disabled || busy}>Mark posted</button> : null}
        {variant.status === "manual_ready" || variant.status === "rejected" ? <button type="button" onClick={() => void decide("draft")} disabled={disabled || busy}>Return to draft</button> : null}
        {variant.status !== "rejected" && variant.status !== "published" ? <button className={styles.rejectAction} type="button" onClick={() => void decide("reject")} disabled={disabled || busy}>Skip</button> : null}
        {variant.publishedUrl ? <a href={variant.publishedUrl} target="_blank" rel="noreferrer">View live post</a> : null}
        {notice ? <span className={styles.notice} role="status">{notice}</span> : null}
      </div>
    </article>
  );
}

export function SocialStudio() {
  const digestIdRef = useRef("");
  const tokenRef = useRef("");
  const [digest, setDigest] = useState<Digest | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalNotice, setApprovalNotice] = useState("");

  async function request(action: string, payload: Record<string, unknown> = {}) {
    const response = await fetch(`/api/community-garden/social-studio${action === "review" ? "" : `?action=${action}`}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ digestId: digestIdRef.current, token: tokenRef.current, ...payload }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "The Social Studio request failed.");
    return result;
  }

  async function load() {
    const result = await request("review") as Digest;
    setDigest(result);
    setState("ready");
  }

  async function approveAll() {
    if (!window.confirm("Approve all three validated videos and their saved Instagram, YouTube, and Reddit posts for the 8 a.m. publishing task?")) return;
    setApprovalBusy(true);
    setApprovalNotice("");
    try {
      const result = await request("approve-all") as { approved: number; readyVideos: number; reason?: string };
      setApprovalNotice(result.reason === "videos_not_ready"
        ? `${result.readyVideos} of 3 videos are validated; all three must be ready before approval`
        : `${result.approved} posts across 3 videos are ready for the scheduled publishing task`);
      await load();
    } catch (error) {
      setApprovalNotice(error instanceof Error ? error.message : "Could not approve the package");
    } finally {
      setApprovalBusy(false);
    }
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    if (process.env.NODE_ENV !== "production" && url.searchParams.get("demo") === "1") {
      window.history.replaceState({}, "", window.location.pathname);
      queueMicrotask(() => {
        setDigest(DEVELOPMENT_PREVIEW);
        setState("ready");
      });
      return;
    }
    const digestId = url.searchParams.get("digest") ?? "";
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const token = fragment.get("token") ?? "";
    window.history.replaceState({}, "", `${window.location.pathname}?digest=${encodeURIComponent(digestId)}`);
    digestIdRef.current = digestId;
    tokenRef.current = token;
    if (!digestId || !token) {
      queueMicrotask(() => {
        setState("error");
        setMessage("This private Social Studio link is incomplete. Open the newest link sent to the review email.");
      });
      return;
    }
    void fetch("/api/community-garden/social-studio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ digestId, token }),
    }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The Social Studio could not be loaded.");
      setDigest(result as Digest);
      setState("ready");
    }).catch((error) => {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The Social Studio could not be loaded.");
    });
  }, []);

  return (
    <main className={styles.studio}>
      <header className={styles.hero}>
        <div className={styles.brandMark} aria-hidden="true"><span /><span /><span /></div>
        <div>
          <p className={styles.eyebrow}>Private creator workspace</p>
          <h1>Basil Social Studio</h1>
          <p className={styles.heroDescription}>Vertical stories first. Real garden footage when possible. Every channel waits for your approval.</p>
          <p className={styles.safetyNote}>Opening the Studio never publishes a post.</p>
        </div>
      </header>

      {state === "loading" ? <section className={styles.systemMessage}>Preparing today&apos;s story packets...</section> : null}
      {state === "error" ? <section className={`${styles.systemMessage} ${styles.error}`} role="alert">{message}</section> : null}

      {digest ? (
        <>
          <section className={styles.runBar}>
            <div><span>Daily run</span><strong>{prettyDate(digest.createdAt)}</strong></div>
            <div><span>Stories</span><strong>{digest.stories.length}</strong></div>
            <div><span>Review</span><strong>{digest.expired ? "Expired" : digest.status.replaceAll("_", " ")}</strong></div>
            <div><span>Sent to</span><strong>{digest.reviewers.join(", ")}</strong></div>
          </section>

          <section className={styles.deliveryGuide}>
            <div>
              <p className={styles.eyebrow}>What is ready today</p>
              <strong>{digest.stories.filter((story) => story.assetKind === "video").length} of 3 finished videos</strong>
              <span>Each video has Instagram, YouTube, and Reddit copy.</span>
              <div className={styles.packageActions}>
                <button type="button" onClick={() => void approveAll()} disabled={digest.expired || approvalBusy || digest.stories.filter((story) => story.assetKind === "video").length !== 3}>Approve 3 videos · 9 posts</button>
                {approvalNotice ? <span role="status">{approvalNotice}</span> : null}
              </div>
            </div>
            <p><b>Approve 3 videos · 9 posts</b> queues the three validated videos for Instagram, YouTube, and Reddit. The 8 a.m. Codex task still checks this stored approval before preparing any post. Opening or watching never publishes anything.</p>
          </section>

          <section className={styles.connections}>
            <div>
              <p className={styles.eyebrow}>Publishing desk</p>
              <h2>Scheduled through the Codex desktop</h2>
              <p>Instagram, YouTube, and Reddit use the signed-in desktop sessions after Studio approval. Email delivers the private review package.</p>
            </div>
            <div className={styles.connectorGrid}>
              {Object.entries(digest.connectors).map(([name, connector]) => (
                <div className={styles.connector} key={name}>
                  <span className={`${styles.dot} ${connector.mode.startsWith("connected") ? styles.connected : ""}`} />
                  <div><strong>{name}</strong><small>{connector.label}</small></div>
                </div>
              ))}
            </div>
          </section>

          <div className={styles.storyList}>
            {digest.stories.map((story, storyIndex) => {
              const reelPlan = parseReelPlan(story.evidence);
              const productionBrief = parseProductionBrief(story.evidence);
              return (
                <section className={styles.story} key={story.id}>
                  <div className={styles.storyLead}>
                    <div className={styles.storyCopy}>
                      <p className={styles.eyebrow}>Story {storyIndex + 1} / {story.sourceType.replaceAll("_", " ")}</p>
                      <h2>{story.title}</h2>
                      <p className={styles.summary}>{story.summary}</p>
                      <div className={styles.whyToday}><span>Why today</span>{story.whyToday}</div>
                      {story.sourceRef ? <a className={styles.sourceLink} href={story.sourceRef} target="_blank" rel="noreferrer">View supporting repository change</a> : null}
                      {productionBrief ? (
                        <div className={styles.productionBrief}>
                          <p className={styles.eyebrow}>Production manifest</p>
                          <div className={styles.productionFacts}>
                            <div><small>Objective</small><strong>{productionBrief.objective.replaceAll("_", " ")}</strong></div>
                            <div><small>Format</small><strong>{productionBrief.format.replaceAll("_", " ")}</strong></div>
                            <div><small>Scene</small><strong>{productionBrief.scene.replaceAll("-", " ")}</strong></div>
                            <div><small>Delivery</small><strong>{productionBrief.distribution}</strong></div>
                          </div>
                          <div className={styles.productionNarrative}>
                            <div><small>Audience</small><p>{productionBrief.intendedAudience}</p></div>
                            <div><small>Creative hypothesis</small><p>{productionBrief.hypothesis}</p></div>
                          </div>
                          {productionBrief.alternateHooks.length ? (
                            <div className={styles.hookList}><small>Alternative openings</small><ol>{productionBrief.alternateHooks.map((hook) => <li key={hook}>{hook}</li>)}</ol></div>
                          ) : null}
                          {productionBrief.truthClaims.length ? (
                            <div className={styles.truthChecks}>
                              <small>Truth checks</small>
                              {productionBrief.truthClaims.map((claim) => (
                                <div key={claim.claim} data-supported={claim.supported}>
                                  <strong>{claim.supported ? "Supported" : "Hold"}</strong>
                                  <span>{claim.claim}</span>
                                  <em>{claim.basis}</em>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {productionBrief.trackingCode ? <small className={styles.trackingNote}>Platform tracking is included automatically.</small> : null}
                        </div>
                      ) : null}
                    </div>
                    <div className={styles.visualColumn}>
                      <div className={styles.assetStatus}>
                        <span>{story.assetKind === "video" ? "Ready video" : "Ready image"}</span>
                        <p>{story.assetKind === "video"
                          ? "This is a finished video file you can download and upload."
                          : "This is the actual downloadable post image. The Reel section below is a production plan, not a finished video."}</p>
                      </div>
                      <div className={styles.verticalPreview}>
                        {story.assetKind === "video" ? (
                          <video src={story.assetUrl} poster={story.posterUrl ?? undefined} controls playsInline preload="metadata" />
                        ) : (
                          // The original static file avoids an image-optimizer rendering failure seen in the private Studio.
                          <img src={story.assetUrl} alt={`Actual Basil gameplay for ${story.title}`} width={591} height={1280} loading="eager" />
                        )}
                        <span>{story.assetKind === "video" ? "Ready video" : "Ready image · actual gameplay"}</span>
                      </div>
                      {story.assets.find((asset) => asset.kind === "video") ? (
                        <div className={styles.assetMetadata}>
                          <span>{story.assets.find((asset) => asset.kind === "video")?.width}×{story.assets.find((asset) => asset.kind === "video")?.height}</span>
                          <span>{formatDuration(story.assets.find((asset) => asset.kind === "video")?.durationMs ?? null)}</span>
                          <span>Validated</span>
                        </div>
                      ) : null}
                      <div className={styles.assetActions}>
                        <a className={styles.primaryMediaAction} href={story.assetUrl} download>Download {story.assetKind}</a>
                        <a href={story.assetUrl} target="_blank" rel="noreferrer">Open full size</a>
                      </div>
                    </div>
                  </div>

                  {reelPlan && story.assetKind !== "video" ? (
                    <div className={styles.reelBrief}>
                      <div className={styles.reelHeading}>
                        <span>Reel production brief</span>
                        <strong>{reelPlan.targetSeconds}s target</strong>
                      </div>
                      <div className={styles.reelGrid}>
                        <div><small>Hook</small><p>{reelPlan.hook}</p></div>
                        <div><small>Screen-record sequence</small><ol>{reelPlan.shots.map((shot) => <li key={shot}>{shot}</li>)}</ol></div>
                        <div><small>Payoff</small><p>{reelPlan.payoff}</p></div>
                        <div><small>Diagram fallback</small><p>{reelPlan.fallbackVisual}</p></div>
                      </div>
                    </div>
                  ) : null}

                  <RevisionControl
                    story={story}
                    disabled={digest.expired}
                    request={request}
                    onRefresh={load}
                  />

                  <div className={styles.variants}>
                    {CHANNEL_ORDER.map((channel) => story.variants.find((variant) => variant.channel === channel)).filter((variant): variant is Variant => Boolean(variant)).map((variant) => (
                      <VariantEditor
                        key={variant.id}
                        variant={variant}
                        disabled={digest.expired}
                        request={request}
                        onRefresh={load}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <DailyFeedbackControl feedback={digest.feedback} disabled={digest.expired} request={request} onRefresh={load} />
        </>
      ) : null}
    </main>
  );
}
