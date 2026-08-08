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
  const adLabel = process.env.NEXT_PUBLIC_COMMUNITY_GARDEN_AD_PLACEHOLDER;
  const captureMyGarden = useCallback((scope: GardenShareScope) => {
    return canvasRef.current?.captureGarden(scope) ?? Promise.resolve(null);
  }, []);

  const closeCommunityPresentation = useCallback(() => {
    setCommunityPresentationOpen(false);
    if (
      presentationFullscreenRequestedRef.current &&
      document.fullscreenElement
    ) {
      void document.exitFullscreen().catch(() => undefined);
    }
    presentationFullscreenRequestedRef.current = false;
  }, []);

  const openCommunityPresentation = useCallback(() => {
    setMenuOpen(false);
    setInventoryOpen(false);
    setWorld("community");
    setCommunityPresentationOpen(true);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      presentationFullscreenRequestedRef.current = true;
      void document.documentElement.requestFullscreen().catch(() => {
        presentationFullscreenRequestedRef.current = false;
      });
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (
        communityPresentationOpen &&
        presentationFullscreenRequestedRef.current &&
        !document.fullscreenElement
      ) {
        presentationFullscreenRequestedRef.current = false;
        setCommunityPresentationOpen(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [communityPresentationOpen]);
  const myGarden = memberGarden ?? guestPreview.garden;
  const communityOnboardingPlantingTarget = communityQuickStart
    ? COMMUNITY_FAST_START_PLANTINGS
    : COMMUNITY_CLASSIC_ONBOARDING_PLANTINGS;
  const selectedGardenParcel =
    world === "personal" &&
    memberGarden &&
    ui.selectedGridX !== null &&
    ui.selectedGridY !== null
      ? (memberGarden.unlockedParcels ?? []).find(
          (parcel) =>
            Math.floor(ui.selectedGridX! / 4) === parcel.parcelX &&
            Math.floor(ui.selectedGridY! / 4) === parcel.parcelY,
        ) ?? null
      : null;
  const landShapingUnlocked = Boolean(memberGarden?.freeformExpansion);
  const landReturnUnlocked = Boolean(memberGarden?.landReturnUnlocked);
  const canReturnSelectedClearing =
    landReturnUnlocked &&
    Boolean(selectedGardenParcel) &&
    selectedGardenParcel?.source !== "starter" &&
    (selectedGardenParcel?.purchaseOrdinal ?? 0) > 5 &&
    !ui.builder.active;
  const selectedGardenParcelContents = useMemo(() => {
    if (!selectedGardenParcel || !memberGarden) return null;
    const contains = (gridX: number, gridY: number) =>
      gridX >= selectedGardenParcel.minX &&
      gridX < selectedGardenParcel.minX + selectedGardenParcel.width &&
      gridY >= selectedGardenParcel.minY &&
      gridY < selectedGardenParcel.minY + selectedGardenParcel.height;
    const plants = memberGarden.plants.filter((plant) =>
      contains(plant.gridX, plant.gridY),
    ).length;
    const paths = memberGarden.paths.filter((path) =>
      contains(path.gridX, path.gridY),
    ).length;
    const items = memberGarden.elements.filter((element) =>
      contains(element.gridX, element.gridY),
    ).length;
    return { plants, paths, items, total: plants + paths + items };
  }, [memberGarden, selectedGardenParcel]);
  const canvasGarden = useMemo<MyGardenState>(() => {
    const useShapedLand = Boolean(memberGarden?.freeformExpansion);
    const reclaimCandidates = memberGarden?.reclaimCandidates ?? [];
    return {
      ...myGarden,
      freeformExpansion: useShapedLand,
      nextExpansion: useShapedLand ? null : myGarden.nextExpansion,
      expansionCandidates: useShapedLand
        ? [...reclaimCandidates, ...(myGarden.expansionCandidates ?? [])]
        : [],
      selectedParcel:
        selectedGardenParcel?.source !== "starter"
          ? selectedGardenParcel ?? undefined
          : undefined,
    };
  }, [
    memberGarden,
    myGarden,
    selectedGardenParcel,
  ]);
  const selectedExpansionCost = useMemo(() => {
    if (ui.selectedGridX === null || ui.selectedGridY === null) return 0;
    const containsSelection = (parcel: {
      minX: number;
      minY: number;
      width: number;
      height: number;
    }) =>
      ui.selectedGridX! >= parcel.minX &&
      ui.selectedGridX! < parcel.minX + parcel.width &&
      ui.selectedGridY! >= parcel.minY &&
      ui.selectedGridY! < parcel.minY + parcel.height;
    const exactParcel = canvasGarden.expansionCandidates?.find(containsSelection);
    if (exactParcel) return exactParcel.careCost;
    return canvasGarden.nextExpansion &&
      containsSelection(canvasGarden.nextExpansion)
      ? canvasGarden.nextExpansion.careCost
      : 0;
  }, [
    canvasGarden.expansionCandidates,
    canvasGarden.nextExpansion,
    ui.selectedGridX,
    ui.selectedGridY,
  ]);
  const unreadUnlockCount = memberGarden
    ? getMyGardenUnreadUnlockCount(
        memberGarden.inventorySeenLifetimeCare,
        memberGarden.lifetimeCare,
      )
    : 0;
  const showMyGardenUnlockNotice =
    world === "community" && unreadUnlockCount > 0;
  const onboardingPlantActionReady =
    ui.action === "plant" && ui.actionEnabled;
  const showQuickStartPlantActionCue =
    communityQuickStart &&
    onboardingStep === "community-tile" &&
    communityOnboardingPlantings === 1 &&
    onboardingPlantActionReady;
  const onboardingWaterActionReady =
    ui.action === "water" && ui.actionEnabled;
  const showMyGardenInvitation =
    world === "community" &&
    !memberGarden &&
    communityOnboardingPlantings >= communityOnboardingPlantingTarget &&
    onboardingStep !== "community-water" &&
    !isGardenOnboardingFinished(onboardingStep);
  const myGardenTutorialLocked =
    !memberGarden &&
    Boolean(onboardingStep) &&
    !isGardenOnboardingFinished(onboardingStep) &&
    onboardingStep !== "my-garden" &&
    (communityOnboardingPlantings < communityOnboardingPlantingTarget ||
      onboardingStep === "community-water");
  const communityGardenTutorialLocked =
    world === "personal" &&
    !memberGarden &&
    Boolean(onboardingStep) &&
    !isGardenOnboardingFinished(onboardingStep);
  const onboardingInventoryLocked =
    Boolean(onboardingStep) && !isGardenOnboardingFinished(onboardingStep);
  const onboardingPlantSelectionRequired =
    onboardingStep === "select-seed" ||
    onboardingStep === "personal-seed";
  const tutorialMapDimmed =
    Boolean(onboardingStep) && !isGardenOnboardingFinished(onboardingStep);
  const tutorialActionAllowed =
    !tutorialMapDimmed ||
    ((onboardingStep === "community-tile" || onboardingStep === "personal-tile") &&
      ui.action === "plant") ||
    (onboardingStep === "community-water" && ui.action === "water");
  const showContinueGardenGuidance =
    world === "personal" &&
    !memberGarden &&
    guestPreview.access?.softPaywallDeclined === true &&
    guestPreview.access.continuedAfterSoftPaywall !== true;
  const showMembershipShortcut =
    accountChecked &&
    !memberGarden &&
    guestPreview.access?.softPaywallDeclined === true;
  const showMyGardenGrowthNudge =
    world === "community" &&
    showMembershipShortcut &&
    isGardenOnboardingFinished(onboardingStep) &&
    (myGarden.preview?.plantingsUsed ?? 0) <
      (myGarden.preview?.plantingLimit ?? 10) &&
    myGarden.careBalance >= myGarden.plantCost;
  const visibleHeritageMoment =
    !menuOpen &&
    !inventoryOpen &&
    !membershipOfferOpen &&
    !expansionConfirmationOpen &&
    !returnClearingOpen &&
    !gardenTasksOpen &&
    !careBlossomFound &&
    !gardenWormFound &&
    unlockNotices.length === 0
      ? (heritageMoments[0] ?? null)
      : null;
  const visibleHeritageEncounter =
    heritageMoments.length === 0 &&
    !menuOpen &&
    !inventoryOpen &&
    !membershipOfferOpen &&
    !expansionConfirmationOpen &&
    !returnClearingOpen &&
    !gardenTasksOpen &&
    !careBlossomFound &&
    !gardenWormFound &&
    unlockNotices.length === 0
      ? heritageEncounter
      : null;
  const visibleLivingGardenDiscovery =
    heritageMoments.length === 0 &&
    !heritageEncounter &&
    !menuOpen &&
    !inventoryOpen &&
    !membershipOfferOpen &&
    !expansionConfirmationOpen &&
    !returnClearingOpen &&
    !gardenTasksOpen &&
    !careBlossomFound &&
    !gardenWormFound &&
    unlockNotices.length === 0
      ? (memberGarden?.livingGardenDiscoveries ?? []).find(
          (discovery) => !discovery.acknowledgedAt,
        ) ?? null
      : null;
  const visibleStewardshipNotification =
    heritageMoments.length === 0 &&
    !heritageEncounter &&
    !visibleLivingGardenDiscovery &&
    !menuOpen &&
    !inventoryOpen &&
    !membershipOfferOpen &&
    !expansionConfirmationOpen &&
    !returnClearingOpen &&
    !gardenTasksOpen &&
    !careBlossomFound &&
    !gardenWormFound &&
    unlockNotices.length === 0
      ? (stewardship?.notifications[0] ?? null)
      : null;

  useEffect(() => {
    if (!inventoryAudioReadyRef.current) {
      inventoryAudioReadyRef.current = true;
      return;
    }
    playGardenSound("inventory");
  }, [inventoryOpen, playGardenSound]);

  useEffect(() => {
    const activeNotice = unlockNotices[0];
    const activeKey = activeNotice ? getUnlockNoticeKey(activeNotice) : null;
    if (!activeKey || activeKey === unlockAudioKeyRef.current) return;
    unlockAudioKeyRef.current = activeKey;
    playGardenSound("unlock");
  }, [playGardenSound, unlockNotices]);

  useEffect(() => {
    if (
      !visibleHeritageMoment ||
      visibleHeritageMoment.eventId === heritageAudioKeyRef.current
    ) {
      return;
    }
    heritageAudioKeyRef.current = visibleHeritageMoment.eventId;
    playGardenSound("unlock");
  }, [playGardenSound, visibleHeritageMoment]);

  const queueHeritageMoments = useCallback((incoming: HeritageMoment[]) => {
    const fresh = incoming.filter((moment) => {
      if (heritageMomentIdsRef.current.has(moment.eventId)) return false;
      heritageMomentIdsRef.current.add(moment.eventId);
      return true;
    });
    if (fresh.length === 0) return;
    heritageEncounterClaimedRef.current = true;
    markHeritageFlowerDiscoverySeen();
    setHeritageEncounter(null);
    setHeritageMoments((current) =>
      mergeHeritageMomentQueue(current, fresh),
    );
  }, []);

  const discoverHeritageFlower = useCallback(
    (encounter: HeritageFlowerEncounter) => {
      if (
        heritageEncounterClaimedRef.current ||
        !isGardenOnboardingFinished(onboardingStep)
      ) {
        return;
      }
      heritageEncounterClaimedRef.current = true;
      if (!claimFirstHeritageFlowerDiscovery()) return;
      setHeritageEncounter(encounter);
    },
    [onboardingStep],
  );

  const flushHeritageAcknowledgements = useCallback(
    async (activeSession: Session) => {
      const notificationIds = Array.from(
        heritageAcknowledgementIdsRef.current,
      ).slice(0, 20);
      if (notificationIds.length === 0) return;
      try {
        const response = await fetch(
          "/api/community-garden/heritage-notifications",
          {
            method: "POST",
            cache: "no-store",
            headers: {
              authorization: `Bearer ${activeSession.access_token}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ notificationIds }),
          },
        );
        if (!response.ok) return;
        for (const notificationId of notificationIds) {
          heritageAcknowledgementIdsRef.current.delete(notificationId);
        }
      } catch {
        // The next account refresh retries acknowledgement without blocking play.
      }
    },
    [],
  );

  const loadHeritageNotifications = useCallback(
    async (activeSession: Session) => {
      void flushHeritageAcknowledgements(activeSession);
      try {
        const response = await fetch(
          "/api/community-garden/heritage-notifications",
          {
            cache: "no-store",
            headers: {
              authorization: `Bearer ${activeSession.access_token}`,
            },
          },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as { notifications?: unknown };
        queueHeritageMoments(
          parseHeritageMoments(payload.notifications, "planter"),
        );
      } catch {
        // Heritage news is durable on the server and can arrive after reconnecting.
      }
    },
    [flushHeritageAcknowledgements, queueHeritageMoments],
  );

  const commitGuestPreview = useCallback((next: GuestGardenPreview) => {
    guestPreviewRef.current = next;
    setGuestPreview(next);
    saveGuestGardenPreview(next);
  }, []);

  const clearMembershipRetry = useCallback(() => {
    if (membershipRetryTimerRef.current !== null) {
      window.clearTimeout(membershipRetryTimerRef.current);
      membershipRetryTimerRef.current = null;
    }
  }, []);

  const scheduleMembershipRetry = useCallback(() => {
    clearMembershipRetry();
    const delay = Math.min(
      1_500 * 2 ** membershipRetryAttemptRef.current,
      MEMBERSHIP_RETRY_MAX_DELAY_MS,
    );
    membershipRetryAttemptRef.current += 1;
    membershipRetryTimerRef.current = window.setTimeout(() => {
      membershipRetryTimerRef.current = null;
      setMembershipReloadToken((current) => current + 1);
    }, delay);
  }, [clearMembershipRetry]);

  const startMembershipCheckout = useCallback(async (
    credentials: GardenMembershipCredentials,
  ) => {
    const promoCode = credentials.promoCode?.trim().toLowerCase();
    const pendingPreview = {
      ...guestPreviewRef.current,
      journey: {
        world,
        mapX: ui.mapX,
        mapY: ui.mapY,
        zoom: ui.zoom,
        selectedTool: ui.selectedTool,
      },
    } satisfies GuestGardenPreview;
    guestPreviewRef.current = pendingPreview;
    setGuestPreview(pendingPreview);
    preserveGuestGardenPreviewForCheckout(pendingPreview);
    setMembershipCheckoutBusy(true);
    setMembershipCheckoutError("");

    try {
      const checkoutBody = {
        launchSessionId: getBasilLaunchSessionId(),
        preview: getGuestPreviewImport(pendingPreview),
        email: credentials.email,
        password: credentials.password,
        ...(promoCode ? { promoCode } : {}),
      };
      const accessEndpoint = promoCode
        ? "/api/community-garden/promo"
        : "/api/community-garden/checkout";
      let activeSession = session;
      let response = await fetch(accessEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(activeSession
            ? { authorization: `Bearer ${activeSession.access_token}` }
            : {}),
        },
        body: JSON.stringify(checkoutBody),
      });
      if (response.status === 409 && !activeSession) {
        const conflict = (await response.json().catch(() => ({}))) as {
          code?: string;
          error?: string;
        };
        if (conflict.code !== "account_exists") {
          throw new Error(conflict.error ?? "This Basil account cannot start checkout.");
        }

        const client = getGardenAccountClient();
        if (!client) throw new Error("Private Basil accounts are unavailable right now.");
        const { data, error } = await client.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });
        if (error || !data.session) {
          throw new Error(
            error?.message.toLowerCase().includes("email not confirmed")
              ? "This account already exists and still needs email verification. Open Account to resend the confirmation or recover access."
              : "This account already exists. Sign in from Account, or reset its password, before purchasing again.",
          );
        }
        setSession(data.session);
        activeSession = data.session;
        response = await fetch(accessEndpoint, {
          method: "POST",
          headers: {
            authorization: `Bearer ${data.session.access_token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(checkoutBody),
        });
        if (response.status === 409) {
          const active = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          if (active.error?.includes("active Garden Membership")) {
            setMembershipOfferOpen(false);
            setMembershipCheckoutBusy(false);
            setRestoreMessage("Welcome back. Restoring your saved garden…");
            return;
          }
          throw new Error(active.error ?? "This account cannot start checkout.");
        }
      }
      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "Secure checkout could not start."),
        );
      }
      if (promoCode) {
        if (!activeSession) {
          const client = getGardenAccountClient();
          if (!client) {
            throw new Error(
              "Your gift was accepted, but Basil could not sign you in automatically.",
            );
          }
          const { data, error } = await client.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          });
          if (error || !data.session) {
            throw new Error(
              "Your gift was accepted. Open Account and sign in to continue.",
            );
          }
          activeSession = data.session;
          setSession(data.session);
        }
        pendingGardenEntryRef.current = true;
        setWorld("personal");
        setMembershipOfferOpen(false);
        setMembershipCheckoutBusy(false);
        setRestoreMessage("Gift accepted. Restoring your saved garden…");
        setMembershipReloadToken((current) => current + 1);
        return;
      }
      const payload = (await response.json()) as { url?: string; metaEventId?: string };
      if (!payload.url) throw new Error("Stripe did not return a secure checkout page.");
      if (payload.metaEventId) trackBasilMetaCheckout(payload.metaEventId);
      window.location.assign(payload.url);
    } catch (error) {
      setMembershipCheckoutBusy(false);
      setMembershipCheckoutError(
        error instanceof Error ? error.message : "Secure checkout could not start.",
      );
    }
  }, [session, ui.mapX, ui.mapY, ui.selectedTool, ui.zoom, world]);

  const loadMembership = useCallback(async (activeSession: Session) => {
    const cachedGarden = loadMemberGardenCache(activeSession.user.id);
    if (!memberGardenRef.current && cachedGarden) {
      memberGardenRef.current = cachedGarden;
      lifetimeCareRef.current = cachedGarden.lifetimeCare;
      setMemberGarden(cachedGarden);
    }
    try {
      const response = await fetch("/api/community-garden/account", {
        cache: "no-store",
        headers: { authorization: `Bearer ${activeSession.access_token}` },
      });
      if (!response.ok) {
        if (
          response.status >= 500 ||
          response.status === 408 ||
          response.status === 429
        ) {
          throw new Error(`Temporary account service error (${response.status})`);
        }
        clearMembershipRetry();
        membershipRetryAttemptRef.current = 0;
        return memberGardenRef.current;
      }
      const account = (await response.json()) as AccountResponse;
      setInventoryDesignAccess(Boolean(account.admin));
      setStewardship(account.active ? account.stewardship : null);
      let nextGarden = account.active ? account.myGarden : null;
      if (nextGarden) {
        const preview = guestPreviewRef.current;
        const hasTemporaryProgress =
          preview.garden.lifetimeCare > 0 ||
          preview.garden.plants.length > 0 ||
          preview.garden.paths.length > 0;
        if (hasTemporaryProgress) {
          setRestoreMessage("Restoring your garden...");
          try {
            const importResponse = await fetch(
              "/api/community-garden/my-garden",
              {
                method: "POST",
                headers: {
                  authorization: `Bearer ${activeSession.access_token}`,
                  "content-type": "application/json",
                },
                body: JSON.stringify({
                  action: "import-preview",
                  ...getGuestPreviewImport(preview),
                }),
              },
            );
            if (importResponse.ok) {
              nextGarden = (await importResponse.json()) as MyGardenState;
              clearGuestGardenPreview();
              const emptyPreview = createGuestGardenPreview();
              guestPreviewRef.current = emptyPreview;
              setGuestPreview(emptyPreview);
              setRestoreMessage("");
            } else {
              setRestoreMessage(
                "Your saved garden is still safe. We will try restoring it again.",
              );
              void trackBasilFunnelEvent("garden_restoration_failed", {
                failure_stage: "preview_import",
                error_code: `http_${importResponse.status}`,
              });
            }
          } catch (error) {
            // Keep the temporary preview available for a later retry.
            console.error("Basil guest garden restoration failed", {
              message: error instanceof Error ? error.message : "Unknown error",
            });
            setRestoreMessage(
              "Your saved garden is still safe. We will try restoring it again.",
            );
            void trackBasilFunnelEvent("garden_restoration_failed", {
              failure_stage: "preview_import",
              error_code: "network_or_unknown",
            });
          }
        }
      }
      clearMembershipRetry();
      membershipRetryAttemptRef.current = 0;
      lifetimeCareRef.current = nextGarden?.lifetimeCare ?? 0;
      memberGardenRef.current = nextGarden;
      setMemberGarden(nextGarden);
      if (nextGarden) {
        const outstanding = getOutstandingUnlockCelebrations(
          activeSession.user.id,
          nextGarden.lifetimeCare,
        );
        if (outstanding.length > 0) {
          setUnlockNotices((current) => {
            const queuedKeys = new Set(current.map(getUnlockNoticeKey));
            return [
              ...current,
              ...outstanding.filter(
                (notice) => !queuedKeys.has(getUnlockNoticeKey(notice)),
              ),
            ];
          });
        }
      }
      saveMemberGardenCache(activeSession.user.id, nextGarden);
      setRestoreMessage((current) =>
        current ===
        "Garden connection interrupted. Your saved garden is safe; reconnecting…"
          ? ""
          : current,
      );
      if (nextGarden && pendingGardenEntryRef.current) {
        pendingGardenEntryRef.current = false;
        setMenuOpen(false);
        setWorld("personal");
      }
      return nextGarden;
    } catch (error) {
      console.error("Basil membership lookup temporarily failed", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
      setRestoreMessage(
        "Garden connection interrupted. Your saved garden is safe; reconnecting…",
      );
      scheduleMembershipRetry();
      return memberGardenRef.current ?? cachedGarden;
    } finally {
      setAccountChecked(true);
    }
  }, [clearMembershipRetry, scheduleMembershipRetry]);

  useEffect(() => {
    memberGardenRef.current = memberGarden;
    if (session && memberGarden) {
      saveMemberGardenCache(session.user.id, memberGarden);
    }
  }, [memberGarden, session]);

  useEffect(
    () => () => {
      clearMembershipRetry();
    },
    [clearMembershipRetry],
  );

  useEffect(() => {
    void trackBasilFunnelEvent("session_started");
  }, []);

  useEffect(() => {
    if (ui.connection === "connecting") return;
    void trackBasilFunnelEvent("garden_loaded");
    trackBasilMetaStandardEvent("ViewContent", "view_content", {
      content_name: "Basil Community Garden",
    });
  }, [ui.connection]);

  useEffect(() => {
    if (!membershipOfferOpen) return;
    trackBasilMetaCustomMilestone("BasilPaywallViewed", "paywall_viewed");
    if (membershipOfferStage === "soft") {
      void trackBasilFunnelEvent("paywall_viewed");
      void trackBasilFunnelEvent("soft_paywall_viewed");
    } else if (membershipOfferStage === "hard") {
      void trackBasilFunnelEvent("preview_limit_reached");
      void trackBasilFunnelEvent("hard_paywall_viewed");
    } else {
      void trackBasilFunnelEvent("preview_expired");
    }
  }, [membershipOfferOpen, membershipOfferStage]);

  useEffect(() => {
    if (world !== "personal") return;
    void trackBasilFunnelEvent("my_garden_entered");
    trackBasilMetaCustomMilestone("BasilMyGardenEntered", "my_garden_entered");
  }, [world]);

  useEffect(() => {
    queueMicrotask(() => {
      const storedPreview = loadGuestGardenPreview();
      guestPreviewRef.current = storedPreview;
      setGuestPreview(storedPreview);
      setGuestPreviewReady(true);
    });
  }, []);

  const transitionOnboarding = useCallback(
    (next: GardenOnboardingStep, from?: GardenOnboardingStep[]) => {
      setOnboardingStep((current) => {
        if (isGardenOnboardingFinished(current)) return current;
        if (from && (!current || !from.includes(current))) return current;
        saveGardenOnboardingStep(next);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    const sendPulse = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      const lastPulse = Number(window.sessionStorage.getItem(HEALTH_PULSE_KEY));
      if (Number.isFinite(lastPulse) && now - lastPulse < HEALTH_PULSE_INTERVAL_MS) {
        return;
      }
      window.sessionStorage.setItem(HEALTH_PULSE_KEY, String(now));
      void fetch("/api/community-garden/health/pulse", {
        method: "POST",
        cache: "no-store",
        keepalive: true,
      }).catch(() => {
        window.sessionStorage.removeItem(HEALTH_PULSE_KEY);
      });
    };

    sendPulse();
    const interval = window.setInterval(sendPulse, HEALTH_PULSE_INTERVAL_MS);
    document.addEventListener("visibilitychange", sendPulse);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", sendPulse);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const updateViewport = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      root.style.setProperty("--basil-viewport-height", `${Math.round(height)}px`);
    };
    const onOrientationChange = () => {
      updateViewport();
      window.setTimeout(updateViewport, 250);
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", onOrientationChange);
    window.visualViewport?.addEventListener("resize", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", onOrientationChange);
      window.visualViewport?.removeEventListener("resize", updateViewport);
      root.style.removeProperty("--basil-viewport-height");
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchaseEventId = params.get("meta_purchase_event_id");
    if (purchaseEventId && trackBasilMetaPurchase(purchaseEventId)) {
      params.delete("meta_purchase_event_id");
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
      );
    }
    if (params.has("steward") || params.has("checkout")) {
      queueMicrotask(() => {
        setMenuSection("account");
        setMenuOpen(true);
        if (params.get("steward") === "welcome") {
          pendingGardenEntryRef.current = true;
        }
      });
    }
  }, []);

  useEffect(() => {
    const client = getGardenAccountClient();
    if (!client) {
      queueMicrotask(() => setAccountChecked(true));
      return;
    }

    void client.auth
      .getSession()
      .then(({ data }) => {
        sessionUserIdRef.current = data.session?.user.id ?? null;
        setSession(data.session);
        if (!data.session) setAccountChecked(true);
      })
      .catch(() => setAccountChecked(true));

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        clearMembershipRetry();
        if (sessionUserIdRef.current) {
          saveMemberGardenCache(sessionUserIdRef.current, null);
        }
        sessionUserIdRef.current = null;
        lifetimeCareRef.current = 0;
        memberGardenRef.current = null;
        setMemberGarden(null);
        setStewardship(null);
        setGardenTasksOpen(false);
        setShowMyCommunityFlowers(false);
        setInventoryDesignAccess(false);
        heritageMomentIdsRef.current.clear();
        heritageAcknowledgementIdsRef.current.clear();
        setHeritageMoments([]);
        setWorld("community");
        setAccountChecked(true);
      } else {
        sessionUserIdRef.current = nextSession.user.id;
        setAccountChecked(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [clearMembershipRetry]);

  useEffect(() => {
    if (!guestPreviewReady || !session) return;
    queueMicrotask(() => void loadMembership(session));
  }, [guestPreviewReady, loadMembership, membershipReloadToken, session]);

  useEffect(() => {
    if (!session) return;
    const activeSession = session;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      void loadHeritageNotifications(activeSession);
    };
    refresh();
    const intervalId = window.setInterval(
      refresh,
      HERITAGE_NOTIFICATION_REFRESH_MS,
    );
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadHeritageNotifications, session]);

  useEffect(() => {
    if (!onboardingInventoryLocked) return;
    if (
      ui.selectedTool === "rose" ||
      ui.selectedTool === "sunflower" ||
      ui.selectedTool === "lavender"
    ) {
      return;
    }
    canvasRef.current?.selectPlant("rose");
  }, [onboardingInventoryLocked, ui.selectedTool]);

  useEffect(() => {
    if (
      !communityQuickStart ||
      !onboardingStep ||
      isGardenOnboardingFinished(onboardingStep) ||
      communityOnboardingPlantings >= communityOnboardingPlantingTarget
    ) {
      return;
    }
    const quickStartPlant = getCommunityQuickStartPlantType(
      getBasilLaunchSessionId(),
    );
    if (!quickStartPlantTrackedRef.current) {
      quickStartPlantTrackedRef.current = true;
      void trackBasilFunnelEvent("plant_selected");
    }
    if (ui.selectedTool === quickStartPlant) return;
    canvasRef.current?.selectPlant(quickStartPlant);
  }, [
    communityOnboardingPlantings,
    communityOnboardingPlantingTarget,
    communityQuickStart,
    onboardingStep,
    ui.selectedTool,
  ]);

  useEffect(() => {
    if (
      !guestPreviewReady ||
      !accountChecked ||
      ui.connection === "connecting" ||
      onboardingStep
    ) {
      return;
    }

    const stored = classicOnboardingRequested
      ? null
      : loadGardenOnboardingStep();
    const storedCommunityPlantings = classicOnboardingRequested
      ? 0
      : loadCommunityOnboardingPlantings();
    communityOnboardingPlantingsRef.current = storedCommunityPlantings;
    let next = stored;
    const previewPlantings =
      guestPreviewRef.current.garden.preview?.plantingsUsed ?? 0;
    const useCommunityQuickStart =
      communityQuickStart &&
      !memberGarden &&
      !isGardenOnboardingFinished(stored) &&
      previewPlantings === 0 &&
      storedCommunityPlantings < communityOnboardingPlantingTarget;
    if (memberGarden) {
      next = "complete";
    } else if (useCommunityQuickStart) {
      next = "community-tile";
    } else if (!next) {
      if (previewPlantings > 0) next = "complete";
      else if (
        guestPreviewRef.current.journey?.world === "personal"
      ) {
        next = "personal-inventory";
      } else if (
        storedCommunityPlantings >= COMMUNITY_CLASSIC_ONBOARDING_PLANTINGS
      ) {
        next = "community-water";
      } else if (storedCommunityPlantings > 0) {
        next = "community-tile";
      } else {
        next = "plant";
      }
    } else if (
      !memberGarden &&
      !isGardenOnboardingFinished(next) &&
      storedCommunityPlantings >= COMMUNITY_CLASSIC_ONBOARDING_PLANTINGS &&
      next !== "community-water" &&
      next !== "personal-inventory" &&
      next !== "personal-seed" &&
      next !== "personal-tile"
    ) {
      next = "community-water";
    } else if (next === "community-repeat") {
      next = "community-tile";
    }
    queueMicrotask(() => {
      if (next === "community-water" || useCommunityQuickStart) {
        setWorld("community");
      }
      setCommunityOnboardingPlantings(storedCommunityPlantings);
      saveGardenOnboardingStep(next);
      setOnboardingStep(next);
    });
  }, [
    accountChecked,
    classicOnboardingRequested,
    communityQuickStart,
    communityOnboardingPlantingTarget,
    guestPreviewReady,
    memberGarden,
    onboardingStep,
    ui.connection,
  ]);

  useEffect(() => {
    if (!showFreePlantingNotice) return;
    const timeout = window.setTimeout(() => {
      setShowFreePlantingNotice(false);
    }, 4_500);
    return () => window.clearTimeout(timeout);
  }, [showFreePlantingNotice]);

  useEffect(() => {
    if (!showCommunityQuickStartComplete) return;
    const timeout = window.setTimeout(() => {
      setShowCommunityQuickStartComplete(false);
    }, 6_500);
    return () => window.clearTimeout(timeout);
  }, [showCommunityQuickStartComplete]);

  useEffect(() => {
    const shouldSuggestCommunity =
      onboardingStep === "community-tile" && world === "community";
    const shouldSuggestPersonal =
      onboardingStep === "personal-tile" && world === "personal";
    const shouldSuggestWatering =
      onboardingStep === "community-water" && world === "community";
    if (!shouldSuggestCommunity && !shouldSuggestPersonal && !shouldSuggestWatering) return;
    const frame = window.requestAnimationFrame(() => {
      if (shouldSuggestWatering) canvasRef.current?.suggestWateringSpot();
      else {
        canvasRef.current?.suggestPlantingSpot({
          readyToPlant:
            shouldSuggestCommunity &&
            communityQuickStart &&
            communityOnboardingPlantings === 0,
          keepMaryInPlace: shouldSuggestCommunity && communityQuickStart,
        });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    communityOnboardingPlantings,
    communityQuickStart,
    onboardingStep,
    world,
  ]);

  useEffect(() => {
    if (!guestPreviewReady || memberGarden) return;
    const timeout = window.setTimeout(() => {
      const next = {
        ...guestPreviewRef.current,
        journey: {
          world,
          mapX: ui.mapX,
          mapY: ui.mapY,
          zoom: ui.zoom,
          selectedTool: ui.selectedTool,
        },
      } satisfies GuestGardenPreview;
      guestPreviewRef.current = next;
      setGuestPreview(next);
      saveGuestGardenPreview(next);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [
    guestPreviewReady,
    memberGarden,
    ui.mapX,
    ui.mapY,
    ui.selectedTool,
    ui.zoom,
    world,
  ]);

  useEffect(() => {
    if (
      !guestPreviewReady ||
      restoredJourneyRef.current ||
      !guestPreviewRef.current.journey
    ) {
      return;
    }
    restoredJourneyRef.current = true;
    const journey = guestPreviewRef.current.journey;
    setWorld(journey.world);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        canvasRef.current?.restoreView(
          journey.mapX,
          journey.mapY,
          journey.zoom,
          journey.selectedTool,
        );
      });
    });
  }, [guestPreviewReady]);

  useEffect(() => {
    if (
      !guestPreviewReady ||
      memberGarden ||
      world !== "personal" ||
      guestPreview.garden.plants.length === 0 ||
      !isGuestPreviewExpired(guestPreview)
    ) {
      return;
    }
    let canceled = false;
    queueMicrotask(() => {
      if (canceled) return;
      setMembershipOfferStage("expired");
      setMembershipOfferOpen(true);
    });
    return () => {
      canceled = true;
    };
  }, [guestPreview, guestPreviewReady, memberGarden, world]);

  useEffect(() => {
    if (!guestPreviewReady || session || memberGarden) return;
    const guestId = getBasilLaunchSessionId() ?? "guest";
    const outstanding = getOutstandingUnlockCelebrations(
      guestId,
      guestPreview.garden.lifetimeCare,
    );
    if (outstanding.length === 0) return;
    let canceled = false;
    queueMicrotask(() => {
      if (canceled) return;
      setUnlockNotices((current) => {
        const queuedKeys = new Set(current.map(getUnlockNoticeKey));
        return [
          ...current,
          ...outstanding.filter(
            (notice) => !queuedKeys.has(getUnlockNoticeKey(notice)),
          ),
        ];
      });
    });
    return () => {
      canceled = true;
    };
  }, [
    guestPreview.garden.lifetimeCare,
    guestPreviewReady,
    memberGarden,
    session,
  ]);

  const onStateChange = useCallback((state: GardenUiState) => {
    uiRef.current = state;
    setUi(state);
  }, []);

  useEffect(() => {
    if (
      world !== "community" ||
      !accountChecked ||
      ui.connection === "connecting" ||
      !isGardenOnboardingFinished(onboardingStep) ||
      quickStartCompletedThisSessionRef.current ||
      showCommunityQuickStartComplete
    ) {
      return;
    }
    try {
      if (window.localStorage.getItem(GROWING_EDGE_INTRO_KEY)) return;
      window.localStorage.setItem(GROWING_EDGE_INTRO_KEY, "seen");
    } catch {
      // The explanation can still appear once in this running session.
    }
    queueMicrotask(() => setGrowingEdgeIntroOpen(true));
  }, [
    accountChecked,
    onboardingStep,
    showCommunityQuickStartComplete,
    ui.connection,
    world,
  ]);

  useEffect(() => {
    const regionKey = ui.recentlyOpenedRegionKey;
    if (!regionKey || world !== "community") return;
    try {
      if (window.localStorage.getItem(GROWING_EDGE_OPENED_KEY) === regionKey) {
        return;
      }
      window.localStorage.setItem(GROWING_EDGE_OPENED_KEY, regionKey);
    } catch {
      // The celebration remains harmless if storage is unavailable.
    }
    queueMicrotask(() => {
      setGrowingEdgeNotice(
        "New ground has opened. The community helped this part of Basil take root.",
      );
    });
  }, [ui.recentlyOpenedRegionKey, world]);

  useEffect(() => {
    if (!growingEdgeNotice) return;
    const timeoutId = window.setTimeout(() => setGrowingEdgeNotice(""), 5_500);
    return () => window.clearTimeout(timeoutId);
  }, [growingEdgeNotice]);

  useEffect(() => {
    const nextZone = ui.currentGuidanceZone;
    const previousZone = lastGuidanceZoneRef.current;
    lastGuidanceZoneRef.current = nextZone;
    if (
      world !== "community" ||
      !isGardenOnboardingFinished(onboardingStep) ||
      previousZone === null ||
      previousZone === nextZone
    ) {
      return;
    }
    if (nextZone === "heart") {
      queueMicrotask(() => {
        setGrowingEdgeNotice(
          "Garden Heart: established ground the community has sustained together.",
        );
      });
    } else if (nextZone === "growth-ring") {
      queueMicrotask(() => {
        setGrowingEdgeNotice(
          "Growth Ring: open ground around the Heart where Basil can grow outward.",
        );
      });
    }
  }, [onboardingStep, ui.currentGuidanceZone, world]);

  const claimCommunityContribution = useCallback(
    (contribution: GardenContribution) => {
      if (contribution.stewardship) {
        setStewardship(contribution.stewardship);
      }
      if (
        uiRef.current.currentRegionStage === "edge" ||
        uiRef.current.currentRegionStage === "growing" ||
        uiRef.current.currentRegionStage === "ready"
      ) {
        try {
          if (!window.sessionStorage.getItem(GROWING_EDGE_HELPED_KEY)) {
            window.sessionStorage.setItem(GROWING_EDGE_HELPED_KEY, "seen");
            setGrowingEdgeNotice(
              "You helped the Growing Edge. Shared care helps new garden ground take root.",
            );
          }
        } catch {
          // Care still applies normally when session storage is unavailable.
        }
      }
      const bonusLabel = contribution.specialFlower
        ? `${SPECIAL_WATERING_FLOWER_NAME}! `
        : contribution.gardenWorm
          ? "Garden Worm! "
        : "";
      if (contribution.specialFlower) {
        const shouldShowDiscovery =
          !careBlossomDiscoverySeenRef.current &&
          claimFirstCareBlossomDiscovery();
        careBlossomDiscoverySeenRef.current = true;
        if (shouldShowDiscovery) {
          playGardenSound("blossom");
          setCareBlossomFound(true);
        }
      }
      if (!session || !memberGarden) {
        const currentPreview = guestPreviewRef.current;
        const continuedPreview = markGuestPreviewContinued(currentPreview);
        if (continuedPreview !== currentPreview) {
          void trackBasilFunnelEvent("preview_continued");
        }
        const award = awardGuestCare(
          continuedPreview,
          contribution.careValue,
          contribution.earningPhase,
        );
        const earnedUnlocks = getMyGardenUnlockNotices(
          continuedPreview.garden.lifetimeCare,
          award.preview.garden.lifetimeCare,
        );
        if (earnedUnlocks.length > 0) {
          setUnlockNotices((current) => {
            const queuedKeys = new Set(current.map(getUnlockNoticeKey));
            return [
              ...current,
              ...earnedUnlocks.filter(
                (notice) => !queuedKeys.has(getUnlockNoticeKey(notice)),
              ),
            ];
          });
        }
        commitGuestPreview(award.preview);
        if (award.awardedCare > 0) {
          if (!contribution.specialFlower && !contribution.gardenWorm) {
            playGardenSound("care");
          }
          canvasRef.current?.showCareReward(
            award.awardedCare,
            award.earningMode === "daily",
          );
          setCareAnnouncement(
            `${bonusLabel}${award.awardedCare} temporary Care earned. Your preview balance is ${award.preview.garden.careBalance}.`,
          );
        } else {
          setCareAnnouncement(
            `Care is growing · ${contribution.tierProgress} of ${contribution.actionsRequired} helpful actions.`,
          );
        }
        return;
      }

      if (!contribution.receiptToken || contribution.careValue <= 0) {
        setCareAnnouncement(
          `Care is growing · ${contribution.tierProgress} of ${contribution.actionsRequired} helpful actions.`,
        );
        return;
      }

      const activeSession = session;
      careClaimQueueRef.current = careClaimQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          try {
            const response = await fetchGardenRequest(
              "/api/community-garden/care",
              {
                method: "POST",
                headers: {
                  authorization: `Bearer ${activeSession.access_token}`,
                  "content-type": "application/json",
                },
                body: JSON.stringify({
                  receiptToken: contribution.receiptToken,
                }),
              },
            );
            if (response.status === 401 || response.status === 403) {
              const currentPreview = guestPreviewRef.current;
              const continuedPreview = markGuestPreviewContinued(currentPreview);
              if (continuedPreview !== currentPreview) {
                void trackBasilFunnelEvent("preview_continued");
              }
              const award = awardGuestCare(
                continuedPreview,
                contribution.careValue,
                contribution.earningPhase,
              );
              commitGuestPreview(award.preview);
              if (
                award.awardedCare > 0 &&
                !contribution.specialFlower &&
                !contribution.gardenWorm
              ) {
                playGardenSound("care");
              }
              canvasRef.current?.showCareReward(
                award.awardedCare,
                award.earningMode === "daily",
              );
              setCareAnnouncement(
                `${bonusLabel}${award.awardedCare} temporary Care earned. A Garden Membership saves it.`,
              );
              return;
            }
            if (!response.ok) {
              setCareAnnouncement(
                "Care could not be saved. Please try another garden action.",
              );
              return;
            }
            const award = (await response.json()) as {
              awardedCare: number;
              careBalance: number;
              lifetimeCare: number;
              earningMode: "daily" | "standard";
            };
            const previousLifetimeCare = lifetimeCareRef.current;
            lifetimeCareRef.current = award.lifetimeCare;
            const earnedUnlocks = memberGardenRef.current
              ? getMyGardenUnlockNotices(
                  previousLifetimeCare,
                  award.lifetimeCare,
                )
              : [];
            if (earnedUnlocks.length > 0) {
              setUnlockNotices((current) => {
                const queuedKeys = new Set(current.map(getUnlockNoticeKey));
                return [
                  ...current,
                  ...earnedUnlocks.filter(
                    (notice) => !queuedKeys.has(getUnlockNoticeKey(notice)),
                  ),
                ];
              });
            }
            setMemberGarden((current) => {
              if (!current) return current;
              const updated = {
                ...current,
                careBalance: award.careBalance,
                lifetimeCare: award.lifetimeCare,
              };
              memberGardenRef.current = updated;
              return updated;
            });
            canvasRef.current?.showCareReward(
              award.awardedCare,
              award.earningMode === "daily",
            );
            if (
              award.awardedCare > 0 &&
              !contribution.specialFlower &&
              !contribution.gardenWorm
            ) {
              playGardenSound("care");
            }
            setCareAnnouncement(
              `${bonusLabel}${award.awardedCare} Care saved. Your balance is ${award.careBalance}.`,
            );
          } catch (error) {
            console.warn("Basil Care save was interrupted", {
              online: navigator.onLine,
              visibility: document.visibilityState,
              message: error instanceof Error ? error.message : "Unknown error",
            });
            setCareAnnouncement(
              "Care could not be saved. Please try another garden action.",
            );
          }
        });
    },
    [commitGuestPreview, memberGarden, playGardenSound, session],
  );

  const replaceStewardshipTask = useCallback(
    async (assignmentId: string) => {
      if (!session || !stewardship) return;
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
          throw new Error(
            await getResponseError(response, "That task could not be replaced."),
          );
        }
        setStewardship((await response.json()) as GardenStewardshipSummary);
      } catch (error) {
        setCareAnnouncement(
          error instanceof Error
            ? error.message
            : "That task could not be replaced.",
        );
      } finally {
        setReplacingTaskId(null);
      }
    },
    [session, stewardship],
  );

  const acknowledgeStewardshipNotification = useCallback(
    async (notification: GardenStewardshipNotification) => {
      setStewardship((current) =>
        current
          ? {
              ...current,
              notifications: current.notifications.filter(
                (item) => item.id !== notification.id,
              ),
            }
          : current,
      );
      if (!session) return;
      try {
        const response = await fetch("/api/community-garden/stewardship", {
          method: "POST",
          headers: {
            authorization: `Bearer ${session.access_token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            action: "acknowledge",
            notificationId: notification.id,
          }),
        });
        if (response.ok) {
          setStewardship((await response.json()) as GardenStewardshipSummary);
        }
      } catch {
        // The server will offer the celebration again if acknowledgement fails.
      }
    },
    [session],
  );

  useEffect(() => {
    if (
      !visibleStewardshipNotification ||
      visibleStewardshipNotification.type === "rank_up"
    ) {
      return;
    }
    const notification = visibleStewardshipNotification;
    const timeout = window.setTimeout(() => {
      void acknowledgeStewardshipNotification(notification);
    }, 3200);
    return () => window.clearTimeout(timeout);
  }, [acknowledgeStewardshipNotification, visibleStewardshipNotification]);

  const navigateToStewardshipPoint = useCallback(
    (_target: "recent" | "oldest" | "cluster", point: GardenStewardshipPoint) => {
      setGardenTasksOpen(false);
      setMenuOpen(false);
      setWorld("community");
      window.setTimeout(
        () => canvasRef.current?.goToGridPosition(point.gridX, point.gridY),
        80,
      );
    },
    [],
  );

  const discoverGardenWorm = useCallback(() => {
    let alreadyDiscovered = false;
    try {
      alreadyDiscovered =
        window.localStorage.getItem(GARDEN_WORM_DISCOVERY_KEY) === "seen";
      if (!alreadyDiscovered) {
        window.localStorage.setItem(GARDEN_WORM_DISCOVERY_KEY, "seen");
      }
    } catch {
      // A restricted browser may show the introduction again next visit.
    }
    if (alreadyDiscovered) {
      setCareAnnouncement(
        "Garden Worm found—the rare planting bonus was already added to your Care.",
      );
      return;
    }
    playGardenSound("worm");
    setGardenWormFound(true);
  }, [playGardenSound]);

  const mutateMyGarden = useCallback(
    async (mutation: MyGardenMutation) => {
      if (!memberGarden) {
        try {
          const currentPreview = guestPreviewRef.current;
          const updatedPreview = mutateGuestGarden(currentPreview, mutation);
          const used = updatedPreview.garden.preview?.plantingsUsed ?? 0;
          if (mutation.action === "plant") {
            if (used === 1) {
              void trackBasilFunnelEvent("first_personal_plant");
              transitionOnboarding("complete", [
                "personal-inventory",
                "personal-seed",
                "personal-tile",
              ]);
              setShowFreePlantingNotice(true);
            }
            if (used >= (updatedPreview.garden.preview?.plantingLimit ?? 10)) {
              setMembershipOfferStage("hard");
              setMembershipOfferOpen(true);
            }
          }
          commitGuestPreview(updatedPreview);
          return updatedPreview.garden;
        } catch (error) {
          if (
            error instanceof GuestPreviewLimitError ||
            error instanceof GuestPreviewExpiredError
          ) {
            transitionOnboarding("complete", [
              "personal-inventory",
              "personal-seed",
              "personal-tile",
            ]);
            setMembershipOfferStage(
              error instanceof GuestPreviewExpiredError ? "expired" : "hard",
            );
            setMembershipOfferOpen(true);
          }
          throw error;
        }
      }
      if (!session) throw new Error("Sign in to update My Garden.");
      const response = await fetch("/api/community-garden/my-garden", {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(mutation),
      });
      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "My Garden could not be updated."),
        );
      }
      const updated = (await response.json()) as MyGardenState;
      setMemberGarden(updated);
      return updated;
    },
    [commitGuestPreview, memberGarden, session, transitionOnboarding],
  );

  const acknowledgeLivingGarden = useCallback(
    (habitatKey: LivingGardenHabitatKey) => {
      setMemberGarden((current) =>
        current
          ? {
              ...current,
              livingGardenDiscoveries: (
                current.livingGardenDiscoveries ?? []
              ).map((discovery) =>
                discovery.habitatKey === habitatKey
                  ? { ...discovery, acknowledgedAt: new Date().toISOString() }
                  : discovery,
              ),
            }
          : current,
      );
      if (!session) return;
      void fetch("/api/community-garden/my-garden", {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "acknowledge-habitat", habitatKey }),
      })
        .then(async (response) => {
          if (!response.ok) return;
          const updated = (await response.json()) as MyGardenState;
          setMemberGarden(updated);
        })
        .catch(() => {
          // The server will offer the discovery again next time if acknowledgement fails.
        });
    },
    [session],
  );

  const acknowledgeInventoryUnlocks = useCallback(async () => {
    if (
      !session ||
      !memberGarden ||
      memberGarden.inventorySeenLifetimeCare >= memberGarden.lifetimeCare
    ) {
      return;
    }
    try {
      const response = await fetch("/api/community-garden/my-garden", {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "acknowledge-inventory" }),
      });
      if (!response.ok) return;
      const updated = (await response.json()) as MyGardenState;
      lifetimeCareRef.current = updated.lifetimeCare;
      setMemberGarden(updated);
    } catch {
      // Keep the red indicator so the player can acknowledge it next time.
    }
  }, [memberGarden, session]);

  const switchWorld = useCallback(() => {
    if (ui.builder.active) return;
    if (world === "personal") {
      if (communityGardenTutorialLocked) return;
      if (inventoryOpen) void acknowledgeInventoryUnlocks();
      setInventoryOpen(false);
      playGardenSound("world");
      setWorld("community");
      return;
    }
    if (myGardenTutorialLocked) return;
    setMenuOpen(false);
    setInventoryOpen(false);
    transitionOnboarding("personal-inventory", [
      "plant",
      "select-seed",
      "community-tile",
      "community-repeat",
      "my-garden",
    ]);
    void trackBasilFunnelEvent("my_garden_entered");
    playGardenSound("world");
    setWorld("personal");
  }, [
    acknowledgeInventoryUnlocks,
    communityGardenTutorialLocked,
    inventoryOpen,
    myGardenTutorialLocked,
    playGardenSound,
    transitionOnboarding,
    ui.builder.active,
    world,
  ]);

  const performSelectedAction = useCallback(() => {
    if (
      ui.action === "expand" &&
      ui.actionEnabled &&
      !myGarden.preview &&
      (canvasGarden.nextExpansion || canvasGarden.expansionCandidates?.length)
    ) {
      playGardenSound("select");
      setExpansionConfirmationOpen(true);
      return;
    }
    if (ui.action === "water" && ui.actionEnabled) playGardenSound("water");
    void canvasRef.current?.performAction();
  }, [
    canvasGarden.nextExpansion,
    canvasGarden.expansionCandidates,
    myGarden.preview,
    playGardenSound,
    ui.action,
    ui.actionEnabled,
  ]);

  const confirmGardenExpansion = useCallback(() => {
    setExpansionConfirmationOpen(false);
    void canvasRef.current?.performAction();
  }, []);

  const confirmReturnClearing = useCallback(async () => {
    if (
      !session ||
      !selectedGardenParcel ||
      (selectedGardenParcelContents?.total ?? 0) > 0 ||
      ui.selectedGridX === null ||
      ui.selectedGridY === null
    ) {
      return;
    }
    setReturnClearingBusy(true);
    setReturnClearingError("");
    try {
      const response = await fetch("/api/community-garden/my-garden", {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "return-clearing",
          gridX: ui.selectedGridX,
          gridY: ui.selectedGridY,
        }),
      });
      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "That clearing could not be returned."),
        );
      }
      const updated = (await response.json()) as MyGardenState;
      setMemberGarden(updated);
      setReturnClearingOpen(false);
      setCareAnnouncement(
        selectedGardenParcel.careCost > 0
          ? `${selectedGardenParcel.careCost.toLocaleString()} Care returned. The forest has reclaimed that clearing.`
          : "The forest has reclaimed that clearing.",
      );
    } catch (error) {
      setReturnClearingError(
        error instanceof Error
          ? error.message
          : "That clearing could not be returned.",
      );
    } finally {
      setReturnClearingBusy(false);
    }
  }, [
    selectedGardenParcel,
    selectedGardenParcelContents,
    session,
    ui.selectedGridX,
    ui.selectedGridY,
  ]);

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (expansionConfirmationOpen || returnClearingOpen) return;

      const code = event.code;
      if (code === "Escape" && gardenTasksOpen) {
        event.preventDefault();
        setGardenTasksOpen(false);
        return;
      }
      if (gardenTasksOpen) return;
      if (code === "Escape" && ui.builder.active) {
        event.preventDefault();
        canvasRef.current?.toggleBuilderMode();
        return;
      }
      const inventoryShortcut = code === "KeyQ" || code === "KeyI";
      const gardenShortcut = code === "KeyC" || code === "KeyG";
      if (inventoryShortcut) {
        const inventoryShortcutLocked =
          onboardingInventoryLocked &&
          onboardingStep !== "plant" &&
          onboardingStep !== "personal-inventory";
        if (
          menuOpen ||
          membershipOfferOpen ||
          careBlossomFound ||
          gardenWormFound ||
          expansionConfirmationOpen ||
          returnClearingOpen ||
          unlockNotices.length > 0 ||
          heritageMoments.length > 0 ||
          Boolean(heritageEncounter) ||
          (!inventoryOpen && inventoryShortcutLocked)
        ) {
          return;
        }
        event.preventDefault();
        if (inventoryOpen) {
          setInventoryOpen(false);
          if (world === "personal") void acknowledgeInventoryUnlocks();
        } else {
          transitionOnboarding("select-seed", ["plant"]);
          transitionOnboarding("personal-seed", ["personal-inventory"]);
          setInventoryOpen(true);
          void trackBasilFunnelEvent("inventory_opened");
        }
        return;
      }

      if (gardenShortcut) {
        if (
          menuOpen ||
          membershipOfferOpen ||
          inventoryOpen ||
          careBlossomFound ||
          gardenWormFound ||
          unlockNotices.length > 0 ||
          heritageMoments.length > 0 ||
          Boolean(heritageEncounter)
        ) {
          return;
        }
        event.preventDefault();
        switchWorld();
        return;
      }

      if (code === "KeyE") {
        if (
          menuOpen ||
          membershipOfferOpen ||
          inventoryOpen ||
          careBlossomFound ||
          gardenWormFound ||
          unlockNotices.length > 0 ||
          heritageMoments.length > 0 ||
          Boolean(heritageEncounter) ||
          !tutorialActionAllowed
        ) {
          return;
        }
        event.preventDefault();
        performSelectedAction();
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [
    acknowledgeInventoryUnlocks,
    careBlossomFound,
    gardenWormFound,
    gardenTasksOpen,
    heritageEncounter,
    heritageMoments.length,
    expansionConfirmationOpen,
    returnClearingOpen,
    inventoryOpen,
    ui.builder.active,
    membershipOfferOpen,
    menuOpen,
    onboardingInventoryLocked,
    onboardingStep,
    performSelectedAction,
    switchWorld,
    transitionOnboarding,
    tutorialActionAllowed,
    unlockNotices.length,
    world,
  ]);

  const handleGardenActionCompleted = useCallback(
    (mode: GardenWorldMode, action: GardenUiState["action"]) => {
      if (action === "plant") playGardenSound("plant");
      else if (action === "weed" || action === "uproot") {
        playGardenSound("uproot");
      } else if (action === "lay-path" || action === "remove-path") {
        playGardenSound("path");
      } else if (action === "place-element" || action === "remove-element") {
        playGardenSound("element");
      } else if (action === "builder-place") {
        playGardenSound("builder");
      } else if (action === "builder-remove") {
        playGardenSound("uproot");
      } else if (action === "expand") {
        playGardenSound("expand");
      }
      if (mode === "community" && action === "plant") {
        const isGuidedCommunityPlanting =
          onboardingStep === "plant" ||
          onboardingStep === "select-seed" ||
          onboardingStep === "community-tile" ||
          onboardingStep === "community-repeat";
        if (!isGuidedCommunityPlanting) return;
        const nextPlantings = Math.min(
          communityOnboardingPlantingTarget,
          communityOnboardingPlantingsRef.current + 1,
        );
        communityOnboardingPlantingsRef.current = nextPlantings;
        setCommunityOnboardingPlantings(nextPlantings);
        saveCommunityOnboardingPlantings(nextPlantings);
        if (nextPlantings === 1) {
          void trackBasilFunnelEvent("first_community_plant");
          trackBasilMetaCustomMilestone("BasilFirstPlant", "first_plant");
        } else if (
          nextPlantings === COMMUNITY_CLASSIC_ONBOARDING_PLANTINGS
        ) {
          void trackBasilFunnelEvent("third_community_plant");
        }
        const guidedPlantingSteps: GardenOnboardingStep[] = [
          "plant",
          "select-seed",
          "community-tile",
          "community-repeat",
        ];
        if (
          nextPlantings >= communityOnboardingPlantingTarget &&
          communityQuickStart
        ) {
          quickStartCompletedThisSessionRef.current = true;
          setGrowingEdgeIntroOpen(false);
          transitionOnboarding("complete", guidedPlantingSteps);
          setShowCommunityQuickStartComplete(true);
          setCareAnnouncement(
            "You are part of the garden. Your two community flowers are growing.",
          );
          trackBasilMetaCustomMilestone(
            "BasilCommunityTutorialCompleted",
            "community_tutorial_completed",
          );
        } else {
          transitionOnboarding(
            nextPlantings >= communityOnboardingPlantingTarget
              ? "community-water"
              : "community-tile",
            guidedPlantingSteps,
          );
        }
        window.requestAnimationFrame(() => {
          if (
            nextPlantings >= communityOnboardingPlantingTarget &&
            !communityQuickStart
          ) {
            canvasRef.current?.suggestWateringSpot();
          } else if (nextPlantings < communityOnboardingPlantingTarget) {
            canvasRef.current?.suggestPlantingSpot({
              keepMaryInPlace: communityQuickStart,
            });
          }
        });
      } else if (
        mode === "community" &&
        action === "water" &&
        onboardingStep === "community-water"
      ) {
        transitionOnboarding("my-garden", ["community-water"]);
        trackBasilMetaCustomMilestone(
          "BasilCommunityTutorialCompleted",
          "community_tutorial_completed",
        );
        setCareAnnouncement(
          "Watering learned. Your first My Garden planting is ready.",
        );
      }
    },
    [
      communityQuickStart,
      communityOnboardingPlantingTarget,
      onboardingStep,
      playGardenSound,
      transitionOnboarding,
    ],
  );

  const handleGardenActionFailed = useCallback(
    (mode: GardenWorldMode, action: GardenUiState["action"], error: unknown) => {
      playGardenSound("error");
      void trackBasilFunnelEvent("garden_action_failed", {
        failure_stage: mode,
        error_code:
          error instanceof Error && /network|connect|offline/i.test(error.message)
            ? "connection"
            : action ?? "unknown",
      });
    },
    [playGardenSound],
  );

  function openInventoryForOnboarding() {
    transitionOnboarding("select-seed", ["plant"]);
    transitionOnboarding("personal-seed", ["personal-inventory"]);
    setInventoryOpen(true);
    void trackBasilFunnelEvent("inventory_opened");
  }

  function dismissUnlockNotice() {
    const currentNotice = unlockNotices[0];
    const celebrationOwner =
      session?.user.id ?? getBasilLaunchSessionId() ?? "guest";
    if (currentNotice) {
      const history = getUnlockCelebrationHistory(celebrationOwner);
      history.add(getUnlockNoticeKey(currentNotice));
      saveUnlockCelebrationHistory(celebrationOwner, history);
    }
    setUnlockNotices((current) => current.slice(1));
  }

  function viewUnlockInMyGarden() {
    dismissUnlockNotice();
    setMenuOpen(false);
    setWorld("personal");
    setInventoryOpen(true);
    void trackBasilFunnelEvent("my_garden_entered");
    void trackBasilFunnelEvent("inventory_opened");
  }

  const dismissHeritageMoment = useCallback(() => {
    const current = heritageMoments[0];
    if (current?.notificationId && session) {
      heritageAcknowledgementIdsRef.current.add(current.notificationId);
      void flushHeritageAcknowledgements(session);
    }
    setHeritageMoments((queued) => queued.slice(1));
  }, [flushHeritageAcknowledgements, heritageMoments, session]);

  const visitHeritageMoment = useCallback(() => {
    const current = heritageMoments[0];
    if (!current) return;
    dismissHeritageMoment();
    setMenuOpen(false);
    setInventoryOpen(false);
    setWorld("community");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        canvasRef.current?.goToGridPosition(current.gridX, current.gridY);
      });
    });
  }, [dismissHeritageMoment, heritageMoments]);

  function dismissMembershipOffer() {
    if (membershipOfferStage === "soft") {
      const isFirstDecline =
        guestPreviewRef.current.access?.softPaywallDeclined !== true;
      const declined = markGuestSoftPaywallDeclined(guestPreviewRef.current);
      commitGuestPreview(declined);
      void trackBasilFunnelEvent("soft_paywall_declined");
      if (isFirstDecline) {
        setInventoryOpen(false);
        setWorld("community");
      }
    } else {
      transitionOnboarding("complete");
    }
    setMembershipOfferOpen(false);
  }

  return (
    <main className={`cg-root is-${world}-world`}>
      <section className="cg-game-frame" aria-label="Basil garden game">
        <GardenCanvas
          ref={canvasRef}
          mode={world}
          accountAccessToken={session?.access_token ?? null}
          personalGarden={canvasGarden}
          personalCommunityFlowers={stewardship?.flowers.coordinates ?? []}
          showPersonalCommunityFlowers={showMyCommunityFlowers}
          tutorialDimmed={tutorialMapDimmed}
          tutorialClickHere={
            communityQuickStart &&
            onboardingStep === "community-tile" &&
            communityOnboardingPlantings === 1 &&
            !onboardingPlantActionReady
          }
          onStateChange={onStateChange}
          onCommunityContribution={claimCommunityContribution}
          onGardenWormDiscovered={discoverGardenWorm}
          onHeritageMoments={queueHeritageMoments}
          onHeritageEncounter={discoverHeritageFlower}
          heritageEncountersEnabled={
            accountChecked && isGardenOnboardingFinished(onboardingStep)
          }
          onPersonalGardenMutation={mutateMyGarden}
          onOpenGardenJournal={
            memberGarden
              ? () => {
                  playGardenSound("select");
                  setGuideInitialShelf("habitats");
                  setMenuSection("guide");
                  setMenuOpen(true);
                }
              : undefined
          }
          onActionCompleted={handleGardenActionCompleted}
          onActionFailed={handleGardenActionFailed}
        />

        <header className="cg-titlebar">
          <div className="cg-pixel-rose" aria-hidden="true">
            <span />
          </div>
          <div className="cg-title-copy">
            <h1>Basil</h1>
            <p>
              {world === "personal" ? "My Garden" : "Community Garden"}
              {world === "community" ? (
                <GardenUpdateStatus nextUpdateAt={ui.nextMapUpdateAt} />
              ) : null}
            </p>
          </div>
          <button
            className="cg-icon-button"
            type="button"
            aria-label="Open garden menu"
            onClick={() => {
              playGardenSound("select");
              setMenuOpen(true);
            }}
          >
            <span className="cg-menu-icon" aria-hidden="true" />
          </button>
        </header>

        {world === "community" ? (
          <GardenMapKey
            ui={ui}
            canExpand={Boolean(memberGarden)}
            disabled={tutorialMapDimmed}
            focusTarget={atlasTarget}
            onNavigate={(mapX, mapY) => {
              setAtlasTarget(null);
              canvasRef.current?.goToMapPosition(mapX, mapY);
            }}
            onNavigateGrid={(gridX, gridY) => {
              setAtlasTarget(null);
              canvasRef.current?.goToGridPosition(gridX, gridY);
            }}
          />
        ) : null}

        <div className="cg-zoom-control" role="group" aria-label="Garden zoom">
          <button
            type="button"
            title="Zoom out"
            aria-label="Zoom out to see more of the garden"
            disabled={!ui.canZoomOut || tutorialMapDimmed}
            onClick={() => canvasRef.current?.zoomOut()}
          >
            -
          </button>
          <output aria-label={`Current zoom ${ui.zoom} times`}>{ui.zoom}x</output>
          <button
            type="button"
            title="Zoom in"
            aria-label="Zoom in for a closer garden view"
            disabled={!ui.canZoomIn || tutorialMapDimmed}
            onClick={() => canvasRef.current?.zoomIn()}
          >
            +
          </button>
        </div>

        <div className="cg-garden-top-actions">
          {session && accountChecked && memberGarden ? (
            <GardenBugReporter accessToken={session.access_token} />
          ) : null}
          <button
            className={`cg-compact-support is-garden-switch${
              showMyGardenInvitation ||
              showContinueGardenGuidance ||
              showMyGardenGrowthNudge ||
              showMyGardenUnlockNotice
                ? " is-onboarding-highlight"
                : ""
            }`}
            type="button"
            disabled={
              (world === "community" && myGardenTutorialLocked) ||
              communityGardenTutorialLocked ||
              ui.builder.active
            }
            aria-label={
              world === "personal"
                ? communityGardenTutorialLocked
                  ? "Plant your first rose before returning to Community Garden"
                  : `Go to Community Garden. ${myGarden.careBalance} Care.`
                : myGardenTutorialLocked
                  ? `Plant ${Math.max(0, communityOnboardingPlantingTarget - communityOnboardingPlantings)} more community flowers before visiting My Garden`
                  : `Go to My Garden. ${myGarden.careBalance} Care.`
            }
            onClick={switchWorld}
          >
            <span
              className={world === "personal" ? "cg-community-mark" : "cg-home-mark"}
              aria-hidden="true"
            />
            <span className="cg-garden-switch-copy">
              <strong>
                {world === "personal" ? "Community Garden" : "My Garden"}
              </strong>
              <small>
                Care <b>{myGarden.careBalance}</b>
              </small>
              <small className="cg-lifetime-care">
                Total earned {myGarden.lifetimeCare.toLocaleString()}
              </small>
            </span>
            {showMyGardenInvitation ||
            showContinueGardenGuidance ||
            showMyGardenGrowthNudge ||
            showMyGardenUnlockNotice ? (
              <strong
                className="cg-my-garden-notice"
                aria-label={
                  showMyGardenUnlockNotice
                    ? `${unreadUnlockCount} new My Garden ${
                        unreadUnlockCount === 1 ? "update" : "updates"
                      }`
                    : showContinueGardenGuidance
                      ? "Earn more Care in Community Garden"
                      : showMyGardenGrowthNudge
                        ? "Care is ready to use in My Garden"
                        : "My Garden is ready"
                }
              >
                {showMyGardenUnlockNotice
                  ? Math.min(99, unreadUnlockCount)
                  : showContinueGardenGuidance
                    ? "+"
                    : "!"}
              </strong>
            ) : null}
          </button>
        </div>

        {world === "community" &&
        memberGarden &&
        stewardship &&
        isGardenOnboardingFinished(onboardingStep) ? (
          <button
            className="cg-garden-tasks-button"
            type="button"
            disabled={ui.builder.active}
            aria-label={`Open Garden Tasks. ${stewardship.tasksCompleted} completed; ${stewardship.flowers.living} of ${stewardship.capacity} flowers growing.`}
            onClick={() => {
              playGardenSound("select");
              setGardenTasksOpen(true);
            }}
          >
            <span className="cg-garden-tasks-icon" aria-hidden="true">✓</span>
            <strong>Tasks</strong>
            {stewardship.tasks.some((task) => task.status === "completed") ? (
              <i aria-label="A Garden Task is complete" />
            ) : null}
          </button>
        ) : null}

        {world === "personal" && myGarden.preview ? (
          <div className="cg-preview-progress" aria-live="polite">
            {guestPreview.access?.softPaywallDeclined
              ? "Temporary · not saved"
              : "Preview"}{" "}
            · {myGarden.preview.plantingsUsed} of {myGarden.preview.plantingLimit} flowers
          </div>
        ) : null}

        {showContinueGardenGuidance ? (
          <aside className="cg-preview-care-guide" role="status">
            <strong>Continue growing</strong>
            <span>Visit Community Garden to earn Care, then come back here.</span>
          </aside>
        ) : null}

        {world === "personal" && session && accountChecked && memberGarden ? (
          <div className="cg-share-tools">
            <GardenShare
              accessToken={session.access_token}
              disabled={ui.builder.active}
              onCapture={captureMyGarden}
            />
          </div>
        ) : null}

        <GardenInventory
          mode={world}
          open={inventoryOpen}
          selectedTool={ui.selectedTool}
          lifetimeCare={myGarden.lifetimeCare}
          inventorySeenLifetimeCare={myGarden.inventorySeenLifetimeCare}
          designPreviewEnabled={inventoryDesignAccess}
          onboardingLocked={onboardingInventoryLocked}
          toggleLocked={
            onboardingInventoryLocked &&
            onboardingStep !== "plant" &&
            onboardingStep !== "personal-inventory"
          }
          guidePlantChoice={
            onboardingStep === "select-seed" ||
            onboardingStep === "personal-seed"
          }
          onToggle={() => {
            if (!inventoryOpen) openInventoryForOnboarding();
            else {
              if (onboardingPlantSelectionRequired) return;
              setInventoryOpen(false);
              if (world === "personal") void acknowledgeInventoryUnlocks();
            }
          }}
          onSelectPlant={(plantType) => {
            if (
              onboardingInventoryLocked &&
              !isGardenOnboardingPlantType(plantType)
            ) {
              return;
            }
            playGardenSound("select");
            void trackBasilFunnelEvent("plant_selected");
            canvasRef.current?.selectPlant(plantType);
            const shouldGuideSpot =
              onboardingPlantSelectionRequired;
            transitionOnboarding("community-tile", ["select-seed"]);
            transitionOnboarding("personal-tile", ["personal-seed"]);
            setInventoryOpen(false);
            if (shouldGuideSpot) {
              window.requestAnimationFrame(() => {
                canvasRef.current?.suggestPlantingSpot();
              });
            }
          }}
          onSelectPath={() => {
            if (onboardingInventoryLocked) return;
            playGardenSound("select");
            canvasRef.current?.selectPathTool();
            setInventoryOpen(false);
          }}
          onSelectElement={(elementType) => {
            if (onboardingInventoryLocked) return;
            playGardenSound("select");
            canvasRef.current?.selectElement(elementType);
            setInventoryOpen(false);
          }}
        />

        <button
          className={`cg-action-button${
            (onboardingPlantActionReady &&
              (onboardingStep === "community-tile" ||
                onboardingStep === "personal-tile")) ||
            (onboardingWaterActionReady && onboardingStep === "community-water")
              ? " is-onboarding-highlight"
              : ""
          }${showQuickStartPlantActionCue ? " is-quick-start-final" : ""}`}
          type="button"
          disabled={!ui.actionEnabled || !tutorialActionAllowed}
          onClick={performSelectedAction}
        >
          {showQuickStartPlantActionCue ? (
            <span className="cg-action-guidance" aria-hidden="true">
              Click here
            </span>
          ) : null}
          <span
            className={
              ui.action === "water"
                ? "cg-water-icon"
                : ui.action === "weed"
                  ? "cg-plant-glyph is-weed"
                : ui.action === "uproot" || ui.action === "builder-remove"
                  ? "cg-uproot-icon"
                  : ui.action === "place-element" ||
                      (ui.action === "builder-place" &&
                        ui.selectedElementType !== null) ||
                      ui.action === "remove-element"
                    ? `cg-item-glyph ${getMyGardenElementGlyphClass(
                        ui.selectedElementType ?? "stone_paver",
                      )}`
                  : ui.action === "expand"
                    ? "cg-lock-icon"
                  : ui.action === "lay-path" ||
                      ui.action === "remove-path" ||
                      (ui.action === "builder-place" &&
                        ui.selectedTool === "path")
                    ? "cg-path-icon"
                  : `cg-plant-glyph is-${ui.selectedPlantType}`
            }
            aria-hidden="true"
          />
          <span>
            {communityQuickStart &&
            onboardingStep === "community-tile" &&
            ui.action === "plant"
              ? communityOnboardingPlantings === 1
                ? `Plant ${getPlantDefinition(ui.selectedPlantType).name}`
                : "Plant here"
              : ui.actionLabel}
          </span>
        </button>

        {world === "personal" && session && accountChecked && memberGarden ? (
          <div
            className={`cg-builder-tools${ui.builder.active ? " is-active" : ""}`}
          >
            <button
              className="cg-builder-toggle"
              type="button"
              aria-pressed={ui.builder.active}
              disabled={!ui.builder.active && !ui.builder.canEnter}
              title={
                ui.builder.active
                  ? "Close Builder Mode"
                  : ui.builder.helperText
              }
              onClick={() => {
                playGardenSound("select");
                canvasRef.current?.toggleBuilderMode();
              }}
            >
              <span className="cg-builder-icon" aria-hidden="true" />
              <span>{ui.builder.active ? "Done" : "Builder"}</span>
            </button>
            {!ui.builder.active && !landShapingUnlocked ? (
              <small className="cg-land-shaping-hint">
                Shape land at Helper
              </small>
            ) : null}
            {canReturnSelectedClearing ? (
              <button
                className="cg-return-clearing-button"
                type="button"
                title="Return this empty clearing to the forest"
                onClick={() => {
                  setReturnClearingError("");
                  setReturnClearingOpen(true);
                  playGardenSound("select");
                }}
              >
                <span>Return parcel</span>
              </button>
            ) : null}
            {ui.builder.active ? (
              <div
                className="cg-builder-edit-controls"
                role="group"
                aria-label="Builder string controls"
              >
                <output>
                  {ui.builder.length}/{ui.builder.maxLength}
                </output>
                <button
                  type="button"
                  disabled={ui.builder.length <= 1}
                  onClick={() => canvasRef.current?.undoBuilderStep()}
                >
                  Undo
                </button>
                <button
                  type="button"
                  disabled={ui.builder.length <= 1}
                  onClick={() => canvasRef.current?.clearBuilder()}
                >
                  Clear
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {showMembershipShortcut ? (
          <button
            className="cg-community-join"
            type="button"
            aria-label="Upgrade Garden Membership"
            onClick={() => {
              setMembershipOfferStage("soft");
              setMembershipOfferOpen(true);
            }}
          >
            Upgrade
          </button>
        ) : null}

        <p className="cg-sr-status" aria-live="polite">{ui.message}</p>
        <p className="cg-sr-status" aria-live="polite">{careAnnouncement}</p>
        {restoreMessage ? (
          <p
            className={`cg-restore-status${
              restoreMessage.startsWith("Restoring") ||
              restoreMessage.startsWith("Garden connection interrupted")
                ? ""
                : " is-error"
            }`}
            role="status"
          >
            {restoreMessage}
          </p>
        ) : null}

        {growingEdgeIntroOpen &&
        world === "community" &&
        !tutorialMapDimmed &&
        !showCommunityQuickStartComplete &&
        !menuOpen &&
        !inventoryOpen &&
        !membershipOfferOpen ? (
          <aside className="cg-growing-edge-intro" role="dialog" aria-modal="false">
            <p>How the shared garden grows</p>
            <h2>Grow from the Heart, outward</h2>
            <span>
              Deep green is the established Garden Heart. Its pale outer Growth
              Ring is open land where the next connected layer can form. Golden
              padlocks mark future Growing Edge land&mdash;or garden anywhere you like.
            </span>
            <button type="button" onClick={() => setGrowingEdgeIntroOpen(false)}>
              Got it
            </button>
          </aside>
        ) : null}

        {growingEdgeNotice &&
        !growingEdgeIntroOpen &&
        !menuOpen &&
        !inventoryOpen &&
        !membershipOfferOpen ? (
          <aside className="cg-growing-edge-notice" role="status">
            <span className="cg-growing-edge-sprout" aria-hidden="true" />
            <span>{growingEdgeNotice}</span>
          </aside>
        ) : null}

        <GardenOnboarding
          step={onboardingStep}
          communityQuickStart={communityQuickStart}
          communityPlantings={communityOnboardingPlantings}
          inventoryOpen={inventoryOpen}
          plantActionReady={onboardingPlantActionReady}
          waterActionReady={onboardingWaterActionReady}
          onOpenInventory={openInventoryForOnboarding}
          onOpenMyGarden={() => {
            transitionOnboarding("personal-inventory", ["my-garden"]);
            void trackBasilFunnelEvent("my_garden_entered");
            setWorld("personal");
          }}
        />

        {world === "community" && showCommunityQuickStartComplete ? (
          <aside
            className="cg-free-planting-notice is-community-complete"
            role="status"
            aria-live="polite"
          >
            <strong>You are part of the garden.</strong>
            <span>
              Congratulations. Your two flowers are growing here with
              everyone else&apos;s.
            </span>
            <em>Seriously—thank you for planting.</em>
          </aside>
        ) : null}

        {world === "personal" && showFreePlantingNotice ? (
          <aside className="cg-free-planting-notice" role="status">
            <strong>Your first flower is planted.</strong>
            <span>Feel free to plant more and arrange the garden your way.</span>
          </aside>
        ) : null}
      </section>

      {world === "community" ? <FutureAdSlot label={adLabel} /> : null}

      <GardenMenu
        open={menuOpen}
        section={menuSection}
        audio={gardenAudio}
        mode={world}
        lifetimeCare={myGarden.lifetimeCare}
        livingGardenDiscoveries={memberGarden?.livingGardenDiscoveries ?? []}
        livingGardenHabitats={memberGarden?.livingGardenHabitats ?? []}
        guideInitialShelf={guideInitialShelf}
        onClose={() => {
          playGardenSound("select");
          setMenuOpen(false);
          pendingGardenEntryRef.current = false;
        }}
        onSectionChange={(section) => {
          playGardenSound("select");
          if (section === "guide") setGuideInitialShelf("home");
          setMenuSection(section);
        }}
        onVisitHeritage={(gridX, gridY) => {
          playGardenSound("select");
          setMenuOpen(false);
          setInventoryOpen(false);
          setWorld("community");
          setAtlasTarget({
            gridX,
            gridY,
            label: "your Heritage Flower",
            requestId: Date.now(),
            kind: "heritage",
          });
        }}
        onVisitHabitat={(gridX, gridY) => {
          playGardenSound("select");
          setMenuOpen(false);
          setInventoryOpen(false);
          setWorld("personal");
          window.setTimeout(
            () => canvasRef.current?.goToGridPosition(gridX, gridY),
            80,
          );
        }}
        onViewCommunityGarden={openCommunityPresentation}
      />

      <CommunityGardenPresentation
        open={communityPresentationOpen}
        onClose={closeCommunityPresentation}
      />

      <GardenMembershipOffer
        open={membershipOfferOpen}
        planted={myGarden.preview?.plantingsUsed ?? GUEST_PLANTING_LIMIT}
        gardenPlantCount={myGarden.plants.length}
        gardenPathCount={myGarden.paths.length}
        gardenElementCount={myGarden.elements.length}
        careBalance={myGarden.careBalance}
        lifetimeCare={myGarden.lifetimeCare}
        stage={membershipOfferStage}
        onClose={dismissMembershipOffer}
        checkoutBusy={membershipCheckoutBusy}
        checkoutError={membershipCheckoutError}
        accountReady={Boolean(session)}
        onLater={() => {
          dismissMembershipOffer();
          if (membershipOfferStage !== "soft") setWorld("community");
        }}
        onAccount={() => {
          setMembershipOfferOpen(false);
          setMembershipCheckoutError("");
          setMenuSection("account");
          setMenuOpen(true);
        }}
        onJoin={(credentials) => void startMembershipCheckout(credentials)}
      />

      <HeritageFlowerCelebration
        moment={visibleHeritageMoment}
        onClose={dismissHeritageMoment}
        onVisit={visitHeritageMoment}
        onOpenGuide={() => {
          dismissHeritageMoment();
          setMenuSection("guide");
          setMenuOpen(true);
        }}
      />
      <HeritageFlowerDiscovery
        encounter={visibleHeritageEncounter}
        onClose={() => setHeritageEncounter(null)}
        onOpenGuide={() => {
          setHeritageEncounter(null);
          setMenuSection("guide");
          setMenuOpen(true);
        }}
      />
      <GardenUnlockCelebration
        notice={
          visibleHeritageMoment ||
          visibleHeritageEncounter ||
          careBlossomFound ||
          gardenWormFound
            ? null
            : (unlockNotices[0] ?? null)
        }
        temporary={!memberGarden}
        onContinue={dismissUnlockNotice}
        onViewGarden={viewUnlockInMyGarden}
      />
      <CareBlossomDiscovery
        open={careBlossomFound}
        onClose={() => setCareBlossomFound(false)}
      />
      <GardenWormDiscovery
        open={gardenWormFound}
        onClose={() => setGardenWormFound(false)}
      />
      <LivingGardenDiscoveryModal
        discovery={visibleLivingGardenDiscovery}
        onClose={() => {
          if (visibleLivingGardenDiscovery) {
            acknowledgeLivingGarden(visibleLivingGardenDiscovery.habitatKey);
          }
        }}
        onWatch={() => {
          if (!visibleLivingGardenDiscovery) return;
          acknowledgeLivingGarden(visibleLivingGardenDiscovery.habitatKey);
          setWorld("personal");
          window.setTimeout(
            () =>
              canvasRef.current?.goToGridPosition(
                visibleLivingGardenDiscovery.firstCenterX,
                visibleLivingGardenDiscovery.firstCenterY,
              ),
            80,
          );
        }}
        onOpenGuide={() => {
          if (visibleLivingGardenDiscovery) {
            acknowledgeLivingGarden(visibleLivingGardenDiscovery.habitatKey);
          }
          setMenuSection("guide");
          setGuideInitialShelf("habitats");
          setMenuOpen(true);
        }}
      />
      {gardenTasksOpen && stewardship ? (
        <div
          className="cg-stewardship-modal-shell"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setGardenTasksOpen(false);
          }}
        >
          <div
            className="cg-stewardship-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Community Stewardship and Garden Tasks"
          >
            <button
              className="cg-stewardship-modal-close"
              type="button"
              aria-label="Close Garden Tasks"
              onClick={() => setGardenTasksOpen(false)}
            >
              Close
            </button>
            <CommunityStewardshipPanel
              summary={stewardship}
              replacingId={replacingTaskId}
              onReplace={(assignmentId) =>
                void replaceStewardshipTask(assignmentId)
              }
              onNavigate={navigateToStewardshipPoint}
              flowersVisible={showMyCommunityFlowers}
              onToggleFlowers={() =>
                setShowMyCommunityFlowers((current) => !current)
              }
            />
          </div>
        </div>
      ) : null}
      <GardenTaskCelebration
        notification={visibleStewardshipNotification}
        onClose={() => {
          if (visibleStewardshipNotification) {
            void acknowledgeStewardshipNotification(
              visibleStewardshipNotification,
            );
          }
        }}
      />
      <GardenExpansionConfirmation
        open={expansionConfirmationOpen}
        careCost={selectedExpansionCost}
        onCancel={() => setExpansionConfirmationOpen(false)}
        onConfirm={confirmGardenExpansion}
      />
      <GardenClearingReturnConfirmation
        open={returnClearingOpen}
        careRefund={selectedGardenParcel?.careCost ?? 0}
        parcel={selectedGardenParcel}
        contents={selectedGardenParcelContents}
        error={returnClearingError}
        busy={returnClearingBusy}
        onCancel={() => {
          if (returnClearingBusy) return;
          setReturnClearingOpen(false);
          setReturnClearingError("");
        }}
        onConfirm={() => void confirmReturnClearing()}
      />
    </main>
  );
}
