export const SOCIAL_CHANNELS = ["reddit", "youtube", "instagram"] as const;

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
    family: "basil-bulletin";
    bulletinType: "garden_status" | "how_it_works" | "garden_discovery" | "garden_diagram";
    bulletinLabel: string;
    captureRecipe: string;
    objective: "garden_status" | "mechanic_education" | "feature_discovery" | "concept_education";
    videoFormat: "status_bulletin" | "mechanic_walkthrough" | "feature_walkthrough" | "diagram_explainer";
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

type LibraryVariant = Omit<DraftVariant, "channel"> & { channel: SocialChannel | "tiktok" };

type StoryCard = Omit<DraftStory, "sourceType" | "sourceRef" | "evidence" | "creativeBrief" | "variants"> & {
  keywords: string[];
  fact: string;
  variants: LibraryVariant[];
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
  _count = 3,
) {
  const day = chicagoDayNumber(date);
  const commonChecks = [
    "Actual Basil renderer footage only",
    "1080x1920 H.264/AAC MP4 with poster",
    "Narration-derived word timing for every caption",
    "No unsupported game, garden, or botanical claim",
  ];
  const cards = [
    buildDiscoveryBulletin(changes, commonChecks, day),
    buildMechanicBulletin(STORY_LIBRARY.find((card) => card.key === "watering-spread")!, changes, commonChecks, day),
    buildCommunityDiagram(changes, stats, day),
  ];
  return cards.map((card, index): DraftStory => ({
    ...card,
    evidence: {
      fact: card.fact,
      aggregateStats: stats,
      editorialRank: index + 1,
      reelPlan: card.reelPlan,
      creativeBrief: card.creativeBrief,
    },
    variants: card.variants.filter((variant) => isChannel(variant.channel)).map((variant) => ({ ...variant, channel: variant.channel as SocialChannel, hashtags: [...variant.hashtags] })),
  }));
}

function buildDiscoveryBulletin(changes: RepositoryChange[], requiredChecks: string[], day: number) {
  const matchingChange = changes.find((change) => /builder|personal garden|my garden|layout/i.test(change.title));
  const fact = "My Garden includes a Builder Mode for planning and placing a personal garden layout.";
  return {
    key: `builder-mode-${day}`,
    sourceType: matchingChange ? "repository" as const : "evergreen" as const,
    sourceRef: matchingChange?.url ?? null,
    title: "Turn an empty garden into a plan",
    summary: "A visual reveal of Basil's Builder Mode turning open cells into a readable personal-garden layout.",
    whyToday: "This gives the first video a visible before-to-after payoff instead of repeating the live totals shown in the static post.",
    assetUrl: GAMEPLAY_LAVENDER,
    assetKind: "image" as const,
    reelPlan: {
      hook: "This empty garden is about to become a plan.",
      shots: ["Open on sparse My Garden cells.", "Preview a short layout as Mary moves through the garden.", "Place the completed shape and hold on the result."],
      payoff: "Hold on the completed personal-garden layout for at least three seconds.",
      targetSeconds: 16,
      fallbackVisual: "A labeled Builder Mode explainer using the real personal-garden renderer.",
    },
    fact,
    creativeBrief: {
      family: "basil-bulletin" as const,
      bulletinType: "garden_discovery" as const,
      bulletinLabel: "Garden transformation",
      captureRecipe: "deterministic-builder-mode-v1",
      objective: "feature_discovery" as const,
      videoFormat: "feature_walkthrough" as const,
      scene: "builder-mode",
      intendedAudience: "Cozy-game players who enjoy arranging, planning, and watching a garden take shape.",
      distribution: "organic" as const,
      hypothesis: "A clear empty-to-planned transformation will hold attention better than another spoken status update.",
      alternateHooks: ["This empty garden is about to become a plan.", "Watch six cells turn into a garden layout.", "Plan the shape before you plant it."],
      destinationUrl: "https://basilcommunitygarden.com/",
      trackingCode: `utm_source=social&utm_medium=organic&utm_campaign=basil_daily&utm_content=builder_transformation_${day}`,
      truthClaims: [{ claim: fact, supported: true, basis: matchingChange?.url ?? "Basil personal-garden renderer and Builder Mode implementation" }],
      narrationDirection: "Lead with the visible transformation, then explain the feature in one concise sentence. Do not narrate setup that the viewer cannot see.",
      requiredChecks,
    },
    variants: [
      { channel: "instagram" as const, headline: "This empty garden is about to become a plan", body: "Builder Mode lets you preview a My Garden layout before you commit it. Start with open cells, shape the plan, then keep planting around it.", hashtags: ["BasilCommunityGarden", "CozyGaming", "GardenDesign", "PixelGarden"] },
      { channel: "youtube" as const, headline: "Turning an empty pixel garden into a plan", body: "A quick look at Basil's Builder Mode: preview a personal-garden layout, inspect the shape, and place it when it feels right.", hashtags: ["BasilCommunityGarden", "CozyGames", "GardenDesign"] },
      { channel: "reddit" as const, headline: "I am testing a clearer before-and-after for Basil's Builder Mode", body: "This clip starts with an open section of My Garden, previews a layout cell by cell, and holds on the completed shape. The feature is meant to make planning readable before the player commits the layout. Does the before-and-after explain the tool without needing a longer tutorial?", hashtags: [] },
    ],
  };
}

function buildMechanicBulletin(card: StoryCard, changes: RepositoryChange[], requiredChecks: string[], day: number) {
  const matchingChange = changes.find((change) => card.keywords.some((keyword) => change.title.toLowerCase().includes(keyword)));
  return {
    key: `how-watering-works-${day}`,
    sourceType: matchingChange ? "repository" as const : "evergreen" as const,
    sourceRef: matchingChange?.url ?? null,
    title: "How watering works: choose, preview, water",
    summary: "A direct three-step demonstration of Basil's two-tap watering loop.",
    whyToday: "This is a repeatable mechanic bulletin: one game action, shown clearly from input through result.",
    assetUrl: card.assetUrl,
    assetKind: card.assetKind,
    reelPlan: card.reelPlan,
    fact: card.fact,
    creativeBrief: {
      family: "basil-bulletin" as const,
      bulletinType: "how_it_works" as const,
      bulletinLabel: "How Basil works",
      captureRecipe: "deterministic-watering-how-to-v1",
      objective: "mechanic_education" as const,
      videoFormat: "mechanic_walkthrough" as const,
      scene: "watering-how-to",
      intendedAudience: "New players who need to understand one Basil interaction in under twenty seconds.",
      distribution: "organic" as const,
      hypothesis: "A numbered input-to-result demonstration will increase product understanding and first-session confidence.",
      alternateHooks: ["Water three flowers in two taps.", "Basil's watering loop has three clear steps.", "Choose the droplet, preview the spread, then water."],
      destinationUrl: "https://basilcommunitygarden.com/",
      trackingCode: `utm_source=social&utm_medium=organic&utm_campaign=basil_daily&utm_content=watering_how_to_${day}`,
      truthClaims: [{ claim: card.fact, supported: true, basis: matchingChange?.url ?? "Basil watering implementation and curated product field guide" }],
      narrationDirection: "Explain the mechanic as three short numbered steps. Use calm, factual language and name only actions visible in the capture.",
      requiredChecks,
    },
    variants: card.variants,
  };
}

function buildCommunityDiagram(changes: RepositoryChange[], stats: SocialStats, day: number) {
  const matchingChange = changes.find((change) => /community garden|plant|grid|water|garden/i.test(change.title));
  const fact = `The live Basil community garden contains ${stats.communityFlowers} flowers: ${stats.roses} roses, ${stats.lavender} lavender plants, and ${stats.sunflowers} sunflowers.`;
  return {
    key: `community-grid-diagram-${day}`,
    sourceType: matchingChange ? "repository" as const : "evergreen" as const,
    sourceRef: matchingChange?.url ?? null,
    title: `Live map: ${stats.communityFlowers} flowers in one shared garden`,
    summary: "A current, game-accurate view of planting diversity in Basil's shared community garden.",
    whyToday: "This image uses today's real community-garden arrangement and current totals rather than a seeded test garden.",
    assetUrl: GAMEPLAY_LAVENDER,
    assetKind: "image" as const,
    reelPlan: {
      hook: `${stats.communityFlowers} flowers. One shared garden.`,
      shots: ["Load today's production community-garden snapshot.", "Frame the densest visible section containing roses, lavender, and sunflowers.", "Label only the three current planting totals."],
      payoff: "A complete, readable 4:5 live garden map focused on planting diversity.",
      targetSeconds: 0,
      fallbackVisual: "The deterministic Basil diagram renderer is the required source, not a fallback illustration.",
    },
    fact,
    creativeBrief: {
      family: "basil-bulletin" as const,
      bulletinType: "garden_diagram" as const,
      bulletinLabel: "Game diagram",
      captureRecipe: "deterministic-community-grid-diagram-v1",
      objective: "concept_education" as const,
      videoFormat: "diagram_explainer" as const,
      scene: "community-grid-diagram",
      intendedAudience: "Cozy-game players attracted by a dense, changing community garden and social-world premise.",
      distribution: "organic" as const,
      hypothesis: "A visually dense live garden snapshot with three simple planting totals will stop attention and earn more saves, profile visits, and game starts than a rules-heavy diagram.",
      alternateHooks: [`${stats.communityFlowers} flowers. One shared garden.`, "This is what everyone has planted so far.", `${stats.roses} roses—and they all share one map.`],
      destinationUrl: "https://basilcommunitygarden.com/",
      trackingCode: `utm_source=social&utm_medium=organic&utm_campaign=basil_daily&utm_content=community_grid_diagram_${day}`,
      truthClaims: [{ claim: fact, supported: true, basis: `Production aggregate snapshot at ${stats.measuredAt}; the image renderer also checks the live coordinate snapshot${matchingChange ? `; ${matchingChange.url}` : ""}` }],
      narrationDirection: null,
      requiredChecks: [
        "Actual Basil renderer and integer grid coordinates only",
        "1080x1350 PNG with no invented game objects or invalid planting positions",
        "The image is generated from the current production community-garden coordinate snapshot",
        "Roses, lavender, sunflowers, Mary, and the shared-garden density remain readable",
        "Annotations are limited to the current planting totals and remain outside the primary garden view",
        "No unsupported game, garden, or botanical claim",
      ],
    },
    variants: [
      { channel: "instagram" as const, headline: `${stats.communityFlowers} flowers. One shared garden.`, body: `This is Basil's live community garden today: ${stats.roses} roses, ${stats.lavender} lavender plants, and ${stats.sunflowers} sunflowers sharing one map. Where would you plant next?`, hashtags: ["BasilCommunityGarden", "CozyGaming", "PixelGarden", "CommunityGarden"] },
      { channel: "reddit" as const, headline: `The live Basil garden now has ${stats.communityFlowers} flowers—here is the planting mix`, body: `I rendered this directly from today's shared Basil garden rather than arranging a promotional test scene. The current map contains ${stats.roses} roses, ${stats.lavender} lavender plants, and ${stats.sunflowers} sunflowers. I want these static posts to show what the community is actually building, not an abstract version of it. Which live garden view or comparison would be useful to map next?`, hashtags: [] },
    ],
  };
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
                        minItems: 2,
                        maxItems: SOCIAL_CHANNELS.length,
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
              text: "You are Basil Community Garden's factual bulletin editor. Rewrite only the supplied drafts. Preserve every factual boundary, bulletin lane, story key, asset kind, and original set of channels. Lead with concrete garden status, a demonstrated mechanic, or a game-accurate diagram concept. Never add fables, sentimental founder narration, invented statistics, shipped features, wildlife rules, rewards, or API capabilities. Reddit should invite a specific product discussion without repeated promotion. YouTube and Instagram copy must describe only the supplied gameplay or diagram. A diagram must remain Instagram and Reddit only. Do not add links except when already present. Return the required JSON only.",
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
      const originalChannels = new Set(original.variants.map((variant) => variant.channel));
      const refinedChannels = new Set(variants.map((variant) => variant?.channel));
      if (variants.some((variant) => !variant)
        || refinedChannels.size !== originalChannels.size
        || [...refinedChannels].some((channel) => !channel || !originalChannels.has(channel))) return drafts;
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
