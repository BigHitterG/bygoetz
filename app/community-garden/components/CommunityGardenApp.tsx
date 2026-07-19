"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  getPlantDefinition,
  PLANT_TYPES,
} from "../lib/roseLifecycle";
import {
  MyGardenControls,
  type MyGardenMutation,
} from "./MyGardenControls";

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
  const [ui, setUi] = useState(INITIAL_UI);
  const [world, setWorld] = useState<GardenWorldMode>("community");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuSection, setMenuSection] = useState<LibrarySection>("play");
  const [careAnnouncement, setCareAnnouncement] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [myGarden, setMyGarden] = useState<MyGardenState | null>(null);
  const [gardenControlsOpen, setGardenControlsOpen] = useState(false);
  const [gardenBusy, setGardenBusy] = useState(false);
  const [gardenNotice, setGardenNotice] = useState("");
  const adLabel = process.env.NEXT_PUBLIC_COMMUNITY_GARDEN_AD_PLACEHOLDER;

  const loadMembership = useCallback(async (activeSession: Session) => {
    try {
      const response = await fetch("/api/community-garden/account", {
        cache: "no-store",
        headers: { authorization: `Bearer ${activeSession.access_token}` },
      });
      if (!response.ok) return null;
      const account = (await response.json()) as AccountResponse;
      const nextGarden = account.active ? account.myGarden : null;
      setMyGarden(nextGarden);
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
      if (data.session) void loadMembership(data.session);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        void loadMembership(nextSession);
      } else {
        setMyGarden(null);
        setWorld("community");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadMembership]);

  const onStateChange = useCallback((state: GardenUiState) => {
    setUi(state);
  }, []);

  const claimCommunityContribution = useCallback(
    async (contribution: GardenContribution) => {
      const client = getGardenAccountClient();
      if (!client) {
        canvasRef.current?.showCareReward(contribution.careValue);
        setCareAnnouncement(
          `You helped the Community Garden and earned ${contribution.careValue} Care. A Garden Membership saves Care.`,
        );
        return;
      }
      const { data } = await client.auth.getSession();
      if (!data.session) {
        canvasRef.current?.showCareReward(contribution.careValue);
        setCareAnnouncement(
          `You helped the Community Garden and earned ${contribution.careValue} Care. A Garden Membership saves Care.`,
        );
        return;
      }

      try {
        const response = await fetch("/api/community-garden/care", {
          method: "POST",
          headers: {
            authorization: `Bearer ${data.session.access_token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ receiptToken: contribution.receiptToken }),
        });
        if (response.status === 401 || response.status === 403) {
          canvasRef.current?.showCareReward(contribution.careValue);
          setCareAnnouncement(
            `You helped the Community Garden and earned ${contribution.careValue} Care. A Garden Membership saves Care.`,
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
        setMyGarden((current) =>
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
    [],
  );

  const mutateMyGarden = useCallback(
    async (mutation: MyGardenMutation) => {
      if (!session) throw new Error("Sign in to update My Garden.");
      setGardenBusy(true);
      setGardenNotice("");
      try {
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
        setMyGarden(updated);
        setGardenNotice(
          mutation.action === "expand"
            ? `Your fenced garden is now ${updated.width} × ${updated.height}.`
            : mutation.action === "purchase-upgrade"
              ? "Upgrade added to the map."
              : "",
        );
        return updated;
      } finally {
        setGardenBusy(false);
      }
    },
    [session],
  );

  function switchWorld() {
    if (world === "personal") {
      setGardenControlsOpen(false);
      setWorld("community");
      return;
    }
    if (session && myGarden) {
      setMenuOpen(false);
      setWorld("personal");
      return;
    }
    setMenuSection("account");
    setMenuOpen(true);
    pendingGardenEntryRef.current = true;
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

        {world === "personal" && myGarden ? (
          <button
            className="cg-care-button"
            type="button"
            aria-label={`${myGarden.careBalance} Care. Open My Garden upgrades`}
            onClick={() => setGardenControlsOpen(true)}
          >
            <span>Care</span>
            <strong>{myGarden.careBalance}</strong>
          </button>
        ) : null}

        <div className="cg-plant-picker" role="group" aria-label="Choose what to plant">
          {PLANT_TYPES.map((plantType) => {
            const plant = getPlantDefinition(plantType);
            return (
              <button
                key={plantType}
                type="button"
                aria-label={`Select ${plant.name} seeds`}
                aria-pressed={ui.selectedPlantType === plantType}
                title={plant.name}
                onClick={() => canvasRef.current?.selectPlant(plantType)}
              >
                <span className={`cg-plant-glyph is-${plantType}`} aria-hidden="true" />
                <span>{plant.name}</span>
              </button>
            );
          })}
        </div>

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
                  : `cg-plant-glyph is-${ui.selectedPlantType}`
            }
            aria-hidden="true"
          />
          <span>{ui.actionLabel}</span>
        </button>

        <p className="cg-sr-status" aria-live="polite">{ui.message}</p>
        <p className="cg-sr-status" aria-live="polite">{careAnnouncement}</p>
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

      {myGarden ? (
        <MyGardenControls
          garden={myGarden}
          open={gardenControlsOpen}
          busy={gardenBusy}
          notice={gardenNotice}
          onClose={() => setGardenControlsOpen(false)}
          onMutate={async (mutation) => {
            try {
              await mutateMyGarden(mutation);
            } catch (error) {
              setGardenNotice(
                error instanceof Error
                  ? error.message
                  : "My Garden could not be updated.",
              );
            }
          }}
        />
      ) : null}
    </main>
  );
}
