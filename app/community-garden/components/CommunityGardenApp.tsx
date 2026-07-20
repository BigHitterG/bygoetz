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
import type { GardenContribution } from "../lib/supabaseGarden";
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
  plantMapPoints: [],
  mode: "community",
};

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
  const [guestPreviewReady, setGuestPreviewReady] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState("");
  const restoredJourneyRef = useRef(false);
  const adLabel = process.env.NEXT_PUBLIC_COMMUNITY_GARDEN_AD_PLACEHOLDER;
  const myGarden = memberGarden ?? guestPreview.garden;
  const isPreview = !memberGarden;

  const commitGuestPreview = useCallback((next: GuestGardenPreview) => {
    guestPreviewRef.current = next;
    setGuestPreview(next);
    saveGuestGardenPreview(next);
  }, []);

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
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      const storedPreview = loadGuestGardenPreview();
      guestPreviewRef.current = storedPreview;
      setGuestPreview(storedPreview);
      setGuestPreviewReady(true);
    });
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
    if (!client) return;

    void client.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setMemberGarden(null);
        setWorld("community");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!guestPreviewReady || !session) return;
    queueMicrotask(() => void loadMembership(session));
  }, [guestPreviewReady, loadMembership, session]);

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
    async (contribution: GardenContribution) => {
      if (!session || !memberGarden) {
        const award = awardGuestCare(
          guestPreviewRef.current,
          contribution.careValue,
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

      try {
        const response = await fetch("/api/community-garden/care", {
          method: "POST",
          headers: {
            authorization: `Bearer ${session.access_token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ receiptToken: contribution.receiptToken }),
        });
        if (response.status === 401 || response.status === 403) {
          const award = awardGuestCare(
            guestPreviewRef.current,
            contribution.careValue,
          );
          commitGuestPreview(award.preview);
          canvasRef.current?.showCareReward(award.awardedCare);
          setCareAnnouncement(
            `${award.awardedCare} temporary Care earned. A Garden Membership saves it.`,
          );
          return;
        }
        if (!response.ok) {
          setCareAnnouncement("Care could not be saved. Please try another garden action.");
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
      } catch {
        setCareAnnouncement("Care could not be saved. Please try another garden action.");
      }
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
          const limit = updatedPreview.garden.preview?.plantingLimit ?? 3;
          if (mutation.action === "plant" && used >= limit) {
            setMembershipOfferOpen(true);
          }
          return updatedPreview.garden;
        } catch (error) {
          if (error instanceof GuestPreviewLimitError) {
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
    [commitGuestPreview, memberGarden, session],
  );

  function switchWorld() {
    if (world === "personal") {
      setInventoryOpen(false);
      setWorld("community");
      return;
    }
    setMenuOpen(false);
    setInventoryOpen(false);
    setWorld("personal");
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
        />

        <header className="cg-titlebar">
          <div className="cg-pixel-rose" aria-hidden="true">
            <span />
          </div>
          <div className="cg-title-copy">
            <h1>Basil</h1>
            <p>{world === "personal" ? "My Garden" : "Community Garden"}</p>
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
          className="cg-compact-support"
          type="button"
          aria-label={
            world === "personal" ? "Go to Community Garden" : "Go to My Garden"
          }
          onClick={switchWorld}
        >
          <span
            className={world === "personal" ? "cg-community-mark" : "cg-home-mark"}
            aria-hidden="true"
          />
          {world === "personal" ? "Community Garden" : "My Garden"}
        </button>

        {world === "personal" ? (
          <output
            className="cg-care-button is-personal"
            aria-label={`${myGarden.careBalance} Care`}
          >
            <span>Care</span>
            <strong>{myGarden.careBalance}</strong>
            <i aria-hidden="true">▼</i>
          </output>
        ) : (
          <output
            className="cg-care-button is-community"
            aria-label={`${myGarden.careBalance} ${isPreview ? "temporary " : ""}Care`}
          >
            <span>Care</span>
            <strong>{myGarden.careBalance}</strong>
          </output>
        )}

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
          onToggle={() => setInventoryOpen((current) => !current)}
          onSelectPlant={(plantType) => {
            canvasRef.current?.selectPlant(plantType);
            setInventoryOpen(false);
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
          className="cg-action-button"
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
        onLater={() => {
          setMembershipOfferOpen(false);
          setWorld("community");
        }}
        onJoin={() => {
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
          trackMetaCustomEvent("BasilSignupStarted");
          setMembershipOfferOpen(false);
          setMenuSection("account");
          setMenuOpen(true);
          pendingGardenEntryRef.current = true;
        }}
      />
    </main>
  );
}
