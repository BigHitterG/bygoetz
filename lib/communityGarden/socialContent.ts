export const SOCIAL_CHANNELS = ["reddit", "youtube", "instagram", "tiktok"] as const;

export type SocialChannel = (typeof SOCIAL_CHANNELS)[number];

export type SocialStats = {
  measuredAt: string;
  communityFlowers: number;
  roses: number;
  sunflowers: number;
  lavender: number;
  weeds: number;
  gardenMembers: number;
  personalGardenFlowers: number;
  livingGardenDiscoveries: number;
  careSharedThisMonth: number;
};

export type RepositoryChange = {
  sha: string;
  title: string;
  url: string;
  committedAt: string;
};

export type DraftVariant = {
  channel: SocialChannel;
  headline: string;
  body: string;
  hashtags: string[];
};

export type DraftStory = {
  key: string;
  sourceType: "repository" | "garden_stats" | "evergreen" | "manual";
  sourceRef: string | null;
  title: string;
  summary: string;
  whyToday: string;
  assetUrl: string;
  assetKind: "image" | "video";
  reelPlan: {
    hook: string;
    shots: string[];
    payoff: string;
    targetSeconds: number;
    fallbackVisual: string;
  };
  creativeBrief: {
    family: "transformation-timelapse" | "narrated-gameplay" | "companion-post";
    captureRecipe: string;
    objective: "first_plant" | "product_understanding" | "community_conversation";
    videoFormat: "garden_transformation" | "narrated_gameplay" | "companion_post";
    scene: string;
    intendedAudience: string;
    distribution: "organic" | "paid";
    hypothesis: string;
    alternateHooks: string[];
    destinationUrl: string;
    trackingCode: string;
    truthClaims: Array<{ claim: string; supported: boolean; basis: string }>;
    narrationDirection: string | null;
    requiredChecks: string[];
  };
  evidence: Record<string, unknown>;
  variants: DraftVariant[];
};

type StoryCard = Omit<DraftStory, "sourceType" | "sourceRef" | "evidence" | "creativeBrief"> & {
  keywords: string[];
  fact: string;
};

const GAMEPLAY_ROSES = "/community-garden/social-captures/rose-garden-gameplay.jpg";
const GAMEPLAY_LAVENDER = "/community-garden/social-captures/planting-lavender-gameplay.jpg";

const STORY_LIBRARY: StoryCard[] = [
  {
    key: "living-garden",
    title: "The garden is becoming a habitat",
    summary: "Introduce the Living Garden as a system where the shape and care of a member's garden can attract discoverable wildlife.",
    whyToday: "The Living Garden creates several durable stories, beginning with the idea that planting choices can make a place feel alive.",
    assetUrl: GAMEPLAY_ROSES,
    assetKind: "image",
    reelPlan: {
      hook: "Your flowers can turn into a wildlife habitat.",
      shots: ["Open on a 9:16 crop of Mary entering My Garden.", "Move through the established flower habitat.", "Reveal a wildlife discovery, then open its Field Guide entry."],
      payoff: "End on the visitor beside the garden with: What should arrive next?",
      targetSeconds: 18,
      fallbackVisual: "A labeled Basil-style habitat diagram using actual flower sprites and a clearly marked visitor path.",
    },
    keywords: ["living garden", "habitat", "visitor", "wildlife", "goldfinch", "creature"],
    fact: "The Living Garden lets Garden Members discover wildlife visitors as their personal gardens develop into habitats.",
    variants: [
      {
        channel: "reddit",
        headline: "The Living Garden: your flowers are becoming a habitat",
        body: "Basil's garden is beginning to notice what you grow. The Living Garden looks at the shape of a member's personal garden and turns certain arrangements into habitats that can attract wildlife visitors. A discovery belongs to the garden that made room for it, and it becomes part of that member's Field Guide.\n\nThis is meant to make planting feel like more than decorating a grid: the garden you create can become a place another living thing chooses to visit.\n\nWhat kind of visitor would you hope to find in your garden?",
        hashtags: [],
      },
      {
        channel: "youtube",
        headline: "Your Basil garden can attract wildlife",
        body: "Mary walks through a growing personal garden. As flowers form a habitat, a new visitor can appear and join the Field Guide. This is the Living Garden.\n\nPlay Basil Community Garden: basilcommunitygarden.com",
        hashtags: ["BasilCommunityGarden", "CozyGames", "IndieGame"],
      },
      {
        channel: "instagram",
        headline: "A garden can become a habitat",
        body: "The flowers you place in Basil can do more than fill a plot. As your garden grows, it can form habitats and welcome new wildlife discoveries into your Field Guide.",
        hashtags: ["BasilCommunityGarden", "CozyGaming", "PixelGarden", "IndieGame"],
      },
      {
        channel: "tiktok",
        headline: "POV: your pixel garden attracts its first visitor",
        body: "Plant a habitat, meet its visitor, and add the discovery to your Field Guide.",
        hashtags: ["cozygames", "indiegames", "pixelart", "gardengame"],
      },
    ],
  },
  {
    key: "goldfinch-field-guide",
    title: "Meet the goldfinch",
    summary: "Focus on one Living Garden visitor and explain that discoveries are recorded in the member's Field Guide.",
    whyToday: "A single creature gives the larger Living Garden system a concrete, memorable face.",
    assetUrl: GAMEPLAY_ROSES,
    assetKind: "image",
    reelPlan: {
      hook: "A goldfinch found Mary's garden.",
      shots: ["Begin on the goldfinch discovery moment.", "Let Mary approach without covering the visitor.", "Cut to the new goldfinch Field Guide artwork."],
      payoff: "Hold on the guide entry and ask viewers what Mary should discover next.",
      targetSeconds: 14,
      fallbackVisual: "A field-note diagram pairing the actual garden capture with labeled goldfinch discovery artwork.",
    },
    keywords: ["goldfinch", "field guide", "living garden", "visitor", "unique artwork"],
    fact: "The goldfinch is a discoverable Living Garden visitor, and acknowledged discoveries appear in the member's Field Guide.",
    variants: [
      {
        channel: "reddit",
        headline: "A goldfinch can find its way into your Living Garden",
        body: "One of the first ideas behind Basil's Living Garden is that a garden should eventually feel noticed. The goldfinch is a discoverable visitor: create the right kind of habitat, encounter it in your garden, and its entry becomes part of your Field Guide.\n\nI like the thought that two gardens can contain the same flowers and still tell different stories depending on how their members arrange and care for them.\n\nShould the Field Guide tell you exactly how to attract a visitor, or leave part of it mysterious?",
        hashtags: [],
      },
      {
        channel: "youtube",
        headline: "A goldfinch found Mary's garden",
        body: "A small Living Garden discovery: Mary finds a goldfinch, then records it in her Field Guide.\n\nWhat should visit the garden next?",
        hashtags: ["BasilCommunityGarden", "Goldfinch", "CozyGames"],
      },
      {
        channel: "instagram",
        headline: "A new page in the Field Guide",
        body: "A goldfinch has found the Living Garden. Wildlife discoveries belong to the member whose flowers created the habitat.",
        hashtags: ["BasilCommunityGarden", "Goldfinch", "PixelArt", "CozyGame"],
      },
      {
        channel: "tiktok",
        headline: "Mary just found a goldfinch",
        body: "The Living Garden remembers the visitors your habitat attracts.",
        hashtags: ["cozygaming", "goldfinch", "pixelgame", "indiedev"],
      },
    ],
  },
  {
    key: "watering-spread",
    title: "Water is becoming a spreading gesture",
    summary: "Explain the double-tap watering mechanic and its goal of feeling less like selecting isolated tiles and more like a spread of water.",
    whyToday: "Watering is a small repeatable action, so clearly explaining its rhythm can immediately improve how the garden feels to play.",
    assetUrl: GAMEPLAY_ROSES,
    assetKind: "image",
    reelPlan: {
      hook: "Water three flowers in two taps.",
      shots: ["Show the selected droplet outside Mary's immediate reach.", "Pause on the three highlighted adjacent flowers.", "Second tap: show the water spread and Care receipt."],
      payoff: "Replay the spread once at full speed with: choose, spread, care.",
      targetSeconds: 12,
      fallbackVisual: "A three-frame Basil diagram: selected droplet, highlighted cluster, completed watering spread.",
    },
    keywords: ["water", "watering", "spray", "droplet", "care", "cluster"],
    fact: "A player selects a water droplet beyond Mary's immediate reach; the game highlights three adjacent flowers, and the second tap waters that group and awards Care.",
    variants: [
      {
        channel: "reddit",
        headline: "How watering works in Basil: select the droplet, then follow the spread",
        body: "The goal of Basil's watering mechanic is to move closer to the feeling of water spreading through a patch of flowers.\n\nFirst, choose a water droplet outside Mary's immediate reach. Basil finds three adjacent flowers near that point and highlights them. Tap again to send the water across those three flowers. Once the watering lands, you receive the Care from that action.\n\nThe two-tap rhythm is intentional: choose where the water begins, then confirm the little spread it creates. The next group can then appear, letting watering move through the garden in short, readable steps.\n\nDoes that feel more natural than watering one flower at a time?",
        hashtags: [],
      },
      {
        channel: "youtube",
        headline: "How Basil's two-tap watering works",
        body: "1. Select a water droplet beyond Mary's reach.\n2. Basil highlights three nearby flowers.\n3. Tap again to water the group and collect Care.\n\nThe long-term goal is to make watering feel like a spread, not a checklist.",
        hashtags: ["BasilCommunityGarden", "GameMechanics", "CozyGames"],
      },
      {
        channel: "instagram",
        headline: "Choose the droplet. Follow the spread.",
        body: "Basil's watering mechanic uses a simple two-tap rhythm: select where the water begins, then water the three nearby flowers the garden highlights.",
        hashtags: ["BasilCommunityGarden", "CozyGaming", "GameDesign", "PixelGarden"],
      },
      {
        channel: "tiktok",
        headline: "Water three flowers in two taps",
        body: "Pick the droplet, follow the highlighted spread, and collect your Care.",
        hashtags: ["gamemechanics", "cozygame", "pixelart", "indiegames"],
      },
    ],
  },
  {
    key: "heritage-flower",
    title: "Every Garden Member begins with one Heritage Flower",
    summary: "Explain that Heritage Flowers belong to Garden Members, remain in the shared garden, and grow through lifespan tiers.",
    whyToday: "The Heritage Flower is the clearest symbol of membership and of leaving a lasting place in the shared garden.",
    assetUrl: GAMEPLAY_ROSES,
    assetKind: "image",
    reelPlan: {
      hook: "Every Garden Member gets one flower that stays.",
      shots: ["Open on the Heritage Flower award.", "Show Mary choosing a permanent place in the shared garden.", "Plant it, then briefly show its lifespan tiers."],
      payoff: "End on the planted flower with: Become part of the garden.",
      targetSeconds: 19,
      fallbackVisual: "A vertical lifespan diagram built in Basil's pixel-and-paper aesthetic, labeled as an explainer rather than gameplay.",
    },
    keywords: ["heritage", "member", "membership", "lifespan", "seed", "legacy"],
    fact: "Every new Garden Member receives one Heritage Flower; temporary tutorial visitors do not. Heritage Flowers remain in the garden and advance through lifespan tiers.",
    variants: [
      {
        channel: "reddit",
        headline: "Every new Garden Member receives one Heritage Flower",
        body: "A Heritage Flower is a Garden Member's lasting place in Basil. Every new member receives one—not every temporary tutorial visitor—and can plant it in the shared garden.\n\nUnlike an ordinary flower, a Heritage Flower remains as part of the garden's history. Its lifespan is expressed through tiers, so the flower can change as the member continues to care for the garden over time. It is both a marker of when someone joined and a living record of their participation.\n\nAs members grow, their Heritage Flowers grow. As those flowers gather, the garden itself becomes a record of the community that made it.",
        hashtags: [],
      },
      {
        channel: "youtube",
        headline: "Plant your one Heritage Flower",
        body: "Every new Garden Member receives one Heritage Flower. Plant it in the shared garden, care for it through its lifespan tiers, and leave a lasting part of the garden's history.",
        hashtags: ["BasilCommunityGarden", "CozyGames", "CommunityGarden"],
      },
      {
        channel: "instagram",
        headline: "Become part of the garden",
        body: "Every new Garden Member receives one Heritage Flower: a lasting flower that can grow through lifespan tiers as its member grows with the garden.",
        hashtags: ["BasilCommunityGarden", "HeritageFlower", "CozyGaming", "CommunityArt"],
      },
      {
        channel: "tiktok",
        headline: "The one flower that stays",
        body: "Every Garden Member gets one Heritage Flower to plant into Basil's shared history.",
        hashtags: ["cozygames", "communitygarden", "pixelart", "indiedev"],
      },
    ],
  },
  {
    key: "footprint-adventures",
    title: "Grow your planting footprint through small adventures",
    summary: "Present footprint increases as short accolade-focused tasks that diversify play around the community map.",
    whyToday: "Short watering, planting, and weed-clearing goals give members a reason to explore without turning Basil into a long-session grind.",
    assetUrl: GAMEPLAY_LAVENDER,
    assetKind: "image",
    reelPlan: {
      hook: "What can you finish in the garden in twenty minutes?",
      shots: ["Show a short weed-clearing task.", "Cut to a watering accolade.", "Reveal the member's planting footprint expanding on the community map."],
      payoff: "Finish with three task cards and invite viewers to choose the first adventure.",
      targetSeconds: 22,
      fallbackVisual: "A vertical map-and-awards diagram showing task, accolade, and footprint increase as three clear steps.",
    },
    keywords: ["footprint", "award", "accolade", "weed", "task", "adventure", "unlock", "parcel"],
    fact: "Basil's footprint progression is intended to reward short map activities such as watering, planting, and weed clearing with additional community planting space.",
    variants: [
      {
        channel: "reddit",
        headline: "A planting footprint that grows through small garden adventures",
        body: "One direction for Basil's community map is a separate, accolade-focused progression track built around things you can finish in roughly twenty minutes. Clear a pocket of weeds, complete a watering route, plant a particular arrangement, or discover something off the usual path.\n\nCompleting these small adventures would earn awards and gradually increase the space where a member can plant in the community garden. The point is not one endless grind. It is a collection of compact reasons to move around the map, try another mechanic, and leave with a visible accomplishment.\n\nWhat is the first twenty-minute garden task you would want to take on?",
        hashtags: [],
      },
      {
        channel: "youtube",
        headline: "Small garden adventures, a larger planting footprint",
        body: "Water a route. Clear a weed pocket. Finish a planting challenge. Basil's map accolades are designed as short adventures that can grow a member's community planting footprint.",
        hashtags: ["BasilCommunityGarden", "CozyGames", "GameProgression"],
      },
      {
        channel: "instagram",
        headline: "Twenty minutes. One garden accolade.",
        body: "Short adventures around Basil's map can diversify how members play—and gradually open more room for them to plant in the community garden.",
        hashtags: ["BasilCommunityGarden", "CozyGaming", "GardenAdventure", "IndieGame"],
      },
      {
        channel: "tiktok",
        headline: "A 20-minute garden quest",
        body: "Complete a small map accolade and grow your community planting footprint.",
        hashtags: ["cozygame", "questdesign", "pixelgame", "indiegames"],
      },
    ],
  },
  {
    key: "planting-unlocks",
    title: "Unlocking a new flower changes what you can build",
    summary: "Use the tulip or another catalog unlock to show how progression broadens the visual language of a member's garden.",
    whyToday: "Unlock moments make strong short videos because the action, reward, and visible result fit into a few seconds.",
    assetUrl: GAMEPLAY_LAVENDER,
    assetKind: "image",
    reelPlan: {
      hook: "Mary just unlocked a new flower.",
      shots: ["Show the catalog unlock celebration.", "Walk Mary to an open garden tile.", "Plant the newly unlocked flower immediately."],
      payoff: "End on the first planted flower and a quick before-and-after garden crop.",
      targetSeconds: 13,
      fallbackVisual: "A Basil catalog-to-garden diagram using the actual unlock icon and gameplay screenshot.",
    },
    keywords: ["unlock", "tulip", "catalog", "planting", "collection", "reward"],
    fact: "Basil has a progressive personal-garden catalog in which additional plants and placeable elements become available as members advance.",
    variants: [
      {
        channel: "reddit",
        headline: "What should unlocking a new flower feel like?",
        body: "A new flower in Basil is not meant to be only another icon in a catalog. Unlocking something like a tulip changes the arrangements, habitats, and visual stories a member can create in My Garden.\n\nThe ideal unlock is small but tangible: Mary reaches the moment, the flower joins the catalog, and the player can immediately walk over and plant the first one. That gives a short progression beat an actual place in the garden.\n\nWould you rather know the requirements for every flower in advance, or discover some of them unexpectedly?",
        hashtags: [],
      },
      {
        channel: "youtube",
        headline: "Mary unlocks a new flower",
        body: "A new flower joins the catalog, then Mary plants the first one. Small unlocks create new arrangements—and eventually new Living Garden habitats.",
        hashtags: ["BasilCommunityGarden", "CozyGames", "GameUnlock"],
      },
      {
        channel: "instagram",
        headline: "One unlock, a new kind of garden",
        body: "Each flower added to the Basil catalog gives members another shape, color, and possible habitat to build with.",
        hashtags: ["BasilCommunityGarden", "PixelFlowers", "CozyGaming", "IndieGame"],
      },
      {
        channel: "tiktok",
        headline: "Mary unlocked a new flower",
        body: "The best part is planting the first one immediately.",
        hashtags: ["cozygames", "gameunlock", "pixelart", "gardengame"],
      },
    ],
  },
];

function safeCount(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

export function parseSocialStats(value: unknown): SocialStats {
  const stats = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    measuredAt: typeof stats.measuredAt === "string" ? stats.measuredAt : new Date().toISOString(),
    communityFlowers: safeCount(stats.communityFlowers),
    roses: safeCount(stats.roses),
    sunflowers: safeCount(stats.sunflowers),
    lavender: safeCount(stats.lavender),
    weeds: safeCount(stats.weeds),
    gardenMembers: safeCount(stats.gardenMembers),
    personalGardenFlowers: safeCount(stats.personalGardenFlowers),
    livingGardenDiscoveries: safeCount(stats.livingGardenDiscoveries),
    careSharedThisMonth: safeCount(stats.careSharedThisMonth),
  };
}

function chicagoDayNumber(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = `${parts.find((part) => part.type === "year")?.value ?? "2026"}${parts.find((part) => part.type === "month")?.value ?? "01"}${parts.find((part) => part.type === "day")?.value ?? "01"}`;
  return Number(value);
}

export function buildDailyStoryDrafts(
  date: Date,
  changes: RepositoryChange[],
  stats: SocialStats,
  count = 3,
) {
  const changeText = changes.map((change) => change.title.toLowerCase()).join(" ");
  const day = chicagoDayNumber(date);
  const scored = STORY_LIBRARY.map((card, index) => {
    const matches = card.keywords.filter((keyword) => changeText.includes(keyword)).length;
    return { card, score: matches * 100 + ((day + index * 17) % 53) };
  }).sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, Math.max(3, Math.min(5, count)));
  return selected.map(({ card }, index): DraftStory => {
    const matchingChange = changes.find((change) => card.keywords.some((keyword) => change.title.toLowerCase().includes(keyword)));
    const family = index === 0
      ? (day % 4 === 0 ? "narrated-gameplay" : "transformation-timelapse")
      : "companion-post";
    const creativeBrief = {
      family,
      captureRecipe: family === "narrated-gameplay"
        ? "garden-fable-v1"
        : family === "transformation-timelapse"
          ? "garden-transformation-v1"
          : "poster-companion-v1",
      objective: family === "transformation-timelapse"
        ? "first_plant"
        : family === "narrated-gameplay"
          ? "product_understanding"
          : "community_conversation",
      videoFormat: family === "transformation-timelapse"
        ? "garden_transformation"
        : family === "narrated-gameplay"
          ? "narrated_gameplay"
          : "companion_post",
      scene: family === "transformation-timelapse" ? "my-garden-transformation" : "water-chain",
      intendedAudience: "Cozy-game players and curious gardeners who value calm, shared progress.",
      distribution: "organic",
      hypothesis: family === "companion-post"
        ? "A specific, genuine question will produce more meaningful replies than a generic promotion."
        : "Showing visible garden progress in the first second will improve chose-to-view and completion rate.",
      alternateHooks: [
        card.reelPlan.hook,
        `I am building Basil, and this is ${card.title.toLowerCase()}.`,
        card.reelPlan.payoff,
      ],
      destinationUrl: "https://basilcommunitygarden.com/",
      trackingCode: `utm_source=social&utm_medium=organic&utm_campaign=basil_daily&utm_content=${card.key}`,
      truthClaims: [{ claim: card.fact, supported: true, basis: matchingChange?.url ?? "Basil source code and curated product field guide" }],
      narrationDirection: family === "narrated-gameplay"
        ? "Write an original 45-70 word retelling of a fact-checked garden, farm, or nature story. Keep the tone warm and curious; never present uncertain lore as fact."
        : null,
      requiredChecks: [
        "Actual Basil renderer footage only",
        "1080x1920 H.264/AAC MP4 with poster",
        "Readable opening frame in under one second",
        "No unsupported game or botanical claim",
      ],
    } satisfies DraftStory["creativeBrief"];
    return {
      key: card.key,
      sourceType: matchingChange ? "repository" : "evergreen",
      sourceRef: matchingChange?.url ?? null,
      title: card.title,
      summary: card.summary,
      whyToday: matchingChange
        ? `Recent Basil work (${matchingChange.title}) makes this an especially timely story.`
        : card.whyToday,
      assetUrl: card.assetUrl,
      assetKind: card.assetKind,
      reelPlan: card.reelPlan,
      creativeBrief,
      evidence: {
        fact: card.fact,
        recentChange: matchingChange ?? null,
        aggregateStats: stats,
        editorialRank: index + 1,
        reelPlan: card.reelPlan,
        creativeBrief,
      },
      variants: card.variants.map((variant) => ({ ...variant, hashtags: [...variant.hashtags] })),
    };
  });
}

function isChannel(value: unknown): value is SocialChannel {
  return typeof value === "string" && SOCIAL_CHANNELS.includes(value as SocialChannel);
}

function extractResponseText(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const response = value as Record<string, unknown>;
  if (typeof response.output_text === "string") return response.output_text;
  if (!Array.isArray(response.output)) return null;
  for (const item of response.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as Record<string, unknown>).text;
      if (typeof text === "string") return text;
    }
  }
  return null;
}

export async function refineDraftsWithOpenAI(drafts: DraftStory[], changes: RepositoryChange[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || drafts.length === 0) return drafts;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_SOCIAL_MODEL ?? "gpt-5.6-terra",
        reasoning: { effort: "low" },
        text: {
          verbosity: "medium",
          format: {
            type: "json_schema",
            name: "basil_social_drafts",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["stories"],
              properties: {
                stories: {
                  type: "array",
                  minItems: drafts.length,
                  maxItems: drafts.length,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["key", "title", "summary", "whyToday", "variants"],
                    properties: {
                      key: { type: "string" },
                      title: { type: "string" },
                      summary: { type: "string" },
                      whyToday: { type: "string" },
                      variants: {
                        type: "array",
                        minItems: 4,
                        maxItems: 4,
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["channel", "headline", "body", "hashtags"],
                          properties: {
                            channel: { type: "string", enum: [...SOCIAL_CHANNELS] },
                            headline: { type: "string" },
                            body: { type: "string" },
                            hashtags: { type: "array", items: { type: "string" } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        input: [
          {
            role: "system",
            content: [{
              type: "input_text",
              text: "You are Basil Community Garden's careful social editor. Rewrite only the supplied drafts. Preserve every factual boundary and story key. Never invent a shipped feature, player statistic, wildlife rule, reward, or API capability. Reddit should invite a genuine discussion and must not sound like repeated promotion. YouTube, Instagram, and TikTok copy should fit real gameplay footage. Do not add links except when already present. Return the required JSON only.",
            }],
          },
          {
            role: "user",
            content: [{
              type: "input_text",
              text: JSON.stringify({ drafts, recentRepositoryChanges: changes }),
            }],
          },
        ],
      }),
    });
    if (!response.ok) return drafts;
    const text = extractResponseText(await response.json());
    if (!text) return drafts;
    const parsed = JSON.parse(text) as { stories?: unknown[] };
    if (!Array.isArray(parsed.stories) || parsed.stories.length !== drafts.length) return drafts;
    const byKey = new Map(drafts.map((draft) => [draft.key, draft]));
    const refined: DraftStory[] = [];
    for (const raw of parsed.stories) {
      if (!raw || typeof raw !== "object") return drafts;
      const story = raw as Record<string, unknown>;
      const original = typeof story.key === "string" ? byKey.get(story.key) : null;
      if (!original || !Array.isArray(story.variants)) return drafts;
      const variants = story.variants.map((value) => {
        const variant = value && typeof value === "object" ? value as Record<string, unknown> : {};
        if (!isChannel(variant.channel) || typeof variant.headline !== "string" || typeof variant.body !== "string" || !Array.isArray(variant.hashtags)) return null;
        return {
          channel: variant.channel,
          headline: variant.headline.slice(0, 300),
          body: variant.body.slice(0, 10_000),
          hashtags: variant.hashtags.filter((tag): tag is string => typeof tag === "string").slice(0, 12),
        };
      });
      if (variants.some((variant) => !variant) || new Set(variants.map((variant) => variant?.channel)).size !== 4) return drafts;
      refined.push({
        ...original,
        title: typeof story.title === "string" ? story.title.slice(0, 180) : original.title,
        summary: typeof story.summary === "string" ? story.summary.slice(0, 1200) : original.summary,
        whyToday: typeof story.whyToday === "string" ? story.whyToday.slice(0, 600) : original.whyToday,
        variants: variants as DraftVariant[],
        evidence: { ...original.evidence, generatedWithOpenAI: true },
      });
    }
    return refined.length === drafts.length ? refined : drafts;
  } catch {
    return drafts;
  } finally {
    clearTimeout(timeout);
  }
}
