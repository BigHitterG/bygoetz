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
  stories: Story[];
};

const CHANNEL_ORDER: Channel[] = ["instagram", "youtube", "tiktok", "reddit"];
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
    github: { mode: "connected", label: "BigHitterG/bygoetz" },
    openai: { mode: "optional", label: "Template drafts" },
    instagram: { mode: "manual", label: "Post manually" },
    youtube: { mode: "manual", label: "Upload manually" },
    tiktok: { mode: "manual", label: "Post manually" },
    reddit: { mode: "manual", label: "Copy and post manually" },
  },
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

function VariantEditor({
  variant,
  assetUrl,
  assetKind,
  disabled,
  onRefresh,
  request,
}: {
  variant: Variant;
  assetUrl: string;
  assetKind: "image" | "video";
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

  async function copyPost() {
    const tagLine = hashtags
      .split(/[\s,]+/)
      .map((tag) => tag.replace(/^#/, "").trim())
      .filter(Boolean)
      .map((tag) => `#${tag}`)
      .join(" ");
    await navigator.clipboard.writeText([headline, body, tagLine].filter(Boolean).join("\n\n"));
    setNotice("Copied");
  }

  return (
    <article className={`${styles.variant} ${styles[`status_${variant.status}`] ?? ""}`}>
      <div className={styles.variantHeader}>
        <div>
          <span className={styles.channel}>{CHANNEL_LABELS[variant.channel]}</span>
          <span className={styles.status}>{variant.status.replaceAll("_", " ")}</span>
        </div>
        <div className={styles.variantTopActions}>
          <button className={styles.copyButton} type="button" onClick={() => void copyPost()}>Copy text</button>
          <a className={styles.mediaButton} href={assetUrl} download>
            Download {assetKind}
          </a>
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
              <strong>{new Set(digest.stories.filter((story) => story.assetKind === "image").map((story) => story.assetUrl)).size} unique downloadable image files</strong>
              <span>{digest.stories.filter((story) => story.assetKind === "video").length} finished videos</span>
            </div>
            <p><b>Copy text</b> copies the caption. <b>Download image</b> gives you the file to upload. A Reel production brief is a shot list for a future video—it is not a finished video unless the asset is explicitly labeled “Ready video.”</p>
          </section>

          <section className={styles.connections}>
            <div>
              <p className={styles.eyebrow}>Publishing desk</p>
              <h2>Connected where it matters now</h2>
              <p>Manual channels stay copy-ready. Adding credentials later turns on OAuth setup without changing the content queue.</p>
            </div>
            <div className={styles.connectorGrid}>
              {Object.entries(digest.connectors).map(([name, connector]) => (
                <div className={styles.connector} key={name}>
                  <span className={`${styles.dot} ${connector.mode === "connected" ? styles.connected : ""}`} />
                  <div><strong>{name}</strong><small>{connector.label}</small></div>
                </div>
              ))}
            </div>
          </section>

          <div className={styles.storyList}>
            {digest.stories.map((story, storyIndex) => {
              const reelPlan = parseReelPlan(story.evidence);
              return (
                <section className={styles.story} key={story.id}>
                  <div className={styles.storyLead}>
                    <div className={styles.storyCopy}>
                      <p className={styles.eyebrow}>Story {storyIndex + 1} / {story.sourceType.replaceAll("_", " ")}</p>
                      <h2>{story.title}</h2>
                      <p className={styles.summary}>{story.summary}</p>
                      <div className={styles.whyToday}><span>Why today</span>{story.whyToday}</div>
                      {story.sourceRef ? <a className={styles.sourceLink} href={story.sourceRef} target="_blank" rel="noreferrer">View supporting repository change</a> : null}
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
                          <video src={story.assetUrl} controls playsInline />
                        ) : (
                          // The original static file avoids an image-optimizer rendering failure seen in the private Studio.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={story.assetUrl} alt={`Actual Basil gameplay for ${story.title}`} width={591} height={1280} loading="eager" />
                        )}
                        <span>{story.assetKind === "video" ? "Ready video" : "Ready image · actual gameplay"}</span>
                      </div>
                      <div className={styles.assetActions}>
                        <a className={styles.primaryMediaAction} href={story.assetUrl} download>Download {story.assetKind}</a>
                        <a href={story.assetUrl} target="_blank" rel="noreferrer">Open full size</a>
                      </div>
                    </div>
                  </div>

                  {reelPlan ? (
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

                  <div className={styles.variants}>
                    {CHANNEL_ORDER.map((channel) => story.variants.find((variant) => variant.channel === channel)).filter((variant): variant is Variant => Boolean(variant)).map((variant) => (
                      <VariantEditor
                        key={variant.id}
                        variant={variant}
                        assetUrl={story.assetUrl}
                        assetKind={story.assetKind}
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
        </>
      ) : null}
    </main>
  );
}
