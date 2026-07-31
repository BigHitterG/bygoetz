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
  GUEST_SOFT_PAYWALL_PLANTINGS,
  GuestPreviewExpiredError,
  GuestPreviewLimitError,
  isGuestPreviewExpired,
  loadGuestGardenPreview,
  markGuestPreviewContinued,
  markGuestSoftPaywallDeclined,
  markGuestSoftPaywallSeen,
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
  getCommunityQuickStartPlantType,
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
import { SPECIAL_WATERING_FLOWER_NAME } from "../lib/roseLifecycle";
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
  const [personalExpansionMode, setPersonalExpansionMode] =
    useState<"classic" | "freeform">("classic");
  const [growingEdgeIntroOpen, setGrowingEdgeIntroOpen] = useState(false);
  const [growingEdgeNotice, setGrowingEdgeNotice] = useState("");
  const restoredJourneyRef = useRef(false);
  const communityOnboardingPlantingsRef = useRef(0);
  const quickStartPlantTrackedRef = useRef(false);
  const adLabel = process.env.NEXT_PUBLIC_COMMUNITY_GARDEN_AD_PLACEHOLDER;
  const captureMyGarden = useCallback((scope: GardenShareScope) => {
    return canvasRef.current?.captureGarden(scope) ?? Promise.resolve(null);
  }, []);
  const myGarden = memberGarden ?? guestPreview.garden;
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
  const canReturnSelectedClearing =
    Boolean(selectedGardenParcel) &&
    selectedGardenParcel?.source !== "starter" &&
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
  const freeformExpansionAvailable = Boolean(
    memberGarden?.freeformExpansion && memberGarden.expansionCandidates?.length,
  );
  const canvasGarden = useMemo<MyGardenState>(() => {
    const useFreeform =
      Boolean(memberGarden) &&
      personalExpansionMode === "freeform" &&
      freeformExpansionAvailable;
    return {
      ...myGarden,
      freeformExpansion: useFreeform,
      nextExpansion: useFreeform ? null : myGarden.nextExpansion,
      expansionCandidates: [
        ...(memberGarden?.reclaimCandidates ?? []),
        ...(useFreeform ? (myGarden.expansionCandidates ?? []) : []),
      ],
      selectedParcel:
        selectedGardenParcel?.source !== "starter"
          ? selectedGardenParcel ?? undefined
          : undefined,
    };
  }, [
    freeformExpansionAvailable,
    memberGarden,
    myGarden,
    personalExpansionMode,
    selectedGardenParcel,
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
  const onboardingWaterActionReady =
    ui.action === "water" && ui.actionEnabled;
  const showMyGardenInvitation =
    world === "community" &&
    !memberGarden &&
    communityOnboardingPlantings >= 3 &&
    onboardingStep !== "community-water" &&
    !isGardenOnboardingFinished(onboardingStep);
  const myGardenTutorialLocked =
    !memberGarden &&
    Boolean(onboardingStep) &&
    !isGardenOnboardingFinished(onboardingStep) &&
    onboardingStep !== "my-garden" &&
    (communityOnboardingPlantings < 3 || onboardingStep === "community-water");
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
      :…17260 tokens truncated…lick={() => {
              playGardenSound("select");
              setGardenTasksOpen(true);
            }}
          >
            <span className="cg-garden-tasks-icon" aria-hidden="true">âœ“</span>
            <strong>Tasks</strong>
            {stewardship.tasks.some((task) => task.status === "completed") ? (
              <i aria-label="A Garden Task is complete" />
            ) : null}
          </button>
        ) : null}

        {world === "personal" && myGarden.preview ? (
          <div className="cg-preview-progress" aria-live="polite">
            {guestPreview.access?.softPaywallDeclined
              ? "Temporary Â· not saved"
              : "Preview"}{" "}
            Â· {myGarden.preview.plantingsUsed} of {myGarden.preview.plantingLimit} flowers
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
          }`}
          type="button"
          disabled={!ui.actionEnabled || !tutorialActionAllowed}
          onClick={performSelectedAction}
        >
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
          <span>{ui.actionLabel}</span>
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
            {!ui.builder.active ? (
              <div
                className="cg-expansion-mode"
                role="group"
                aria-label="My Garden expansion style"
              >
                <button
                  type="button"
                  className={personalExpansionMode === "classic" ? "is-active" : ""}
                  aria-pressed={personalExpansionMode === "classic"}
                  onClick={() => setPersonalExpansionMode("classic")}
                >
                  Classic land
                </button>
                <button
                  type="button"
                  className={personalExpansionMode === "freeform" ? "is-active" : ""}
                  aria-pressed={personalExpansionMode === "freeform"}
                  disabled={!freeformExpansionAvailable}
                  title={
                    freeformExpansionAvailable
                      ? "Choose an adjacent 4 by 4 clearing"
                      : "Reach Caretaker to shape individual clearings"
                  }
                  onClick={() => setPersonalExpansionMode("freeform")}
                >
                  {freeformExpansionAvailable ? "Shape land" : "Shape at Caretaker"}
                </button>
              </div>
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
                <span className="cg-return-clearing-icon" aria-hidden="true" />
                <span>Return selected land</span>
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
          <aside className="cg-free-planting-notice" role="status">
            <strong>You are part of the garden.</strong>
            <span>Your three flowers are growing. Explore, plant, or water anywhere you like.</span>
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
      />

      <GardenMembershipOffer
        open={membershipOfferOpen}
        planted={myGarden.preview?.plantingsUsed ?? GUEST_SOFT_PAYWALL_PLANTINGS}
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
        careCost={
          canvasGarden.nextExpansion?.careCost ??
          canvasGarden.expansionCandidates?.[0]?.careCost ??
          0
        }
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

