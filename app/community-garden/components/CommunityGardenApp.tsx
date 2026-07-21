"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { trackMetaCustomEvent } from "@/lib/analytics/metaPixel";
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
import { GardenMenu, type LibrarySection } from "./GardenMenu";
import type { MyGardenMutation } from "../lib/myGardenMutation";
import {
  awardGuestCare,
  clearGuestGardenPreview,
  createGuestGardenPreview,
  getGuestPreviewImport,
  GuestPreviewLimitError,
  loadGuestGardenPreview,
  mutateGuestGarden,
  preserveGuestGardenPreviewForCheckout,
  saveGuestGardenPreview,
  type GuestGardenPreview,
} from "../lib/guestGardenPreview";
import { GardenInventory } from "./GardenInventory";
import { GardenMembershipOffer } from "./GardenMembershipOffer";
import { GardenUpdateStatus } from "./GardenUpdateStatus";
import { GardenOnboarding } from "./GardenOnboarding";
import {
  isGardenOnboardingFinished,
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
  pathMapPoints: [],
  plantMapPoints: [],
  nextMapUpdateAt: null,
  mode: "community",
};

const HEALTH_PULSE_KEY = "basil-health-pulse-at-v1";
const HEALTH_PULSE_INTERVAL_MS = 5 * 60 * 1000;

type AccountResponse =
  | { active: false }
  | { active: true; myGarden: MyGardenState };

async function getResponseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function CommunityGardenApp() {
  const canvasRef = useRef<GardenCanvasHandle>(null);
  const careClaimQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingGardenEntryRef = useRef(false);
  const guestPreviewRef = useRef<GuestGardenPreview>(
    createGuestGardenPreview(),
  );
  const [ui, setUi] = useState(INITIAL_UI);
  const [world, setWorld] = useState<GardenWorldMode>("community");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuSection, setMenuSection] = useState<LibrarySection>("play");
  const [careAnnouncement, setCareAnnouncement] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [guestPreview, setGuestPreview] = useState<GuestGardenPreview>(
    createGuestGardenPreview(),
  );
  const [memberGarden, setMemberGarden] = useState<MyGardenState | null>(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [membershipOfferOpen, setMembershipOfferOpen] = useState(false);
  const [membershipCheckoutBusy, setMembershipCheckoutBusy] = useState(false);
  const [membershipCheckoutError, setMembershipCheckoutError] = useState("");
  const [guestPreviewReady, setGuestPreviewReady] = useState(false);
  const [accountChecked, setAccountChecked] = useState(false);
  const [onboardingStep, setOnboardingStep] =
    useState<GardenOnboardingStep | null>(null);
  const [communityOnboardingPlantings, setCommunityOnboardingPlantings] =
    useState(0);
  const [showFreePlantingNotice, setShowFreePlantingNotice] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState("");
  const restoredJourneyRef = useRef(false);
  const communityOnboardingPlantingsRef = useRef(0);
  const adLabel = process.env.NEXT_PUBLIC_COMMUNITY_GARDEN_AD_PLACEHOLDER;
  const myGarden = memberGarden ?? guestPreview.garden;
  const onboardingPlantActionReady =
    ui.action === "plant" && ui.actionEnabled;
  const showMyGardenInvitation =
    world === "community" &&
    !memberGarden &&
    communityOnboardingPlantings >= 3 &&
    !isGardenOnboardingFinished(onboardingStep);
  const myGardenTutorialLocked =
    !memberGarden &&
    Boolean(onboardingStep) &&
    !isGardenOnboardingFinished(onboardingStep) &&
    onboardingStep !== "my-garden" &&
    communityOnboardingPlantings < 3;

  const commitGuestPreview = useCallback((next: GuestGardenPreview) => {
    guestPreviewRef.current = next;
    setGuestPreview(next);
    saveGuestGardenPreview(next);
  }, []);

  const startMembershipCheckout = useCallback(async () => {
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
    trackMetaCustomEvent("BasilGuestStateSaved", {
      plants: pendingPreview.garden.plants.length,
      paths: pendingPreview.garden.paths.length,
    });
    trackMetaCustomEvent("BasilCheckoutStarted");
    setMembershipCheckoutBusy(true);
    setMembershipCheckoutError("");

    try {
      const response = await fetch("/api/community-garden/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(session
            ? { authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          launchSessionId: getBasilLaunchSessionId(),
          preview: getGuestPreviewImport(pendingPreview),
        }),
      });
      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "Secure checkout could not start."),
        );
      }
      const payload = (await response.json()) as { url?: string };
      if (!payload.url) throw new Error("Stripe did not return a secure checkout page.");
      window.location.assign(payload.url);
    } catch (error) {
      setMembershipCheckoutBusy(false);
      setMembershipCheckoutError(
        error instanceof Error ? error.message : "Secure checkout could not start.",
      );
    }
  }, [session, ui.mapX, ui.mapY, ui.selectedTool, ui.zoom, world]);

  const loadMembership = useCallback(async (activeSession: Session) => {
    try {
      const response = await fetch("/api/community-garden/account", {
        cache: "no-store",
        headers: { authorization: `Bearer ${activeSession.access_token}` },
      });
      if (!response.ok) return null;
      const account = (await response.json()) as AccountResponse;
      let nextGarden = account.active ? account.myGarden : null;
      if (nextGarden) {
        const preview = guestPreviewRef.current;
        const hasTemporaryProgress =
          preview.garden.lifetimeCare > 0 ||
          preview.garden.plants.length > 0 ||
          preview.garden.paths.length > 0;
        if (hasTemporaryProgress) {
          setRestoreMessage("Restoring your garden...");
          trackMetaCustomEvent("BasilGuestRestoreStarted");
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
              trackMetaCustomEvent("BasilGuestStateRestored");
            } else {
              setRestoreMessage(
                "Your saved garden is still safe. We will try restoring it again.",
              );
              trackMetaCustomEvent("BasilGuestRestoreFailed", {
                status: importResponse.status,
              });
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
            trackMetaCustomEvent("BasilGuestRestoreFailed");
            void trackBasilFunnelEvent("garden_restoration_failed", {
              failure_stage: "preview_import",
              error_code: "network_or_unknown",
            });
          }
        }
      }
      setMemberGarden(nextGarden);
      if (nextGarden && pendingGardenEntryRef.current) {
        pendingGardenEntryRef.current = false;
        setMenuOpen(false);
        setWorld("personal");
      }
      return nextGarden;
    } catch {
      return null;
    } finally {
      setAccountChecked(true);
    }
  }, []);

  useEffect(() => {
    void trackBasilFunnelEvent("session_started");
  }, []);

  useEffect(() => {
    if (ui.connection === "connecting") return;
    void trackBasilFunnelEvent("garden_loaded");
  }, [ui.connection]);

  useEffect(() => {
    if (!membershipOfferOpen) return;
    void trackBasilFunnelEvent("paywall_viewed");
  }, [membershipOfferOpen]);

  useEffect(() => {
    if (world !== "personal") return;
    void trackBasilFunnelEvent("my_garden_entered");
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
        trackMetaCustomEvent("BasilOnboardingStep", { step: next });
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
      trackMetaCustomEvent("BasilOrientationChanged", {
        orientation: window.matchMedia("(orientation: portrait)").matches
          ? "portrait"
          : "landscape",
      });
      updateViewport();
      window.setTimeout(updateViewport, 250);
    };
    updateViewport();
    if (window.matchMedia("(min-width: 600px) and (max-width: 1180px)").matches) {
      trackMetaCustomEvent("BasilTabletLayoutLoaded");
    }
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
        setSession(data.session);
        if (!data.session) setAccountChecked(true);
      })
      .catch(() => setAccountChecked(true));

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setMemberGarden(null);
        setWorld("community");
        setAccountChecked(true);
      } else {
        setAccountChecked(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!guestPreviewReady || !session) return;
    queueMicrotask(() => void loadMembership(session));
  }, [guestPreviewReady, loadMembership, session]);

  useEffect(() => {
    if (
      !guestPreviewReady ||
      !accountChecked ||
      ui.connection === "connecting" ||
      onboardingStep
    ) {
      return;
    }

    const stored = loadGardenOnboardingStep();
    const storedCommunityPlantings = loadCommunityOnboardingPlantings();
    communityOnboardingPlantingsRef.current = storedCommunityPlantings;
    let next = stored;
    if (memberGarden) {
      next = "complete";
    } else if (!next) {
      const plantings = guestPreviewRef.current.garden.preview?.plantingsUsed ?? 0;
      if (plantings > 0) next = "complete";
      else if (
        guestPreviewRef.current.journey?.world === "personal"
      ) {
        next = "personal-inventory";
      } else if (storedCommunityPlantings >= 3) {
        next = "my-garden";
      } else if (storedCommunityPlantings > 0) {
        next = "community-tile";
      } else {
        next = "plant";
      }
    } else if (
      !memberGarden &&
      !isGardenOnboardingFinished(next) &&
      storedCommunityPlantings >= 3
    ) {
      next = "my-garden";
    } else if (next === "community-repeat") {
      next = "community-tile";
    }
    queueMicrotask(() => {
      setCommunityOnboardingPlantings(storedCommunityPlantings);
      saveGardenOnboardingStep(next);
      setOnboardingStep(next);
    });
  }, [
    accountChecked,
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
    const shouldSuggestCommunity =
      onboardingStep === "community-tile" && world === "community";
    const shouldSuggestPersonal =
      onboardingStep === "personal-tile" && world === "personal";
    if (!shouldSuggestCommunity && !shouldSuggestPersonal) return;
    const frame = window.requestAnimationFrame(() => {
      canvasRef.current?.suggestPlantingSpot();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [onboardingStep, world]);

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

  const onStateChange = useCallback((state: GardenUiState) => {
    setUi(state);
  }, []);

  const claimCommunityContribution = useCallback(
    (contribution: GardenContribution) => {
      if (!session || !memberGarden) {
        const award = awardGuestCare(
          guestPreviewRef.current,
          contribution.careValue,
          contribution.action,
        );
        commitGuestPreview(award.preview);
        canvasRef.current?.showCareReward(
          award.awardedCare,
          award.steadyProgress,
          4,
        );
        setCareAnnouncement(
          award.awardedCare > 0
            ? `${award.awardedCare} temporary Care earned. Your preview balance is ${award.preview.garden.careBalance}.`
            : `Tending progress ${award.steadyProgress} of 4 toward another temporary Care.`,
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
              const award = awardGuestCare(
                guestPreviewRef.current,
                contribution.careValue,
                contribution.action,
              );
              commitGuestPreview(award.preview);
              canvasRef.current?.showCareReward(award.awardedCare);
              setCareAnnouncement(
                `${award.awardedCare} temporary Care earned. A Garden Membership saves it.`,
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
              earningMode: "quick" | "steady";
              steadyProgress: number;
              steadyActionsRequired: number;
            };
            setMemberGarden((current) =>
              current
                ? {
                    ...current,
                    careBalance: award.careBalance,
                    lifetimeCare: award.lifetimeCare,
                  }
                : current,
            );
            if (award.awardedCare > 0) {
              canvasRef.current?.showCareReward(award.awardedCare);
              setCareAnnouncement(
                `${award.awardedCare} Care saved. Your balance is ${award.careBalance}.`,
              );
            } else {
              canvasRef.current?.showCareReward(
                0,
                award.steadyProgress,
                award.steadyActionsRequired,
              );
              setCareAnnouncement(
                `Tending progress ${award.steadyProgress} of ${award.steadyActionsRequired}.`,
              );
            }
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
    [commitGuestPreview, memberGarden, session],
  );

  const mutateMyGarden = useCallback(
    async (mutation: MyGardenMutation) => {
      if (!memberGarden) {
        try {
          const updatedPreview = mutateGuestGarden(
            guestPreviewRef.current,
            mutation,
          );
          commitGuestPreview(updatedPreview);
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
            if (
              used >= (updatedPreview.garden.preview?.plantingLimit ?? 3)
            ) {
              void trackBasilFunnelEvent("preview_limit_reached");
              setMembershipOfferOpen(true);
            }
          }
          return updatedPreview.garden;
        } catch (error) {
          if (error instanceof GuestPreviewLimitError) {
            void trackBasilFunnelEvent("preview_limit_reached");
            transitionOnboarding("complete", [
              "personal-inventory",
              "personal-seed",
              "personal-tile",
            ]);
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

  function switchWorld() {
    if (world === "personal") {
      setInventoryOpen(false);
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
    setWorld("personal");
  }

  const handleGardenActionCompleted = useCallback(
    (mode: GardenWorldMode, action: GardenUiState["action"]) => {
      if (mode === "community" && action === "plant") {
        const nextPlantings = Math.min(
          3,
          communityOnboardingPlantingsRef.current + 1,
        );
        communityOnboardingPlantingsRef.current = nextPlantings;
        setCommunityOnboardingPlantings(nextPlantings);
        saveCommunityOnboardingPlantings(nextPlantings);
        if (nextPlantings === 1) {
          void trackBasilFunnelEvent("first_community_plant");
        } else if (nextPlantings === 3) {
          void trackBasilFunnelEvent("third_community_plant");
        }
        transitionOnboarding(
          nextPlantings >= 3 ? "my-garden" : "community-tile",
          ["plant", "select-seed", "community-tile", "community-repeat"],
        );
        if (nextPlantings < 3) {
          window.requestAnimationFrame(() => {
            canvasRef.current?.suggestPlantingSpot();
          });
        }
      }
    },
    [transitionOnboarding],
  );

  const handleGardenActionFailed = useCallback(
    (mode: GardenWorldMode, action: GardenUiState["action"], error: unknown) => {
      void trackBasilFunnelEvent("garden_action_failed", {
        failure_stage: mode,
        error_code:
          error instanceof Error && /network|connect|offline/i.test(error.message)
            ? "connection"
            : action ?? "unknown",
      });
    },
    [],
  );

  function openInventoryForOnboarding() {
    transitionOnboarding("select-seed", ["plant"]);
    transitionOnboarding("personal-seed", ["personal-inventory"]);
    setInventoryOpen(true);
    void trackBasilFunnelEvent("inventory_opened");
  }

  return (
    <main className={`cg-root is-${world}-world`}>
      <section className="cg-game-frame" aria-label="Basil garden game">
        <GardenCanvas
          ref={canvasRef}
          mode={world}
          personalGarden={myGarden}
          onStateChange={onStateChange}
          onCommunityContribution={claimCommunityContribution}
          onPersonalGardenMutation={mutateMyGarden}
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
              setMenuSection("play");
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
            onNavigate={(mapX, mapY) =>
              canvasRef.current?.goToMapPosition(mapX, mapY)
            }
          />
        ) : null}

        <div className="cg-zoom-control" role="group" aria-label="Garden zoom">
          <button
            type="button"
            title="Zoom out"
            aria-label="Zoom out to see more of the garden"
            disabled={!ui.canZoomOut}
            onClick={() => canvasRef.current?.zoomOut()}
          >
            -
          </button>
          <output aria-label={`Current zoom ${ui.zoom} times`}>{ui.zoom}x</output>
          <button
            type="button"
            title="Zoom in"
            aria-label="Zoom in for a closer garden view"
            disabled={!ui.canZoomIn}
            onClick={() => canvasRef.current?.zoomIn()}
          >
            +
          </button>
        </div>

        <button
          className={`cg-compact-support${
            showMyGardenInvitation
              ? " is-onboarding-highlight"
              : ""
          }`}
          type="button"
          disabled={world === "community" && myGardenTutorialLocked}
          aria-label={
            world === "personal"
              ? `Go to Community Garden. ${myGarden.careBalance} Care.`
              : myGardenTutorialLocked
                ? `Plant ${3 - communityOnboardingPlantings} more community flowers before visiting My Garden`
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
          </span>
          {showMyGardenInvitation ? (
            <strong className="cg-my-garden-notice" aria-label="My Garden is ready">
              {myGarden.careBalance}
            </strong>
          ) : null}
        </button>

        {world === "personal" && myGarden.preview ? (
          <div className="cg-preview-progress" aria-live="polite">
            Preview · {myGarden.preview.plantingsUsed} of{" "}
            {myGarden.preview.plantingLimit} flowers
          </div>
        ) : null}

        <GardenInventory
          mode={world}
          open={inventoryOpen}
          selectedTool={ui.selectedTool}
          guidePlantChoice={
            onboardingStep === "select-seed" ||
            onboardingStep === "personal-seed"
          }
          onToggle={() => {
            if (!inventoryOpen) openInventoryForOnboarding();
            else setInventoryOpen(false);
          }}
          onSelectPlant={(plantType) => {
            void trackBasilFunnelEvent("plant_selected");
            canvasRef.current?.selectPlant(plantType);
            const shouldGuideSpot =
              onboardingStep === "select-seed" ||
              onboardingStep === "personal-seed";
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
            canvasRef.current?.selectPathTool();
            setInventoryOpen(false);
          }}
          onSelectElement={(elementType) => {
            canvasRef.current?.selectElement(elementType);
            setInventoryOpen(false);
          }}
        />

        <button
          className={`cg-action-button${
            onboardingPlantActionReady &&
            (onboardingStep === "community-tile" ||
              onboardingStep === "personal-tile")
              ? " is-onboarding-highlight"
              : ""
          }`}
          type="button"
          disabled={!ui.actionEnabled}
          onClick={() => void canvasRef.current?.performAction()}
        >
          <span
            className={
              ui.action === "water"
                ? "cg-water-icon"
                : ui.action === "uproot"
                  ? "cg-uproot-icon"
                  : ui.action === "place-element" ||
                      ui.action === "remove-element"
                    ? `cg-item-glyph is-${ui.selectedElementType ?? "stone_paver"}`
                  : ui.action === "expand"
                    ? "cg-lock-icon"
                  : ui.action === "lay-path" || ui.action === "remove-path"
                    ? "cg-path-icon"
                  : `cg-plant-glyph is-${ui.selectedPlantType}`
            }
            aria-hidden="true"
          />
          <span>{ui.actionLabel}</span>
        </button>

        <p className="cg-sr-status" aria-live="polite">{ui.message}</p>
        <p className="cg-sr-status" aria-live="polite">{careAnnouncement}</p>
        {restoreMessage ? (
          <p
            className={`cg-restore-status${
              restoreMessage.startsWith("Restoring") ? "" : " is-error"
            }`}
            role="status"
          >
            {restoreMessage}
          </p>
        ) : null}

        <GardenOnboarding
          step={onboardingStep}
          communityPlantings={communityOnboardingPlantings}
          inventoryOpen={inventoryOpen}
          actionReady={onboardingPlantActionReady}
          onDismiss={() => transitionOnboarding("dismissed")}
          onOpenInventory={openInventoryForOnboarding}
          onOpenMyGarden={() => {
            transitionOnboarding("personal-inventory", ["my-garden"]);
            void trackBasilFunnelEvent("my_garden_entered");
            setWorld("personal");
          }}
        />

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
        onClose={() => {
          setMenuOpen(false);
          pendingGardenEntryRef.current = false;
        }}
        onSectionChange={setMenuSection}
      />

      <GardenMembershipOffer
        open={membershipOfferOpen}
        planted={myGarden.preview?.plantingsUsed ?? 3}
        onClose={() => setMembershipOfferOpen(false)}
        checkoutBusy={membershipCheckoutBusy}
        checkoutError={membershipCheckoutError}
        onLater={() => {
          setMembershipOfferOpen(false);
          transitionOnboarding("complete");
          setWorld("community");
        }}
        onJoin={() => void startMembershipCheckout()}
      />
    </main>
  );
}
