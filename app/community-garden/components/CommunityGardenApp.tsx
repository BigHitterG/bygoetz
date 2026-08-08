"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  trackBasilMetaCheckout,
  trackBasilMetaCustomMilestone,
  trackBasilMetaPurchase,
  trackBasilMetaStandardEvent,
} from "@/lib/analytics/basilMetaClient";
import type { MyGardenState } from "@/lib/communityGarden/myGarden";
import { FutureAdSlot } from "./FutureAdSlot";
import {
  GardenCanvas,
  type GardenCanvasHandle,
  type GardenUiState,
} from "./GardenCanvas";
import type { GardenWorldMode } from "../game/gardenRenderer";
import { getGardenAccountClient } from "../lib/supabaseAccount";
import {
  fetchGardenRequest,
  type GardenContribution,
} from "../lib/supabaseGarden";
import { GardenMapKey } from "./GardenMapKey";
import type { CommunityAtlasTarget } from "./CommunityAtlas";
import { GardenMenu, type LibrarySection } from "./GardenMenu";
import type { MyGardenMutation } from "../lib/myGardenMutation";
import {
  awardGuestCare,
  clearGuestGardenPreview,
  createGuestGardenPreview,
  getGuestPreviewImport,
  GUEST_PLANTING_LIMIT,
  GuestPreviewExpiredError,
  GuestPreviewLimitError,
  isGuestPreviewExpired,
  loadGuestGardenPreview,
  markGuestPreviewContinued,
  markGuestSoftPaywallDeclined,
  mutateGuestGarden,
  preserveGuestGardenPreviewForCheckout,
  saveGuestGardenPreview,
  type GuestGardenPreview,
} from "../lib/guestGardenPreview";
import { GardenControlsDock } from "./GardenControlsDock";
import { GardenInventory } from "./GardenInventory";
import {
  GardenMembershipOffer,
  type GardenMembershipCredentials,
} from "./GardenMembershipOffer";
import { GardenUpdateStatus } from "./GardenUpdateStatus";
import { GardenOnboarding } from "./GardenOnboarding";
import { GardenUnlockCelebration } from "./GardenUnlockCelebration";
import { HeritageFlowerCelebration } from "./HeritageFlowerCelebration";
import { HeritageFlowerDiscovery } from "./HeritageFlowerDiscovery";
import { CareBlossomDiscovery } from "./CareBlossomDiscovery";
import { GardenWormDiscovery } from "./GardenWormDiscovery";
import { LivingGardenDiscoveryModal } from "./LivingGardenDiscovery";
import { GardenBugReporter } from "./GardenBugReporter";
import { GardenExpansionConfirmation } from "./GardenExpansionConfirmation";
import { GardenClearingReturnConfirmation } from "./GardenClearingReturnConfirmation";
import { CommunityGardenPresentation } from "./CommunityGardenPresentation";
import {
  CommunityStewardshipPanel,
  GardenTaskCelebration,
} from "./CommunityStewardship";
import type {
  GardenStewardshipNotification,
  GardenStewardshipPoint,
  GardenStewardshipSummary,
} from "../lib/stewardshipTypes";
import {
  GardenShare,
  type GardenShareScope,
} from "./GardenShare";
import {
  COMMUNITY_CLASSIC_ONBOARDING_PLANTINGS,
  COMMUNITY_FAST_START_PLANTINGS,
  getCommunityQuickStartPlantType,
  isClassicGardenOnboarding,
  isGardenOnboardingFinished,
  isGardenOnboardingPlantType,
  isCommunityQuickStart,
  loadCommunityOnboardingPlantings,
  loadGardenOnboardingStep,
  saveCommunityOnboardingPlantings,
  saveGardenOnboardingStep,
  type GardenOnboardingStep,
} from "../lib/gardenOnboarding";
import {
  getBasilLaunchSessionId,
  trackBasilFunnelEvent,
} from "../lib/launchFunnel";
import {
  getPlantDefinition,
  SPECIAL_WATERING_FLOWER_NAME,
} from "../lib/roseLifecycle";
import {
  getMyGardenElementGlyphClass,
  getMyGardenUnlockNotices,
  getMyGardenUnreadUnlockCount,
  type MyGardenUnlockNotice,
} from "../lib/myGardenCatalog";
import { useGardenAudio } from "../lib/gardenAudio";
import {
  mergeHeritageMomentQueue,
  parseHeritageMoments,
  type HeritageMoment,
} from "../lib/heritageNotifications";
import {
  HERITAGE_DISCOVERY_STORAGE_KEY,
  type HeritageFlowerEncounter,
} from "../lib/heritageDiscovery";
import type { LivingGardenHabitatKey } from "../lib/livingGarden";

const INITIAL_UI: GardenUiState = {
  action: null,
  actionLabel: "Choose a spot",
  actionEnabled: false,
  connection: "connecting",
  message: "Connecting to the shared garden...",
  mapX: 60.38,
  mapY: 60.38,
  mapWidthPercentage: 100,
  mapHeightPercentage: 100,
  zoom: 1,
  canZoomIn: true,
  canZoomOut: false,
  selectedPlantType: "rose",
  selectedElementType: null,
  selectedTool: "rose",
  selectedGridX: null,
  selectedGridY: null,
  pathMapPoints: [],
  plantMapPoints: [],
  regionMapCells: [],
  mapBounds: { minX: -96, maxX: 63, minY: -96, maxY: 63 },
  regionSize: 16,
  snapshotVersion: 0,
  currentRegionStage: null,
  currentGuidanceZone: null,
  recentlyOpenedRegionKey: null,
  nextMapUpdateAt: null,
  mode: "community",
  builder: {
    active: false,
    canEnter: false,
    length: 0,
    maxLength: 10,
    mode: null,
    careDelta: 0,
    helperText: "Choose a square first.",
  },
};

const HEALTH_PULSE_KEY = "basil-health-pulse-at-v1";
const HEALTH_PULSE_INTERVAL_MS = 5 * 60 * 1000;
const GROWING_EDGE_INTRO_KEY = "basil-garden-zones-intro-v2";
const GROWING_EDGE_HELPED_KEY = "basil-growing-edge-helped-v1";
const GROWING_EDGE_OPENED_KEY = "basil-growing-edge-opened-v1";
const MEMBER_GARDEN_CACHE_PREFIX = "basil-member-garden-cache-v1:";
const MEMBERSHIP_RETRY_MAX_DELAY_MS = 30_000;
const GARDEN_WORM_DISCOVERY_KEY = "basil-garden-worm-discovery-v1";
const CARE_BLOSSOM_DISCOVERY_KEY = "basil-care-blossom-discovery-v1";
const HERITAGE_NOTIFICATION_REFRESH_MS = 5 * 60 * 1000;
const UNLOCK_CELEBRATION_HISTORY_PREFIX =
  "basil-unlock-celebration-history-v1:";

type AccountResponse =
  | { active: false; admin?: boolean }
  | {
      active: true;
      myGarden: MyGardenState;
      stewardship: GardenStewardshipSummary;
      admin?: boolean;
    };

type MembershipOfferStage = "soft" | "hard" | "expired";

async function getResponseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

function getMemberGardenCacheKey(userId: string) {
  return `${MEMBER_GARDEN_CACHE_PREFIX}${userId}`;
}

function getUnlockNoticeKey(notice: MyGardenUnlockNotice) {
  return [
    notice.lifetimeCareRequired,
    notice.items.map((item) => item.key).join(","),
    notice.completedCollection?.key ?? "",
  ].join(":");
}

function getUnlockCelebrationHistory(userId: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(
        `${UNLOCK_CELEBRATION_HISTORY_PREFIX}${userId}`,
      ) ?? "[]",
    ) as unknown;
    return new Set(
      Array.isArray(stored)
        ? stored.filter((value): value is string => typeof value === "string")
        : [],
    );
  } catch {
    return new Set<string>();
  }
}

function saveUnlockCelebrationHistory(userId: string, history: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${UNLOCK_CELEBRATION_HISTORY_PREFIX}${userId}`,
      JSON.stringify(Array.from(history)),
    );
  } catch {
    // The live queue still shows celebrations during this visit.
  }
}

function claimFirstCareBlossomDiscovery() {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(CARE_BLOSSOM_DISCOVERY_KEY) === "seen") {
      return false;
    }
    window.localStorage.setItem(CARE_BLOSSOM_DISCOVERY_KEY, "seen");
    return true;
  } catch {
    return true;
  }
}

function markHeritageFlowerDiscoverySeen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HERITAGE_DISCOVERY_STORAGE_KEY, "seen");
  } catch {
    // The in-memory guard still prevents repeat notices during this visit.
  }
}

function claimFirstHeritageFlowerDiscovery() {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(HERITAGE_DISCOVERY_STORAGE_KEY) === "seen") {
      return false;
    }
    markHeritageFlowerDiscoverySeen();
    return true;
  } catch {
    return true;
  }
}

function getOutstandingUnlockCelebrations(
  userId: string,
  lifetimeCare: number,
) {
  const reached = getMyGardenUnlockNotices(0, lifetimeCare);
  if (reached.length === 0) return [] as MyGardenUnlockNotice[];
  const history = getUnlockCelebrationHistory(userId);
  if (history.size === 0 && reached.length > 1) {
    for (const notice of reached.slice(0, -1)) {
      history.add(getUnlockNoticeKey(notice));
    }
    saveUnlockCelebrationHistory(userId, history);
  }
  return reached.filter((notice) => !history.has(getUnlockNoticeKey(notice)));
}

function loadMemberGardenCache(userId: string) {
  if (typeof window === "undefined") return null;
  try {
    const key = getMemberGardenCacheKey(userId);
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const garden = JSON.parse(raw) as Partial<MyGardenState>;
    if (
      !Array.isArray(garden.plants) ||
      !Array.isArray(garden.paths) ||
      !Array.isArray(garden.elements) ||
      typeof garden.careBalance !== "number" ||
      typeof garden.lifetimeCare !== "number"
    ) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return garden as MyGardenState;
  } catch {
    return null;
  }
}

function saveMemberGardenCache(userId: string, garden: MyGardenState | null) {
  if (typeof window === "undefined") return;
  const key = getMemberGardenCacheKey(userId);
  try {
    if (garden) window.sessionStorage.setItem(key, JSON.stringify(garden));
    else window.sessionStorage.removeItem(key);
  } catch {
    // Restricted or full session storage should never interrupt the garden.
  }
}

export function CommunityGardenApp() {
  const gardenAudio = useGardenAudio();
  const playGardenSound = gardenAudio.play;
  const canvasRef = useRef<GardenCanvasHandle>(null);
  const careClaimQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingGardenEntryRef = useRef(false);
  const guestPreviewRef = useRef<GuestGardenPreview>(
    createGuestGardenPreview(),
  );
  const lifetimeCareRef = useRef(0);
  const memberGardenRef = useRef<MyGardenState | null>(null);
  const uiRef = useRef(INITIAL_UI);
  const sessionUserIdRef = useRef<string | null>(null);
  const careBlossomDiscoverySeenRef = useRef(false);
  const membershipRetryTimerRef = useRef<number | null>(null);
  const membershipRetryAttemptRef = useRef(0);
  const inventoryAudioReadyRef = useRef(false);
  const unlockAudioKeyRef = useRef<string | null>(null);
  const heritageAudioKeyRef = useRef<string | null>(null);
  const heritageMomentIdsRef = useRef(new Set<string>());
  const heritageAcknowledgementIdsRef = useRef(new Set<string>());
  const heritageEncounterClaimedRef = useRef(false);
  const lastGuidanceZoneRef = useRef(INITIAL_UI.currentGuidanceZone);
  const [ui, setUi] = useState(INITIAL_UI);
  const [atlasTarget, setAtlasTarget] =
    useState<CommunityAtlasTarget | null>(null);
  const [communityAtlasOpen, setCommunityAtlasOpen] = useState(false);
  const [world, setWorld] = useState<GardenWorldMode>("community");
  const [menuOpen, setMenuOpen] = useState(false);
  const [communityPresentationOpen, setCommunityPresentationOpen] =
    useState(false);
  const presentationFullscreenRequestedRef = useRef(false);
  const [menuSection, setMenuSection] = useState<LibrarySection>("play");
  const [guideInitialShelf, setGuideInitialShelf] = useState<"home" | "habitats">("home");
  const [careAnnouncement, setCareAnnouncement] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [guestPreview, setGuestPreview] = useState<GuestGardenPreview>(
    createGuestGardenPreview(),
  );
  const [memberGarden, setMemberGarden] = useState<MyGardenState | null>(null);
  const [stewardship, setStewardship] =
    useState<GardenStewardshipSummary | null>(null);
  const [gardenTasksOpen, setGardenTasksOpen] = useState(false);
  const [showMyCommunityFlowers, setShowMyCommunityFlowers] = useState(false);
  const [replacingTaskId, setReplacingTaskId] = useState<string | null>(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [membershipOfferOpen, setMembershipOfferOpen] = useState(false);
  const [membershipOfferStage, setMembershipOfferStage] =
    useState<MembershipOfferStage>("soft");
  const [membershipCheckoutBusy, setMembershipCheckoutBusy] = useState(false);
  const [membershipCheckoutError, setMembershipCheckoutError] = useState("");
  const [guestPreviewReady, setGuestPreviewReady] = useState(false);
  const [accountChecked, setAccountChecked] = useState(false);
  const [inventoryDesignAccess, setInventoryDesignAccess] = useState(false);
  const [onboardingStep, setOnboardingStep] =
    useState<GardenOnboardingStep | null>(null);
  const [communityQuickStart] = useState(
    () =>
      typeof window !== "undefined" &&
      isCommunityQuickStart(window.location.search),
  );
  const [classicOnboardingRequested] = useState(
    () =>
      typeof window !== "undefined" &&
      isClassicGardenOnboarding(window.location.search),
  );
  const [communityOnboardingPlantings, setCommunityOnboardingPlantings] =
    useState(0);
  const [showFreePlantingNotice, setShowFreePlantingNotice] = useState(false);
  const [showCommunityQuickStartComplete, setShowCommunityQuickStartComplete] =
    useState(false);
  const [quickStartPlantPending, setQuickStartPlantPending] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState("");
  const [membershipReloadToken, setMembershipReloadToken] = useState(0);
  const [unlockNotices, setUnlockNotices] = useState<MyGardenUnlockNotice[]>([]);
  const [careBlossomFound, setCareBlossomFound] = useState(false);
  const [gardenWormFound, setGardenWormFound] = useState(false);
  const [heritageMoments, setHeritageMoments] = useState<HeritageMoment[]>([]);
  const [heritageEncounter, setHeritageEncounter] =
    useState<HeritageFlowerEncounter | null>(null);
  const [expansionConfirmationOpen, setExpansionConfirmationOpen] =
    useState(false);
  const [returnClearingOpen, setReturnClearingOpen] = useState(false);
  const [returnClearingBusy, setReturnClearingBusy] = useState(false);
  const [returnClearingError, setReturnClearingError] = useState("");
  const [growingEdgeIntroOpen, setGrowingEdgeIntroOpen] = useState(false);
  const [growingEdgeNotice, setGrowingEdgeNotice] = useState("");
  const restoredJourneyRef = useRef(false);
  const communityOnboardingPlantingsRef = useRef(0);
  const quickStartPlantTrackedRef = useRef(false);
  const quickStartCompletedThisSessionRef = useRef(false);
  const adLabÛ¿{òÚ$z{-®éÜj×—Ö ¢¢V’æ7F–öâÓÓÒ&W‡æB ¢ò&6rÖÆö6²Ö–6öâ ¢¢V’æ7F–öâÓÓÒ&Æ’×F‚"ÇÀ¢V’æ7F–öâÓÓÒ'&VÖ÷fR×F‚"ÇÀ¢‡V’æ7F–öâÓÓÒ&'V–ÆFW"×Æ6R"b`¢V’ç6VÆV7FVEFööÂÓÓÒ'F‚"¢ò&6r×F‚Ö–6öâ ¢¢6r×ÆçBÖvÇ—‚—2ÒG·V’ç6VÆV7FVEÆçEG—WÖ ¢Ğ¢&–Ö†–FFVãÒ'G'VR ¢óà¢Ğ¢öäÖ×²‚’Óâ°¢6WDÖVçT÷Vâ†fÇ6R“°¢6WD–çfVçF÷'”÷Vâ†fÇ6R“°¢6WEv÷&ÆB‚&6öÖ×Væ—G’"“°¢6WD6öÖ×Væ—G”FÆ4÷Vâ‡G'VR“°¢Æ”v&FVå6÷VæB‚'6VÆV7B"“°¢×Ğ¢öä–çfVçF÷'“×²‚’Óâ°¢–b‚–çfVçF÷'”÷Vâ’÷Vä–çfVçF÷'”f÷$öæ&ö&F–ær‚“°¢VÇ6R°¢–b†öæ&ö&F–æuÆçE6VÆV7F–öå&WV—&VB’&WGW&ã°¢6WD–çfVçF÷'”÷Vâ†fÇ6R“°¢–b‡v÷&ÆBÓÓÒ'W'6öæÂ"’fö–B6¶æ÷vÆVFvT–çfVçF÷'•VæÆö6·2‚“°¢Ğ¢×Ğ¢öäv&FVã×·7v—F6…v÷&ÆGĞ¢öä7F–öã×·W&f÷&Õ6VÆV7FVD7F–öçĞ¢óà Ğ¢·v÷&ÆBÓÓÒ'W'6öæÂ"bb6W76–öâbb66÷VçD6†V6¶VBbbÖVÖ&W$v&FVâò€Ğ¢ÆF—`Ğ¢6Æ74æÖS×¶6rÖ'V–ÆFW"×FööÇ2G·V’æ'V–ÆFW"æ7F—fRò"—2Ö7F—fR"¢"'ÖĞĞ¢àĞ¢Æ'WGFöàĞ¢6Æ74æÖSÒ&6rÖ'V–ÆFW"×FövvÆR Ğ¢G—SÒ&'WGFöâ Ğ¢&–×&W76VC×·V’æ'V–ÆFW"æ7F—fWĞĞ¢F—6&ÆVC×²V’æ'V–ÆFW"æ7F—fRbbV’æ'V–ÆFW"æ6äVçFW'ĞĞ¢F—FÆS×°Ğ¢V’æ'V–ÆFW"æ7F—fPĞ¢ò$6Æ÷6R'V–ÆFW"ÖöFR Ğ¢¢V’æ'V–ÆFW"æ†VÇW%FW‡@Ğ¢ĞĞ¢öä6Æ–6³×²‚’Óâ°Ğ¢Æ”v&FVå6÷VæB‚'6VÆV7B"“°Ğ¢6çf5&Vbæ7W'&VçCòçFövvÆT'V–ÆFW$ÖöFR‚“°Ğ¢×ĞĞ¢àĞ¢Ç7â6Æ74æÖSÒ&6rÖ'V–ÆFW"Ö–6öâ"&–Ö†–FFVãÒ'G'VR"óàĞ¢Ç7ãç·V’æ'V–ÆFW"æ7F—fRò$FöæR"¢$'V–ÆFW"'ÓÂ÷7ãàĞ¢Âö'WGFöãàĞ¢²V’æ'V–ÆFW"æ7F—fRbbÆæE6†–æuVæÆö6¶VBò€¢Ç6ÖÆÂ6Æ74æÖSÒ&6rÖÆæB×6†–ærÖ†–çB#à¢6†RÆæBB†VÇW ¢Â÷6ÖÆÃà¢’¢çVÆÇĞ¢¶6å&WGW&å6VÆV7FVD6ÆV&–ærò€Ğ¢Æ'WGFöàĞ¢6Æ74æÖSÒ&6r×&WGW&âÖ6ÆV&–ærÖ'WGFöâ Ğ¢G—SÒ&'WGFöâ Ğ¢F—FÆSÒ%&WGW&âF†—2V×G’6ÆV&–ærFòF†Rf÷&W7B Ğ¢öä6Æ–6³×²‚’Óâ°Ğ¢6WE&WGW&ä6ÆV&–ætW'&÷"‚""“°Ğ¢6WE&WGW&ä6ÆV&–æt÷Vâ‡G'VR“°Ğ¢Æ”v&FVå6÷VæB‚'6VÆV7B"“°Ğ¢×ĞĞ¢à¢Ç7ãå&WGW&â&6VÃÂ÷7ãà¢Âö'WGFöãà¢’¢çVÆÇĞĞ¢·V’æ'V–ÆFW"æ7F—fRò€Ğ¢ÆF—`Ğ¢6Æ74æÖSÒ&6rÖ'V–ÆFW"ÖVF—BÖ6öçG&öÇ2 Ğ¢&öÆSÒ&w&÷W Ğ¢&–ÖÆ&VÃÒ$'V–ÆFW"7G&–ær6öçG&öÇ2 Ğ¢àĞ¢Æ÷WGWCàĞ¢·V’æ'V–ÆFW"æÆVæwF‡Ò÷·V’æ'V–ÆFW"æÖ„ÆVæwF‡ĞĞ¢Âö÷WGWCàĞ¢Æ'WGFöàĞ¢G—SÒ&'WGFöâ Ğ¢F—6&ÆVC×·V’æ'V–ÆFW"æÆVæwF‚ÃÒĞĞ¢öä6Æ–6³×²‚’Óâ6çf5&Vbæ7W'&VçCòçVæFô'V–ÆFW%7FW‚—ĞĞ¢àĞ¢VæFğĞ¢Âö'WGFöãàĞ¢Æ'WGFöàĞ¢G—SÒ&'WGFöâ Ğ¢F—6&ÆVC×·V’æ'V–ÆFW"æÆVæwF‚ÃÒĞĞ¢öä6Æ–6³×²‚’Óâ6çf5&Vbæ7W'&VçCòæ6ÆV$'V–ÆFW"‚—ĞĞ¢àĞ¢6ÆV Ğ¢Âö'WGFöãàĞ¢ÂöF—càĞ¢’¢çVÆÇĞĞ¢ÂöF—càĞ¢’¢çVÆÇĞĞ Ğ¢·6†÷tÖVÖ&W'6†—6†÷'F7WBò€Ğ¢Æ'WGFöàĞ¢6Æ74æÖSÒ&6rÖ6öÖ×Væ—G’Ö¦ö–â Ğ¢G—SÒ&'WGFöâ Ğ¢&–ÖÆ&VÃÒ%Ww&FRv&FVâÖVÖ&W'6†— Ğ¢öä6Æ–6³×²‚’Óâ°Ğ¢6WDÖVÖ&W'6†—öffW%7FvR‚'6ögB"“°Ğ¢6WDÖVÖ&W'6†—öffW$÷Vâ‡G'VR“°Ğ¢×ĞĞ¢àĞ¢Ww&FPĞ¢Âö'WGFöãàĞ¢’¢çVÆÇĞĞ Ğ¢Ç6Æ74æÖSÒ&6r×7"×7FGW2"&–ÖÆ—fSÒ'öÆ—FR#ç·V’æÖW76vWÓÂ÷àĞ¢Ç6Æ74æÖSÒ&6r×7"×7FGW2"&–ÖÆ—fSÒ'öÆ—FR#ç¶6&Tææ÷Væ6VÖVçGÓÂ÷àĞ¢·&W7F÷&TÖW76vRò€Ğ¢Ç Ğ¢6Æ74æÖS×¶6r×&W7F÷&R×7FGW2G°Ğ¢&W7F÷&TÖW76vRç7F'G5v—F‚‚%&W7F÷&–ær"’ÇÀĞ¢&W7F÷&TÖW76vRç7F'G5v—F‚‚$v&FVâ6öææV7F–öâ–çFW''WFVB"Ğ¢ò" Ğ¢¢"—2ÖW'&÷" Ğ¢ÖĞĞ¢&öÆSÒ'7FGW2 Ğ¢àĞ¢·&W7F÷&TÖW76vWĞĞ¢Â÷àĞ¢’¢çVÆÇĞĞ Ğ¢¶w&÷v–ætVFvT–çG&ô÷Vâb`¢v÷&ÆBÓÓÒ&6öÖ×Væ—G’"b`¢GWF÷&–ÄÖF–ÖÖVBb`¢6†÷t6öÖ×Væ—G•V–6µ7F'D6ö×ÆWFRb`¢ÖVçT÷Vâb`¢–çfVçF÷'”÷Vâb`Ğ¢ÖVÖ&W'6†—öffW$÷Vâò€Ğ¢Æ6–FR6Æ74æÖSÒ&6rÖw&÷v–ærÖVFvRÖ–çG&ò"&öÆSÒ&F–Æör"&–ÖÖöFÃÒ&fÇ6R#àĞ¢Çä†÷rF†R6†&VBv&FVâw&÷w3Â÷àĞ¢Æƒ#äw&÷rg&öÒF†R†V'BÂ÷WGv&CÂöƒ#àĞ¢Ç7ãàĞ¢FVWw&VVâ—2F†RW7F&Æ—6†VBv&FVâ†V'Bâ—G2ÆR÷WFW"w&÷wF€Ğ¢&–ær—2÷VâÆæBv†W&RF†RæW‡B6öææV7FVBÆ–W"6âf÷&ÒâvöÆFVàĞ¢FÆö6·2Ö&²gWGW&Rw&÷v–ærVFvRÆæBfÖF6ƒ¶÷"v&FVâç—v†W&R–÷RÆ–¶RàĞ¢Â÷7ãàĞ¢Æ'WGFöâG—SÒ&'WGFöâ"öä6Æ–6³×²‚’Óâ6WDw&÷v–ætVFvT–çG&ô÷Vâ†fÇ6R—ÓàĞ¢v÷B—@Ğ¢Âö'WGFöãàĞ¢Âö6–FSàĞ¢’¢çVÆÇĞĞ Ğ¢¶w&÷v–ætVFvTæ÷F–6Rb`Ğ¢w&÷v–ætVFvT–çG&ô÷Vâb`Ğ¢ÖVçT÷Vâb`Ğ¢–çfVçF÷'”÷Vâb`Ğ¢ÖVÖ&W'6†—öffW$÷Vâò€Ğ¢Æ6–FR6Æ74æÖSÒ&6rÖw&÷v–ærÖVFvRÖæ÷F–6R"&öÆSÒ'7FGW2#àĞ¢Ç7â6Æ74æÖSÒ&6rÖw&÷v–ærÖVFvR×7&÷WB"&–Ö†–FFVãÒ'G'VR"óàĞ¢Ç7ãç¶w&÷v–ætVFvTæ÷F–6WÓÂ÷7ãàĞ¢Âö6–FSàĞ¢’¢çVÆÇĞĞ Ğ¢Äv&FVäöæ&ö&F–æp¢7FW×·V–6µ7F'EÆçEVæF–æròçVÆÂ¢öæ&ö&F–æu7FWĞ¢6öÖ×Væ—G•V–6µ7F'C×¶6öÖ×Væ—G•V–6µ7F'GĞĞ¢6öÖ×Væ—G•ÆçF–æw3×¶6öÖ×Væ—G”öæ&ö&F–æuÆçF–æw7ĞĞ¢–çfVçF÷'”÷Vã×¶–çfVçF÷'”÷VçĞĞ¢ÆçD7F–öå&VG“×¶öæ&ö&F–æuÆçD7F–öå&VG—ĞĞ¢vFW$7F–öå&VG“×¶öæ&ö&F–æuvFW$7F–öå&VG—ĞĞ¢öä÷Vä–çfVçF÷'“×¶÷Vä–çfVçF÷'”f÷$öæ&ö&F–æwĞĞ¢öä÷Vä×”v&FVã×²‚’Óâ°Ğ¢G&ç6—F–öäöæ&ö&F–ær‚'W'6öæÂÖ–çfVçF÷'’"Â²&×’Öv&FVâ%Ò“°Ğ¢fö–BG&6´&6–ÄgVææVÄWfVçB‚&×•öv&FVåöVçFW&VB"“°Ğ¢6WEv÷&ÆB‚'W'6öæÂ"“°Ğ¢×ĞĞ¢óàĞ Ğ¢·v÷&ÆBÓÓÒ&6öÖ×Væ—G’"bb6†÷t6öÖ×Væ—G•V–6µ7F'D6ö×ÆWFRò€¢Æ6–FP¢6Æ74æÖSÒ&6rÖg&VR×ÆçF–ærÖæ÷F–6R—2Ö6öÖ×Væ—G’Ö6ö×ÆWFR ¢&öÆSÒ'7FGW2 ¢&–ÖÆ—fSÒ'öÆ—FR ¢à¢Æ'WGFöà¢6Æ74æÖSÒ&6rÖ6öÖ×Væ—G’Ö6ö×ÆWFRÖ6Æ÷6R ¢G—SÒ&'WGFöâ ¢&–ÖÆ&VÃÒ$6Æ÷6RvVÆ6öÖRÖW76vR ¢öä6Æ–6³×²‚’Óâ6WE6†÷t6öÖ×Væ—G•V–6µ7F'D6ö×ÆWFR†fÇ6R—Ğ¢à¢²%ÇSCr'Ğ¢Âö'WGFöãà¢Ç7G&öæså–÷R&R'BöbF†Rv&FVâãÂ÷7G&öæsà¢Ç7ãà¢6öæw&GVÆF–öç2â–÷W"GvòfÆ÷vW'2&Rw&÷v–ær†W&Rv—F€¢WfW'–öæRVÇ6Rf÷3·2à¢Â÷7ãà¢ÆVÓå6W&–÷W6Ç(	GF†æ²–÷Rf÷"ÆçF–ærãÂöVÓà¢Âö6–FSà¢’¢çVÆÇĞĞ Ğ¢·v÷&ÆBÓÓÒ'W'6öæÂ"bb6†÷tg&VUÆçF–ætæ÷F–6Rò€Ğ¢Æ6–FR6Æ74æÖSÒ&6rÖg&VR×ÆçF–ærÖæ÷F–6R"&öÆSÒ'7FGW2#àĞ¢Ç7G&öæså–÷W"f—'7BfÆ÷vW"—2ÆçFVBãÂ÷7G&öæsàĞ¢Ç7ãäfVVÂg&VRFòÆçBÖ÷&RæB'&ævRF†Rv&FVâ–÷W"v’ãÂ÷7ãàĞ¢Âö6–FSàĞ¢’¢çVÆÇĞĞ¢Â÷6V7F–öãàĞ Ğ¢·v÷&ÆBÓÓÒ&6öÖ×Væ—G’"òÄgWGW&TE6Æ÷BÆ&VÃ×¶DÆ&VÇÒóâ¢çVÆÇĞĞ Ğ¢Äv&FVäÖVçPĞ¢÷Vã×¶ÖVçT÷VçĞĞ¢6V7F–öã×¶ÖVçU6V7F–öçĞĞ¢VF–ó×¶v&FVäVF–÷ĞĞ¢ÖöFS×·v÷&ÆGĞĞ¢Æ–fWF–ÖT6&S×¶×”v&FVâæÆ–fWF–ÖT6&WĞĞ¢Æ—f–ætv&FVäF—66÷fW&–W3×¶ÖVÖ&W$v&FVãòæÆ—f–ætv&FVäF—66÷fW&–W2óòµ×ĞĞ¢Æ—f–ætv&FVä†&—FG3×¶ÖVÖ&W$v&FVãòæÆ—f–ætv&FVä†&—FG2óòµ×ĞĞ¢wV–FT–æ—F–Å6†VÆc×¶wV–FT–æ—F–Å6†VÆgĞĞ¢öä6Æ÷6S×²‚’Óâ°Ğ¢Æ”v&FVå6÷VæB‚'6VÆV7B"“°Ğ¢6WDÖVçT÷Vâ†fÇ6R“°Ğ¢VæF–ætv&FVäVçG'•&Vbæ7W'&VçBÒfÇ6S°Ğ¢×ĞĞ¢öå6V7F–öä6†ævS×²‡6V7F–öâ’Óâ°Ğ¢Æ”v&FVå6÷VæB‚'6VÆV7B"“°Ğ¢–b‡6V7F–öâÓÓÒ&wV–FR"’6WDwV–FT–æ—F–Å6†VÆb‚&†öÖR"“°Ğ¢6WDÖVçU6V7F–öâ‡6V7F–öâ“°Ğ¢×ĞĞ¢öåf—6—D†W&—FvS×²†w&–E‚Âw&–E’’Óâ°Ğ¢Æ”v&FVå6÷VæB‚'6VÆV7B"“°Ğ¢6WDÖVçT÷Vâ†fÇ6R“°Ğ¢6WD–çfVçF÷'”÷Vâ†fÇ6R“°Ğ¢6WEv÷&ÆB‚&6öÖ×Væ—G’"“°Ğ¢6WDFÆ5F&vWB‡°Ğ¢w&–E‚ÀĞ¢w&–E’ÀĞ¢Æ&VÃ¢'–÷W"†W&—FvRfÆ÷vW""ÀĞ¢&WVW7D–C¢FFRææ÷r‚’ÀĞ¢¶–æC¢&†W&—FvR"ÀĞ¢Ò“°Ğ¢×ĞĞ¢öåf—6—D†&—FC×²†w&–E‚Âw&–E’’Óâ°¢Æ”v&FVå6÷VæB‚'6VÆV7B"“°Ğ¢6WDÖVçT÷Vâ†fÇ6R“°Ğ¢6WD–çfVçF÷'”÷Vâ†fÇ6R“°Ğ¢6WEv÷&ÆB‚'W'6öæÂ"“°Ğ¢v–æF÷rç6WEF–ÖV÷WB€Ğ¢‚’Óâ6çf5&Vbæ7W'&VçCòævõFôw&–E÷6—F–öâ†w&–E‚Âw&–E’’ÀĞ¢ƒÀĞ¢“°Ğ¢×Ğ¢öåf–Wt6öÖ×Væ—G”v&FVã×¶÷Vä6öÖ×Væ—G•&W6VçFF–öçĞ¢óà ¢Ä6öÖ×Væ—G”v&FVå&W6VçFF–öà¢÷Vã×¶6öÖ×Væ—G•&W6VçFF–öä÷VçĞ¢öä6Æ÷6S×¶6Æ÷6T6öÖ×Væ—G•&W6VçFF–öçĞ¢óà Ğ¢Äv&FVäÖVÖ&W'6†—öffW Ğ¢÷Vã×¶ÖVÖ&W'6†—öffW$÷VçĞĞ¢ÆçFVC×¶×”v&FVâç&Wf–WsòçÆçF–æw5W6VBóòuTU5EõÄåD”äuôÄ”Ô•GĞ¢v&FVåÆçD6÷VçC×¶×”v&FVâçÆçG2æÆVæwF‡ĞĞ¢v&FVåF„6÷VçC×¶×”v&FVâçF‡2æÆVæwF‡ĞĞ¢v&FVäVÆVÖVçD6÷VçC×¶×”v&FVâæVÆVÖVçG2æÆVæwF‡ĞĞ¢6&T&Ææ6S×¶×”v&FVâæ6&T&Ææ6WĞĞ¢Æ–fWF–ÖT6&S×¶×”v&FVâæÆ–fWF–ÖT6&WĞĞ¢7FvS×¶ÖVÖ&W'6†—öffW%7FvWĞĞ¢öä6Æ÷6S×¶F—6Ö—74ÖVÖ&W'6†—öffW'ĞĞ¢6†V6¶÷WD'W7“×¶ÖVÖ&W'6†—6†V6¶÷WD'W7—ĞĞ¢6†V6¶÷WDW'&÷#×¶ÖVÖ&W'6†—6†V6¶÷WDW'&÷'ĞĞ¢66÷VçE&VG“×´&ööÆVâ‡6W76–öâ—ĞĞ¢öäÆFW#×²‚’Óâ°Ğ¢F—6Ö—74ÖVÖ&W'6†—öffW"‚“°Ğ¢–b†ÖVÖ&W'6†—öffW%7FvRÓÒ'6ögB"’6WEv÷&ÆB‚&6öÖ×Væ—G’"“°Ğ¢×ĞĞ¢öä66÷VçC×²‚’Óâ°Ğ¢6WDÖVÖ&W'6†—öffW$÷Vâ†fÇ6R“°Ğ¢6WDÖVÖ&W'6†—6†V6¶÷WDW'&÷"‚""“°Ğ¢6WDÖVçU6V7F–öâ‚&66÷VçB"“°Ğ¢6WDÖVçT÷Vâ‡G'VR“°Ğ¢×ĞĞ¢öä¦ö–ã×²†7&VFVçF–Ç2’Óâfö–B7F'DÖVÖ&W'6†—6†V6¶÷WB†7&VFVçF–Ç2—ĞĞ¢óàĞ Ğ¢Ä†W&—FvTfÆ÷vW$6VÆV'&F–öàĞ¢ÖöÖVçC×·f—6–&ÆT†W&—FvTÖöÖVçGĞĞ¢öä6Æ÷6S×¶F—6Ö—74†W&—FvTÖöÖVçGĞĞ¢öåf—6—C×·f—6—D†W&—FvTÖöÖVçGĞĞ¢öä÷VäwV–FS×²‚’Óâ°Ğ¢F—6Ö—74†W&—FvTÖöÖVçB‚“°Ğ¢6WDÖVçU6V7F–öâ‚&wV–FR"“°Ğ¢6WDÖVçT÷Vâ‡G'VR“°Ğ¢×ĞĞ¢óàĞ¢Ä†W&—FvTfÆ÷vW$F—66÷fW'Ğ¢Væ6÷VçFW#×·f—6–&ÆT†W&—FvTVæ6÷VçFW'ĞĞ¢öä6Æ÷6S×²‚’Óâ6WD†W&—FvTVæ6÷VçFW"†çVÆÂ—ĞĞ¢öä÷VäwV–FS×²‚’Óâ°Ğ¢6WD†W&—FvTVæ6÷VçFW"†çVÆÂ“°Ğ¢6WDÖVçU6V7F–öâ‚&wV–FR"“°Ğ¢6WDÖVçT÷Vâ‡G'VR“°Ğ¢×ĞĞ¢óàĞ¢Äv&FVåVæÆö6´6VÆV'&F–öàĞ¢æ÷F–6S×°Ğ¢f—6–&ÆT†W&—FvTÖöÖVçBÇÀĞ¢f—6–&ÆT†W&—FvTVæ6÷VçFW"ÇÀĞ¢6&T&Æ÷76öÔf÷VæBÇÀĞ¢v&FVåv÷&Ôf÷Væ@Ğ¢òçVÆÀĞ¢¢‡VæÆö6´æ÷F–6W5³ÒóòçVÆÂĞ¢ĞĞ¢FV×÷&'“×²ÖVÖ&W$v&FVçĞĞ¢öä6öçF–çVS×¶F—6Ö—75VæÆö6´æ÷F–6WĞĞ¢öåf–Wtv&FVã×·f–WuVæÆö6´–ä×”v&FVçĞĞ¢óàĞ¢Ä6&T&Æ÷76öÔF—66÷fW'Ğ¢÷Vã×¶6&T&Æ÷76öÔf÷VæGĞĞ¢öä6Æ÷6S×²‚’Óâ6WD6&T&Æ÷76öÔf÷VæB†fÇ6R—ĞĞ¢óàĞ¢Äv&FVåv÷&ÔF—66÷fW'Ğ¢÷Vã×¶v&FVåv÷&Ôf÷VæGĞĞ¢öä6Æ÷6S×²‚’Óâ6WDv&FVåv÷&Ôf÷VæB†fÇ6R—ĞĞ¢óàĞ¢ÄÆ—f–ætv&FVäF—66÷fW'”ÖöFÀĞ¢F—66÷fW'“×·f—6–&ÆTÆ—f–ætv&FVäF—66÷fW'—ĞĞ¢öä6Æ÷6S×²‚’Óâ°Ğ¢–b‡f—6–&ÆTÆ—f–ætv&FVäF—66÷fW'’’°Ğ¢6¶æ÷vÆVFvTÆ—f–ætv&FVâ‡f—6–&ÆTÆ—f–ætv&FVäF—66÷fW'’æ†&—FD¶W’“°Ğ¢ĞĞ¢×ĞĞ¢öåvF6ƒ×²‚’Óâ°Ğ¢–b‚f—6–&ÆTÆ—f–ætv&FVäF—66÷fW'’’&WGW&ã°Ğ¢6¶æ÷vÆVFvTÆ—f–ætv&FVâ‡f—6–&ÆTÆ—f–ætv&FVäF—66÷fW'’æ†&—FD¶W’“°Ğ¢6WEv÷&ÆB‚'W'6öæÂ"“°Ğ¢v–æF÷rç6WEF–ÖV÷WB€Ğ¢‚’ÓàĞ¢6çf5&Vbæ7W'&VçCòævõFôw&–E÷6—F–öâ€Ğ¢f—6–&ÆTÆ—f–ætv&FVäF—66÷fW'’æf—'7D6VçFW%‚ÀĞ¢f—6–&ÆTÆ—f–ætv&FVäF—66÷fW'’æf—'7D6VçFW%’ÀĞ¢’ÀĞ¢ƒÀĞ¢“°Ğ¢×ĞĞ¢öä÷VäwV–FS×²‚’Óâ°Ğ¢–b‡f—6–&ÆTÆ—f–ætv&FVäF—66÷fW'’’°Ğ¢6¶æ÷vÆVFvTÆ—f–ætv&FVâ‡f—6–&ÆTÆ—f–ætv&FVäF—66÷fW'’æ†&—FD¶W’“°Ğ¢ĞĞ¢6WDÖVçU6V7F–öâ‚&wV–FR"“°Ğ¢6WDwV–FT–æ—F–Å6†VÆb‚&†&—FG2"“°Ğ¢6WDÖVçT÷Vâ‡G'VR“°Ğ¢×ĞĞ¢óàĞ¢¶v&FVåF6·4÷Vâbb7FWv&G6†—ò€Ğ¢ÆF—`Ğ¢6Æ74æÖSÒ&6r×7FWv&G6†—ÖÖöFÂ×6†VÆÂ Ğ¢&öÆSÒ'&W6VçFF–öâ Ğ¢öäÖ÷W6TF÷vã×²†WfVçB’Óâ°Ğ¢–b†WfVçBçF&vWBÓÓÒWfVçBæ7W'&VçEF&vWB’6WDv&FVåF6·4÷Vâ†fÇ6R“°Ğ¢×ĞĞ¢àĞ¢ÆF—`Ğ¢6Æ74æÖSÒ&6r×7FWv&G6†—ÖÖöFÂ Ğ¢&öÆSÒ&F–Æör Ğ¢&–ÖÖöFÃÒ'G'VR Ğ¢&–ÖÆ&VÃÒ$6öÖ×Væ—G’7FWv&G6†—æBv&FVâF6·2 Ğ¢àĞ¢Æ'WGFöàĞ¢6Æ74æÖSÒ&6r×7FWv&G6†—ÖÖöFÂÖ6Æ÷6R Ğ¢G—SÒ&'WGFöâ Ğ¢&–ÖÆ&VÃÒ$6Æ÷6Rv&FVâF6·2 Ğ¢öä6Æ–6³×²‚’Óâ6WDv&FVåF6·4÷Vâ†fÇ6R—ĞĞ¢àĞ¢6Æ÷6PĞ¢Âö'WGFöãàĞ¢Ä6öÖ×Væ—G•7FWv&G6†—æVÀĞ¢7VÖÖ'“×·7FWv&G6†—ĞĞ¢&WÆ6–æt–C×·&WÆ6–æuF6´–GĞĞ¢öå&WÆ6S×²†76–væÖVçD–B’ÓàĞ¢fö–B&WÆ6U7FWv&G6†—F6²†76–væÖVçD–BĞ¢ĞĞ¢öäæf–vFS×¶æf–vFUFõ7FWv&G6†—ö–çGĞĞ¢fÆ÷vW'5f—6–&ÆS×·6†÷t×”6öÖ×Væ—G”fÆ÷vW'7ĞĞ¢öåFövvÆTfÆ÷vW'3×²‚’ÓàĞ¢6WE6†÷t×”6öÖ×Væ—G”fÆ÷vW'2‚†7W'&VçB’Óâ7W'&VçBĞ¢ĞĞ¢óàĞ¢ÂöF—càĞ¢ÂöF—càĞ¢’¢çVÆÇĞĞ¢Äv&FVåF6´6VÆV'&F–öàĞ¢æ÷F–f–6F–öã×·f—6–&ÆU7FWv&G6†—æ÷F–f–6F–öçĞĞ¢öä6Æ÷6S×²‚’Óâ°Ğ¢–b‡f—6–&ÆU7FWv&G6†—æ÷F–f–6F–öâ’°Ğ¢fö–B6¶æ÷vÆVFvU7FWv&G6†—æ÷F–f–6F–öâ€Ğ¢f—6–&ÆU7FWv&G6†—æ÷F–f–6F–öâÀĞ¢“°Ğ¢ĞĞ¢×ĞĞ¢óàĞ¢Äv&FVäW‡ç6–öä6öæf—&ÖF–öà¢÷Vã×¶W‡ç6–öä6öæf—&ÖF–öä÷VçĞ¢6&T6÷7C×·6VÆV7FVDW‡ç6–öä6÷7GĞ¢öä6æ6VÃ×²‚’Óâ6WDW‡ç6–öä6öæf—&ÖF–öä÷Vâ†fÇ6R—ĞĞ¢öä6öæf—&Ó×¶6öæf—&Ôv&FVäW‡ç6–öçĞĞ¢óàĞ¢Äv&FVä6ÆV&–æu&WGW&ä6öæf—&ÖF–öàĞ¢÷Vã×·&WGW&ä6ÆV&–æt÷VçĞĞ¢6&U&VgVæC×·6VÆV7FVDv&FVå&6VÃòæ6&T6÷7BóòĞĞ¢&6VÃ×·6VÆV7FVDv&FVå&6VÇĞĞ¢6öçFVçG3×·6VÆV7FVDv&FVå&6VÄ6öçFVçG7ĞĞ¢W'&÷#×·&WGW&ä6ÆV&–ætW'&÷'ĞĞ¢'W7“×·&WGW&ä6ÆV&–æt'W7—ĞĞ¢öä6æ6VÃ×²‚’Óâ°Ğ¢–b‡&WGW&ä6ÆV&–æt'W7’’&WGW&ã°Ğ¢6WE&WGW&ä6ÆV&–æt÷Vâ†fÇ6R“°Ğ¢6WE&WGW&ä6ÆV&–ætW'&÷"‚""“°Ğ¢×ĞĞ¢öä6öæf—&Ó×²‚’Óâfö–B6öæf—&Õ&WGW&ä6ÆV&–ær‚—ĞĞ¢óàĞ¢ÂöÖ–ãàĞ¢“°Ğ§ĞĞ 