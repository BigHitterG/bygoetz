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
  GuestPreviewLimitError,
  loadGuestGardenPreview,
  markGuestPreviewContinued,
  markGuestSoftPaywallDeclined,
  mutateGuestGarden,
  preserveGuestGardenPreviewForCheckout,
  saveGuestGardenPreview,
  type GuestGardenPreview,
} from "../lib/guestGardenPreview";
import { GardenControlsDock } from "./GardenControlsDock";
import { GardenCareHud } from "./GardenCareHud";
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
import { GardenHouseBadgeModal } from "./GardenHouseInterior";
import {
  buildGuestGardenHouseState,
  isGardenHouseDisplayUnread,
  type GardenHouseDisplayKey,
  type GardenHouseState,
} from "../lib/gardenHouse";

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
  personalMapParcels: [],
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
      house: GardenHouseState;
      admin?: boolean;
    };

type MembershipOfferStage = "soft" | "hard";

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
  const [gardenMapOpen, setGardenMapOpen] = useState(false);
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
  const [gardenHouse, setGardenHouse] = useState<GardenHouseState | null>(null);
  const [gardenHouseOpen, setGardenHouseOpen] = useState(false);
  const [gardenHouseDisplayKey, setGardenHouseDisplayKey] =
    useState<GardenHouseDisplayKey | null>(null);
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
  const [returnClearing€›<Í⁄$z{-ÆÈ‹j◊ùVíÊ7Fñˆ‚””“'&V÷˜fR◊FÇ"«¿¢áVíÊ7Fñˆ‚””“&'Vñ∆FW"◊∆6R"b`¢VíÁ6V∆V7FVEFˆˆ¬””“'FÇ"ê¢Ú&6r◊FÇ÷ñ6ˆ‚ ¢¢6r◊∆ÁB÷v«óÇó2“G∑VíÁ6V∆V7FVE∆ÁEGóW÷ ¢–¢&ñ÷ÜñFFV„“'G'VR ¢Û‡¢ê¢–¢ˆ‰÷◊≤Çí”‚∞¢6WD÷VÁT˜V‚Üf«6Rì∞¢6WDñÁfVÁF˜'î˜V‚Üf«6Rì∞¢6WDv&FV‰÷˜V‚áG'VRì∞¢∆îv&FVÂ6˜VÊBÇ'6V∆V7B"ì∞¢◊–¢ˆ‰ñÁfVÁF˜'ì◊≤Çí”‚∞¢ñbÇñÁfVÁF˜'î˜V‚í˜V‰ñÁfVÁF˜'îf˜$ˆÊ&ˆ&FñÊrÇì∞¢V«6R∞¢ñbÜˆÊ&ˆ&FñÊu∆ÁE6V∆V7FñˆÂ&WVó&VBí&WGW&„∞¢6WDñÁfVÁF˜'î˜V‚Üf«6Rì∞¢ñbáv˜&∆B””“'W'6ˆÊ¬"ífˆñB6∂Ê˜v∆VFvTñÁfVÁF˜'ïVÊ∆ˆ6∑2Çì∞¢–¢◊–¢ˆ‰v&FV„◊∑7vóF6Öv˜&∆G–¢ˆ‰7Fñˆ„◊∑W&f˜&’6V∆V7FVD7FñˆÁ–¢Û‡†–¢∑v˜&∆B””“'W'6ˆÊ¬"bb6W76ñˆ‚bb66˜VÁD6ÜV6∂VBbb÷V÷&W$v&FV‚ÚÄ–¢∆Fó`–¢6∆74Ê÷S◊∂6r÷'Vñ∆FW"◊Fˆˆ«2G∑VíÊ'Vñ∆FW"Ê7FófRÚ"ó2÷7FófR"¢"'÷––¢‡–¢∆'WGFˆ‡–¢6∆74Ê÷S“&6r÷'Vñ∆FW"◊Fˆvv∆R –¢GóS“&'WGFˆ‚ –¢&ñ◊&W76VC◊∑VíÊ'Vñ∆FW"Ê7FófW––¢Fó6&∆VC◊≤VíÊ'Vñ∆FW"Ê7FófRbbVíÊ'Vñ∆FW"Ê6‰VÁFW'––¢FóF∆S◊∞–¢VíÊ'Vñ∆FW"Ê7FófP–¢Ú$6∆˜6R'Vñ∆FW"÷ˆFR –¢¢VíÊ'Vñ∆FW"ÊÜV«W%FWá@–¢––¢ˆ‰6∆ñ6≥◊≤Çí”‚∞–¢∆îv&FVÂ6˜VÊBÇ'6V∆V7B"ì∞–¢6Áf5&VbÊ7W'&VÁCÚÁFˆvv∆T'Vñ∆FW$÷ˆFRÇì∞–¢◊––¢‡–¢«7‚6∆74Ê÷S“&6r÷'Vñ∆FW"÷ñ6ˆ‚"&ñ÷ÜñFFV„“'G'VR"Û‡–¢«7„Á∑VíÊ'Vñ∆FW"Ê7FófRÚ$FˆÊR"¢$'Vñ∆FW"'”¬˜7„‡–¢¬ˆ'WGFˆ„‡–¢≤VíÊ'Vñ∆FW"Ê7FófRbb∆ÊE6ÜñÊuVÊ∆ˆ6∂VBÚÄ¢«6÷∆¬6∆74Ê÷S“&6r÷∆ÊB◊6ÜñÊr÷ÜñÁB#‡¢6ÜR∆ÊBBÜV«W ¢¬˜6÷∆√‡¢í¢ÁV∆«–¢∂6Â&WGW&Â6V∆V7FVD6∆V&ñÊrÚÄ–¢∆'WGFˆ‡–¢6∆74Ê÷S“&6r◊&WGW&‚÷6∆V&ñÊr÷'WGFˆ‚ –¢GóS“&'WGFˆ‚ –¢FóF∆S“%&WGW&‚FÜó2V◊Gí6∆V&ñÊrFÚFÜRf˜&W7B –¢ˆ‰6∆ñ6≥◊≤Çí”‚∞–¢6WE&WGW&‰6∆V&ñÊtW'&˜"Ç""ì∞–¢6WE&WGW&‰6∆V&ñÊt˜V‚áG'VRì∞–¢∆îv&FVÂ6˜VÊBÇ'6V∆V7B"ì∞–¢◊––¢‡¢«7„Â&WGW&‚&6V√¬˜7„‡¢¬ˆ'WGFˆ„‡¢í¢ÁV∆«––¢∑VíÊ'Vñ∆FW"Ê7FófRÚÄ–¢∆Fó`–¢6∆74Ê÷S“&6r÷'Vñ∆FW"÷VFóB÷6ˆÁG&ˆ«2 –¢&ˆ∆S“&w&˜W –¢&ñ÷∆&V√“$'Vñ∆FW"7G&ñÊr6ˆÁG&ˆ«2 –¢‡–¢∆˜WGWC‡–¢∑VíÊ'Vñ∆FW"Ê∆VÊwFá“˜∑VíÊ'Vñ∆FW"Ê÷Ñ∆VÊwFá––¢¬ˆ˜WGWC‡–¢∆'WGFˆ‡–¢GóS“&'WGFˆ‚ –¢Fó6&∆VC◊∑VíÊ'Vñ∆FW"Ê∆VÊwFÇ√“––¢ˆ‰6∆ñ6≥◊≤Çí”‚6Áf5&VbÊ7W'&VÁCÚÁVÊFÙ'Vñ∆FW%7FWÇó––¢‡–¢VÊF–¢¬ˆ'WGFˆ„‡–¢∆'WGFˆ‡–¢GóS“&'WGFˆ‚ –¢Fó6&∆VC◊∑VíÊ'Vñ∆FW"Ê∆VÊwFÇ√“––¢ˆ‰6∆ñ6≥◊≤Çí”‚6Áf5&VbÊ7W'&VÁCÚÊ6∆V$'Vñ∆FW"Çó––¢‡–¢6∆V –¢¬ˆ'WGFˆ„‡–¢¬ˆFóc‡–¢í¢ÁV∆«––¢¬ˆFóc‡–¢í¢ÁV∆«––†–¢«6∆74Ê÷S“&6r◊7"◊7FGW2"&ñ÷∆ófS“'ˆ∆óFR#Á∑VíÊ÷W76vW”¬˜‡–¢«6∆74Ê÷S“&6r◊7"◊7FGW2"&ñ÷∆ófS“'ˆ∆óFR#Á∂6&TÊÊ˜VÊ6V÷VÁG”¬˜‡–¢∑&W7F˜&T÷W76vRÚÄ–¢« –¢6∆74Ê÷S◊∂6r◊&W7F˜&R◊7FGW2G∞–¢&W7F˜&T÷W76vRÁ7F'G5vóFÇÇ%&W7F˜&ñÊr"í«¿–¢&W7F˜&T÷W76vRÁ7F'G5vóFÇÇ$v&FV‚6ˆÊÊV7Fñˆ‚ñÁFW''WFVB"ê–¢Ú" –¢¢"ó2÷W'&˜" –¢÷––¢&ˆ∆S“'7FGW2 –¢‡–¢∑&W7F˜&T÷W76vW––¢¬˜‡–¢í¢ÁV∆«––†–¢∂w&˜vñÊtVFvTñÁG&Ù˜V‚b`¢v˜&∆B””“&6ˆ÷◊VÊóGí"b`¢GWF˜&ñƒ÷Fñ÷÷VBb`¢6Ü˜t6ˆ÷◊VÊóGïVñ6µ7F'D6ˆ◊∆WFRb`¢÷VÁT˜V‚b`¢ñÁfVÁF˜'î˜V‚b`–¢÷V÷&W'6ÜóˆffW$˜V‚ÚÄ–¢∆6ñFR6∆74Ê÷S“&6r÷w&˜vñÊr÷VFvR÷ñÁG&Ú"&ˆ∆S“&Fñ∆ˆr"&ñ÷÷ˆF√“&f«6R#‡–¢«‰Ü˜rFÜR6Ü&VBv&FV‚w&˜w3¬˜‡–¢∆É#‰w&˜rg&ˆ“FÜRÜV'B¬˜WGv&C¬ˆÉ#‡–¢«7„‡–¢FVWw&VV‚ó2FÜRW7F&∆ó6ÜVBv&FV‚ÜV'B‚óG2∆R˜WFW"w&˜wFÄ–¢&ñÊró2˜V‚∆ÊBvÜW&RFÜRÊWáB6ˆÊÊV7FVB∆ñW"6‚f˜&“‚vˆ∆FV‡–¢F∆ˆ6∑2÷&≤gWGW&Rw&˜vñÊrVFvR∆ÊBf÷F6É∂˜"v&FV‚ÁóvÜW&Rñ˜R∆ñ∂R‡–¢¬˜7„‡–¢∆'WGFˆ‚GóS“&'WGFˆ‚"ˆ‰6∆ñ6≥◊≤Çí”‚6WDw&˜vñÊtVFvTñÁG&Ù˜V‚Üf«6Ró”‡–¢v˜Bó@–¢¬ˆ'WGFˆ„‡–¢¬ˆ6ñFS‡–¢í¢ÁV∆«––†–¢∂w&˜vñÊtVFvTÊ˜Fñ6Rb`–¢w&˜vñÊtVFvTñÁG&Ù˜V‚b`–¢÷VÁT˜V‚b`–¢ñÁfVÁF˜'î˜V‚b`–¢÷V÷&W'6ÜóˆffW$˜V‚ÚÄ–¢∆6ñFR6∆74Ê÷S“&6r÷w&˜vñÊr÷VFvR÷Ê˜Fñ6R"&ˆ∆S“'7FGW2#‡–¢«7‚6∆74Ê÷S“&6r÷w&˜vñÊr÷VFvR◊7&˜WB"&ñ÷ÜñFFV„“'G'VR"Û‡–¢«7„Á∂w&˜vñÊtVFvTÊ˜Fñ6W”¬˜7„‡–¢¬ˆ6ñFS‡–¢í¢ÁV∆«––†–¢ƒv&FV‰ˆÊ&ˆ&FñÊp¢7FW◊∑v˜&∆B””“&Ü˜W6R"«¬Vñ6µ7F'E∆ÁEVÊFñÊrÚÁV∆¬¢ˆÊ&ˆ&FñÊu7FW–¢6ˆ÷◊VÊóGïVñ6µ7F'C◊∂6ˆ÷◊VÊóGïVñ6µ7F'G––¢6ˆ÷◊VÊóGï∆ÁFñÊw3◊∂6ˆ÷◊VÊóGîˆÊ&ˆ&FñÊu∆ÁFñÊw7––¢ñÁfVÁF˜'î˜V„◊∂ñÁfVÁF˜'î˜VÁ––¢∆ÁD7FñˆÂ&VGì◊∂ˆÊ&ˆ&FñÊu∆ÁD7FñˆÂ&VGó––¢vFW$7FñˆÂ&VGì◊∂ˆÊ&ˆ&FñÊuvFW$7FñˆÂ&VGó––¢ˆ‰˜V‰ñÁfVÁF˜'ì◊∂˜V‰ñÁfVÁF˜'îf˜$ˆÊ&ˆ&FñÊw––¢ˆ‰˜V‰◊îv&FV„◊≤Çí”‚∞–¢G&Á6óFñˆ‰ˆÊ&ˆ&FñÊrÇ'W'6ˆÊ¬÷ñÁfVÁF˜'í"¬≤&◊í÷v&FV‚%“ì∞–¢fˆñBG&6¥&6ñƒgVÊÊVƒWfVÁBÇ&◊ïˆv&FVÂˆVÁFW&VB"ì∞–¢6WEv˜&∆BÇ'W'6ˆÊ¬"ì∞–¢◊––¢Û‡–†–¢∑v˜&∆B””“&6ˆ÷◊VÊóGí"bb6Ü˜t6ˆ÷◊VÊóGïVñ6µ7F'D6ˆ◊∆WFRÚÄ¢∆6ñFP¢6∆74Ê÷S“&6r÷g&VR◊∆ÁFñÊr÷Ê˜Fñ6Ró2÷6ˆ÷◊VÊóGí÷6ˆ◊∆WFR ¢&ˆ∆S“'7FGW2 ¢&ñ÷∆ófS“'ˆ∆óFR ¢‡¢∆'WGFˆ‡¢6∆74Ê÷S“&6r÷6ˆ÷◊VÊóGí÷6ˆ◊∆WFR÷6∆˜6R ¢GóS“&'WGFˆ‚ ¢&ñ÷∆&V√“$6∆˜6RvV∆6ˆ÷R÷W76vR ¢ˆ‰6∆ñ6≥◊≤Çí”‚6WE6Ü˜t6ˆ÷◊VÊóGïVñ6µ7F'D6ˆ◊∆WFRÜf«6Ró–¢‡¢≤%«SCr'–¢¬ˆ'WGFˆ„‡¢«7G&ˆÊsÂñ˜R&R'BˆbFÜRv&FV‚„¬˜7G&ˆÊs‡¢«7„‡¢6ˆÊw&GV∆FñˆÁ2‚ñ˜W"GvÚf∆˜vW'2&Rw&˜vñÊrÜW&RvóFÄ¢WfW'ñˆÊRV«6Rf˜3∑2‡¢¬˜7„‡¢∆V”Â6W&ñ˜W6«û(	GFÜÊ≤ñ˜Rf˜"∆ÁFñÊr„¬ˆV”‡¢¬ˆ6ñFS‡¢í¢ÁV∆«––†–¢∑v˜&∆B””“'W'6ˆÊ¬"bb6Ü˜tg&VU∆ÁFñÊtÊ˜Fñ6RÚÄ–¢∆6ñFR6∆74Ê÷S“&6r÷g&VR◊∆ÁFñÊr÷Ê˜Fñ6R"&ˆ∆S“'7FGW2#‡–¢«7G&ˆÊsÂñ˜W"fó'7Bf∆˜vW"ó2∆ÁFVB„¬˜7G&ˆÊs‡–¢«7„‰fVV¬g&VRFÚ∆ÁB÷˜&RÊB'&ÊvRFÜRv&FV‚ñ˜W"ví„¬˜7„‡–¢¬ˆ6ñFS‡–¢í¢ÁV∆«––¢¬˜6V7Fñˆ„‡–†–¢∑v˜&∆B””“&6ˆ÷◊VÊóGí"ÚƒgWGW&TE6∆˜B∆&V√◊∂D∆&V«“Û‚¢ÁV∆«–†¢∂v&FV‰Ü˜W6T˜V‚bb7FófTv&FV‰Ü˜W6TFó7∆íÚÄ¢ƒv&FV‰Ü˜W6T&FvT÷ˆF¿¢Fó7∆ì◊∂7FófTv&FV‰Ü˜W6TFó7∆ó–¢ˆ‰6∆˜6S◊∂6∆˜6Tv&FV‰Ü˜W6W–¢Û‡¢í¢ÁV∆«–†¢ƒv&FV‰÷VÁP¢˜V„◊∂÷VÁT˜VÁ––¢6V7Fñˆ„◊∂÷VÁU6V7FñˆÁ––¢VFñÛ◊∂v&FV‰VFñ˜–¢÷ˆFS◊∑v˜&∆G–¢∆ñfWFñ÷T6&S◊∂◊îv&FV‚Ê∆ñfWFñ÷T6&W–¢vñgE&WfñWs◊∂vWDwVW7E&WfñWtñ◊˜'BÜwVW7E&WfñWró–¢∆ófñÊtv&FV‰Fó66˜fW&ñW3◊∂÷V÷&W$v&FV„ÚÊ∆ófñÊtv&FV‰Fó66˜fW&ñW2ÛÚµ◊–¢∆ófñÊtv&FV‰Ü&óFG3◊∂÷V÷&W$v&FV„ÚÊ∆ófñÊtv&FV‰Ü&óFG2ÛÚµ◊––¢wVñFTñÊóFñ≈6ÜV∆c◊∂wVñFTñÊóFñ≈6ÜV∆g––¢ˆ‰6∆˜6S◊≤Çí”‚∞–¢∆îv&FVÂ6˜VÊBÇ'6V∆V7B"ì∞–¢6WD÷VÁT˜V‚Üf«6Rì∞–¢VÊFñÊtv&FV‰VÁG'ï&VbÊ7W'&VÁB“f«6S∞–¢◊––¢ˆÂ6V7Fñˆ‰6ÜÊvS◊≤á6V7Fñˆ‚í”‚∞–¢∆îv&FVÂ6˜VÊBÇ'6V∆V7B"ì∞–¢ñbá6V7Fñˆ‚””“&wVñFR"í6WDwVñFTñÊóFñ≈6ÜV∆bÇ&Üˆ÷R"ì∞–¢6WD÷VÁU6V7Fñˆ‚á6V7Fñˆ‚ì∞–¢◊––¢ˆÂfó6óDÜW&óFvS◊≤Üw&ñEÇ¬w&ñEíí”‚∞–¢∆îv&FVÂ6˜VÊBÇ'6V∆V7B"ì∞–¢6WD÷VÁT˜V‚Üf«6Rì∞–¢6WDñÁfVÁF˜'î˜V‚Üf«6Rì∞–¢6WEv˜&∆BÇ&6ˆ÷◊VÊóGí"ì∞–¢6WDF∆5F&vWBá∞–¢w&ñEÇ¿–¢w&ñEí¿–¢∆&V√¢'ñ˜W"ÜW&óFvRf∆˜vW""¿–¢&WVW7DñC¢FFRÊÊ˜rÇí¿–¢∂ñÊC¢&ÜW&óFvR"¿–¢“ì∞–¢◊––¢ˆÂfó6óDÜ&óFC◊≤Üw&ñEÇ¬w&ñEíí”‚∞¢∆îv&FVÂ6˜VÊBÇ'6V∆V7B"ì∞–¢6WD÷VÁT˜V‚Üf«6Rì∞–¢6WDñÁfVÁF˜'î˜V‚Üf«6Rì∞–¢6WEv˜&∆BÇ'W'6ˆÊ¬"ì∞–¢vñÊF˜rÁ6WEFñ÷V˜WBÄ–¢Çí”‚6Áf5&VbÊ7W'&VÁCÚÊvıFÙw&ñE˜6óFñˆ‚Üw&ñEÇ¬w&ñEíí¿–¢É¿¢ì∞¢◊–¢ˆ‰÷V÷&W'6Üó7FófFVC◊≤Çí”‚∞¢VÊFñÊtv&FV‰VÁG'ï&VbÊ7W'&VÁB“G'VS∞¢6WD÷VÁT˜V‚Üf«6Rì∞¢6WEv˜&∆BÇ'W'6ˆÊ¬"ì∞¢6WE&W7F˜&T÷W76vRÇ$vñgB66WFVB‚&W7F˜&ñÊrñ˜W"6fVBv&FVÓ(
b"ì∞¢6WD÷V÷&W'6Üó&V∆ˆEFˆ∂V‚ÇÜ7W'&VÁBí”‚7W'&VÁB≤ì∞¢◊–¢ˆÂfñWt6ˆ÷◊VÊóGîv&FV„◊∂˜V‰6ˆ÷◊VÊóGï&W6VÁFFñˆÁ–¢Û‡†¢ƒ6ˆ÷◊VÊóGîv&FVÂ&W6VÁFFñˆ‡¢˜V„◊∂6ˆ÷◊VÊóGï&W6VÁFFñˆ‰˜VÁ–¢ˆ‰6∆˜6S◊∂6∆˜6T6ˆ÷◊VÊóGï&W6VÁFFñˆÁ–¢Û‡†–¢ƒv&FV‰÷V÷&W'6ÜóˆffW –¢˜V„◊∂÷V÷&W'6ÜóˆffW$˜VÁ––¢∆ÁFVC◊∂◊îv&FV‚Á&WfñWsÚÁ∆ÁFñÊw5W6VBÛÚuTU5EıƒÂDî‰uÙƒî‘ïG–¢v&FVÂ∆ÁD6˜VÁC◊∂◊îv&FV‚Á∆ÁG2Ê∆VÊwFá––¢v&FVÂFÑ6˜VÁC◊∂◊îv&FV‚ÁFá2Ê∆VÊwFá––¢v&FV‰V∆V÷VÁD6˜VÁC◊∂◊îv&FV‚ÊV∆V÷VÁG2Ê∆VÊwFá––¢6&T&∆Ê6S◊∂◊îv&FV‚Ê6&T&∆Ê6W––¢∆ñfWFñ÷T6&S◊∂◊îv&FV‚Ê∆ñfWFñ÷T6&W––¢7FvS◊∂÷V÷&W'6ÜóˆffW%7FvW––¢ˆ‰6∆˜6S◊∂Fó6÷ó74÷V÷&W'6ÜóˆffW'––¢6ÜV6∂˜WD'W7ì◊∂÷V÷&W'6Üó6ÜV6∂˜WD'W7ó––¢6ÜV6∂˜WDW'&˜#◊∂÷V÷&W'6Üó6ÜV6∂˜WDW'&˜'––¢66˜VÁE&VGì◊¥&ˆˆ∆V‚á6W76ñˆ‚ó––¢ˆ‰∆FW#◊≤Çí”‚∞–¢Fó6÷ó74÷V÷&W'6ÜóˆffW"Çì∞–¢ñbÜ÷V÷&W'6ÜóˆffW%7FvR”“'6ˆgB"í6WEv˜&∆BÇ&6ˆ÷◊VÊóGí"ì∞–¢◊––¢ˆ‰66˜VÁC◊≤Çí”‚∞–¢6WD÷V÷&W'6ÜóˆffW$˜V‚Üf«6Rì∞–¢6WD÷V÷&W'6Üó6ÜV6∂˜WDW'&˜"Ç""ì∞–¢6WD÷VÁU6V7Fñˆ‚Ç&66˜VÁB"ì∞–¢6WD÷VÁT˜V‚áG'VRì∞–¢◊––¢ˆ‰¶ˆñ„◊≤Ü7&VFVÁFñ«2í”‚fˆñB7F'D÷V÷&W'6Üó6ÜV6∂˜WBÜ7&VFVÁFñ«2ó––¢Û‡–†–¢ƒÜW&óFvTf∆˜vW$6V∆V'&Fñˆ‡–¢÷ˆ÷VÁC◊∑fó6ñ&∆TÜW&óFvT÷ˆ÷VÁG––¢ˆ‰6∆˜6S◊∂Fó6÷ó74ÜW&óFvT÷ˆ÷VÁG––¢ˆÂfó6óC◊∑fó6óDÜW&óFvT÷ˆ÷VÁG––¢ˆ‰˜V‰wVñFS◊≤Çí”‚∞–¢Fó6÷ó74ÜW&óFvT÷ˆ÷VÁBÇì∞–¢6WD÷VÁU6V7Fñˆ‚Ç&wVñFR"ì∞–¢6WD÷VÁT˜V‚áG'VRì∞–¢◊––¢Û‡–¢ƒÜW&óFvTf∆˜vW$Fó66˜fW'ê–¢VÊ6˜VÁFW#◊∑fó6ñ&∆TÜW&óFvTVÊ6˜VÁFW'––¢ˆ‰6∆˜6S◊≤Çí”‚6WDÜW&óFvTVÊ6˜VÁFW"ÜÁV∆¬ó––¢ˆ‰˜V‰wVñFS◊≤Çí”‚∞–¢6WDÜW&óFvTVÊ6˜VÁFW"ÜÁV∆¬ì∞–¢6WD÷VÁU6V7Fñˆ‚Ç&wVñFR"ì∞–¢6WD÷VÁT˜V‚áG'VRì∞–¢◊––¢Û‡–¢ƒv&FVÂVÊ∆ˆ6¥6V∆V'&Fñˆ‡–¢Ê˜Fñ6S◊∞–¢fó6ñ&∆TÜW&óFvT÷ˆ÷VÁB«¿–¢fó6ñ&∆TÜW&óFvTVÊ6˜VÁFW"«¿–¢6&T&∆˜76ˆ‘f˜VÊB«¿–¢v&FVÂv˜&‘f˜VÊ@–¢ÚÁV∆¿–¢¢áVÊ∆ˆ6¥Ê˜Fñ6W5≥“ÛÚÁV∆¬ê–¢––¢FV◊˜&'ì◊≤÷V÷&W$v&FVÁ––¢ˆ‰6ˆÁFñÁVS◊∂Fó6÷ó75VÊ∆ˆ6¥Ê˜Fñ6W––¢ˆÂfñWtv&FV„◊∑fñWuVÊ∆ˆ6¥ñ‰◊îv&FVÁ––¢Û‡–¢ƒ6&T&∆˜76ˆ‘Fó66˜fW'ê–¢˜V„◊∂6&T&∆˜76ˆ‘f˜VÊG––¢ˆ‰6∆˜6S◊≤Çí”‚6WD6&T&∆˜76ˆ‘f˜VÊBÜf«6Ró––¢Û‡–¢ƒv&FVÂv˜&‘Fó66˜fW'ê–¢˜V„◊∂v&FVÂv˜&‘f˜VÊG––¢ˆ‰6∆˜6S◊≤Çí”‚6WDv&FVÂv˜&‘f˜VÊBÜf«6Ró––¢Û‡–¢ƒ∆ófñÊtv&FV‰Fó66˜fW'î÷ˆF¿–¢Fó66˜fW'ì◊∑fó6ñ&∆T∆ófñÊtv&FV‰Fó66˜fW'ó––¢ˆ‰6∆˜6S◊≤Çí”‚∞–¢ñbáfó6ñ&∆T∆ófñÊtv&FV‰Fó66˜fW'íí∞–¢6∂Ê˜v∆VFvT∆ófñÊtv&FV‚áfó6ñ&∆T∆ófñÊtv&FV‰Fó66˜fW'íÊÜ&óFD∂Wíì∞–¢––¢◊––¢ˆÂvF6É◊≤Çí”‚∞–¢ñbÇfó6ñ&∆T∆ófñÊtv&FV‰Fó66˜fW'íí&WGW&„∞–¢6∂Ê˜v∆VFvT∆ófñÊtv&FV‚áfó6ñ&∆T∆ófñÊtv&FV‰Fó66˜fW'íÊÜ&óFD∂Wíì∞–¢6WEv˜&∆BÇ'W'6ˆÊ¬"ì∞–¢vñÊF˜rÁ6WEFñ÷V˜WBÄ–¢Çí”‡–¢6Áf5&VbÊ7W'&VÁCÚÊvıFÙw&ñE˜6óFñˆ‚Ä–¢fó6ñ&∆T∆ófñÊtv&FV‰Fó66˜fW'íÊfó'7D6VÁFW%Ç¿–¢fó6ñ&∆T∆ófñÊtv&FV‰Fó66˜fW'íÊfó'7D6VÁFW%í¿–¢í¿–¢É¿–¢ì∞–¢◊––¢ˆ‰˜V‰wVñFS◊≤Çí”‚∞–¢ñbáfó6ñ&∆T∆ófñÊtv&FV‰Fó66˜fW'íí∞–¢6∂Ê˜v∆VFvT∆ófñÊtv&FV‚áfó6ñ&∆T∆ófñÊtv&FV‰Fó66˜fW'íÊÜ&óFD∂Wíì∞–¢––¢6WD÷VÁU6V7Fñˆ‚Ç&wVñFR"ì∞–¢6WDwVñFTñÊóFñ≈6ÜV∆bÇ&Ü&óFG2"ì∞–¢6WD÷VÁT˜V‚áG'VRì∞–¢◊––¢Û‡–¢∂v&FVÂF6∑4˜V‚bb7FWv&G6ÜóÚÄ–¢∆Fó`–¢6∆74Ê÷S“&6r◊7FWv&G6Üó÷÷ˆF¬◊6ÜV∆¬ –¢&ˆ∆S“'&W6VÁFFñˆ‚ –¢ˆ‰÷˜W6TF˜v„◊≤ÜWfVÁBí”‚∞–¢ñbÜWfVÁBÁF&vWB””“WfVÁBÊ7W'&VÁEF&vWBí6WDv&FVÂF6∑4˜V‚Üf«6Rì∞–¢◊––¢‡–¢∆Fó`–¢6∆74Ê÷S“&6r◊7FWv&G6Üó÷÷ˆF¬ –¢&ˆ∆S“&Fñ∆ˆr –¢&ñ÷÷ˆF√“'G'VR –¢&ñ÷∆&V√“$6ˆ÷◊VÊóGí7FWv&G6ÜóÊBv&FV‚F6∑2 –¢‡–¢∆'WGFˆ‡–¢6∆74Ê÷S“&6r◊7FWv&G6Üó÷÷ˆF¬÷6∆˜6R –¢GóS“&'WGFˆ‚ –¢&ñ÷∆&V√“$6∆˜6Rv&FV‚F6∑2 –¢ˆ‰6∆ñ6≥◊≤Çí”‚6WDv&FVÂF6∑4˜V‚Üf«6Ró––¢‡–¢6∆˜6P–¢¬ˆ'WGFˆ„‡–¢ƒ6ˆ÷◊VÊóGï7FWv&G6ÜóÊV¿–¢7V÷÷'ì◊∑7FWv&G6Üó––¢&W∆6ñÊtñC◊∑&W∆6ñÊuF6¥ñG––¢ˆÂ&W∆6S◊≤Ü76ñvÊ÷VÁDñBí”‡–¢fˆñB&W∆6U7FWv&G6ÜóF6≤Ü76ñvÊ÷VÁDñBê–¢––¢ˆ‰ÊfñvFS◊∂ÊfñvFUFı7FWv&G6ÜóˆñÁG––¢f∆˜vW'5fó6ñ&∆S◊∑6Ü˜t◊î6ˆ÷◊VÊóGîf∆˜vW'7––¢ˆÂFˆvv∆Tf∆˜vW'3◊≤Çí”‡–¢6WE6Ü˜t◊î6ˆ÷◊VÊóGîf∆˜vW'2ÇÜ7W'&VÁBí”‚7W'&VÁBê–¢––¢Û‡–¢¬ˆFóc‡–¢¬ˆFóc‡–¢í¢ÁV∆«––¢ƒv&FVÂF6¥6V∆V'&Fñˆ‡–¢Ê˜Fñfñ6Fñˆ„◊∑fó6ñ&∆U7FWv&G6ÜóÊ˜Fñfñ6FñˆÁ––¢ˆ‰6∆˜6S◊≤Çí”‚∞–¢ñbáfó6ñ&∆U7FWv&G6ÜóÊ˜Fñfñ6Fñˆ‚í∞–¢fˆñB6∂Ê˜v∆VFvU7FWv&G6ÜóÊ˜Fñfñ6Fñˆ‚Ä–¢fó6ñ&∆U7FWv&G6ÜóÊ˜Fñfñ6Fñˆ‚¿–¢ì∞–¢––¢◊––¢Û‡–¢ƒv&FV‰WáÁ6ñˆ‰6ˆÊfó&÷Fñˆ‡¢˜V„◊∂WáÁ6ñˆ‰6ˆÊfó&÷Fñˆ‰˜VÁ–¢6&T6˜7C◊∑6V∆V7FVDWáÁ6ñˆ‰6˜7G–¢ˆ‰6Ê6V√◊≤Çí”‚6WDWáÁ6ñˆ‰6ˆÊfó&÷Fñˆ‰˜V‚Üf«6Ró––¢ˆ‰6ˆÊfó&”◊∂6ˆÊfó&‘v&FV‰WáÁ6ñˆÁ––¢Û‡–¢ƒv&FV‰6∆V&ñÊu&WGW&‰6ˆÊfó&÷Fñˆ‡–¢˜V„◊∑&WGW&‰6∆V&ñÊt˜VÁ––¢6&U&VgVÊC◊∑6V∆V7FVDv&FVÂ&6V√ÚÊ6&T6˜7BÛÚ––¢&6V√◊∑6V∆V7FVDv&FVÂ&6V«––¢6ˆÁFVÁG3◊∑6V∆V7FVDv&FVÂ&6Vƒ6ˆÁFVÁG7––¢W'&˜#◊∑&WGW&‰6∆V&ñÊtW'&˜'––¢'W7ì◊∑&WGW&‰6∆V&ñÊt'W7ó––¢ˆ‰6Ê6V√◊≤Çí”‚∞–¢ñbá&WGW&‰6∆V&ñÊt'W7íí&WGW&„∞–¢6WE&WGW&‰6∆V&ñÊt˜V‚Üf«6Rì∞–¢6WE&WGW&‰6∆V&ñÊtW'&˜"Ç""ì∞–¢◊––¢ˆ‰6ˆÊfó&”◊≤Çí”‚fˆñB6ˆÊfó&’&WGW&‰6∆V&ñÊrÇó––¢Û‡–¢¬ˆ÷ñ„‡–¢ì∞–ß––