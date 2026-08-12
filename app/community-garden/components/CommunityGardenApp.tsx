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
import { GardenHouseInterior } from "./GardenHouseInterior";
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
  const activeGardenHouse = useMemo(
    () => gardenHouse ?? buildGuestGardenHouseState(myGarden),
    [gardenHouse, myGarden],
  );
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
   …18643 tokens truncated…}
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

        <GardenControlsDock
          mapDisabled={tutorialMapDimmed || ui.builder.active}
          mapAriaLabel={`Open the detailed ${world === "personal" ? "My Garden" : "Community Garden"} map`}
          inventoryDisabled={inventoryToggleLocked || ui.builder.active}
          inventoryHighlighted={inventoryHighlighted}
          inventoryIconClass={inventoryIconClass}
          gardenDisabled={
            (world === "community" && myGardenTutorialLocked) ||
            communityGardenTutorialLocked ||
            ui.builder.active
          }
          gardenHighlighted={
            showMyGardenInvitation ||
            showContinueGardenGuidance ||
            showMyGardenGrowthNudge ||
            showMyGardenUnlockNotice
          }
          gardenLabel={world === "personal" ? "Community" : "My Garden"}
          gardenAriaLabel={
            world === "personal"
              ? communityGardenTutorialLocked
                ? "Plant your first rose before returning to Community Garden"
                : "Go to Community Garden."
              : myGardenTutorialLocked
                ? `Plant ${Math.max(0, communityOnboardingPlantingTarget - communityOnboardingPlantings)} more community flowers before visiting My Garden`
                : "Go to My Garden."
          }
          gardenIconClass={
            world === "personal" ? "cg-community-mark" : "cg-home-mark"
          }
          gardenNotice={
            showMyGardenInvitation ||
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
            ) : null
          }
          actionDisabled={!ui.actionEnabled || !tutorialActionAllowed}
          actionHighlighted={
            (onboardingPlantActionReady &&
              (onboardingStep === "community-tile" ||
                onboardingStep === "personal-tile")) ||
            (onboardingWaterActionReady && onboardingStep === "community-water")
          }
          actionQuickStart={showQuickStartPlantActionCue}
          actionLabel={
            communityQuickStart &&
            onboardingStep === "community-tile" &&
            ui.action === "plant"
              ? communityOnboardingPlantings === 1
                ? `Plant ${getPlantDefinition(ui.selectedPlantType).name}`
                : "Plant here"
              : ui.actionLabel
          }
          upgradeVisible={showMembershipShortcut}
          onUpgrade={() => {
            setMembershipOfferStage("soft");
            setMembershipOfferOpen(true);
          }}
          actionIcon={
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
          }
          onMap={() => {
            setMenuOpen(false);
            setInventoryOpen(false);
            setGardenMapOpen(true);
            playGardenSound("select");
          }}
          onInventory={() => {
            if (!inventoryOpen) openInventoryForOnboarding();
            else {
              if (onboardingPlantSelectionRequired) return;
              setInventoryOpen(false);
              if (world === "personal") void acknowledgeInventoryUnlocks();
            }
          }}
          onGarden={switchWorld}
          onAction={performSelectedAction}
        />

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
          step={quickStartPlantPending ? null : onboardingStep}
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
            <button
              className="cg-community-complete-close"
              type="button"
              aria-label="Close welcome message"
              onClick={() => setShowCommunityQuickStartComplete(false)}
            >
              {"\u00d7"}
            </button>
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

      {gardenHouseOpen ? (
        <GardenHouseInterior
          open
          state={activeGardenHouse}
          onClose={closeGardenHouse}
          onInspect={inspectGardenHouseDisplay}
        />
      ) : null}

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
