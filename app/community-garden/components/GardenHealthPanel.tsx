"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import type { CommunityGardenHealth } from "@/lib/communityGarden/health";

type HealthState =
  | { status: "checking" }
  | { status: "hidden" }
  | { status: "error"; message: string }
  | { status: "ready"; health: CommunityGardenHealth };

function formatDuration(value: number) {
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} s`;
}

function formatBytes(value: number | null) {
  if (value === null) return "—";
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(1)} KB`;
}

function formatTime(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function GardenHealthPanel({ session }: { session: Session }) {
  const [state, setState] = useState<HealthState>({ status: "checking" });
  const [refreshing, setRefreshing] = useState(false);

  const loadHealth = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/community-garden/admin/health", {
        cache: "no-store",
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      if (response.status === 401 || response.status === 403) {
        setState({ status: "hidden" });
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Garden health could not be loaded.");
      }
      setState({
        status: "ready",
        health: (await response.json()) as CommunityGardenHealth,
      });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Garden health could not be loaded.",
      });
    } finally {
      setRefreshing(false);
    }
  }, [session.access_token]);

  useEffect(() => {
    queueMicrotask(() => void loadHealth());
  }, [loadHealth]);

  if (state.status === "checking" || state.status === "hidden") return null;

  if (state.status === "error") {
    return (
      <section className="cg-health-panel is-error" aria-labelledby="cg-health-title">
        <div className="cg-steward-section-heading">
          <div>
            <p className="cg-kicker">Private admin</p>
            <h3 id="cg-health-title">Garden health</h3>
          </div>
        </div>
        <p>{state.message}</p>
        <button type="button" disabled={refreshing} onClick={() => void loadHealth()}>
          Try again
        </button>
      </section>
    );
  }

  const { health } = state;
  const statusLabel =
    health.status === "healthy"
      ? "Healthy"
      : health.status === "elevated"
        ? "Elevated"
        : "Degraded";

  return (
    <section className="cg-health-panel" aria-labelledby="cg-health-title">
      <div className="cg-health-heading">
        <div>
          <p className="cg-kicker">Private admin</p>
          <h3 id="cg-health-title">Garden health</h3>
          <small>Anonymous operational signals only</small>
        </div>
        <div className={`cg-health-status is-${health.status}`}>
          <span aria-hidden="true" />
          {statusLabel}
        </div>
      </div>

      <div className="cg-health-grid">
        <dl>
          <div><dt>Active now</dt><dd>{health.activeUsers5m}</dd></div>
          <div><dt>Active 15 min</dt><dd>{health.activeUsers15m}</dd></div>
          <div><dt>New sessions today</dt><dd>{health.newSessions24h}</dd></div>
        </dl>
        <dl>
          <div><dt>Actions 10 min</dt><dd>{health.actions10m}</dd></div>
          <div><dt>Successful</dt><dd>{health.actionSuccessPercent}%</dd></div>
          <div><dt>Failed</dt><dd>{health.actionFailures10m}</dd></div>
        </dl>
        <dl>
          <div><dt>Average action</dt><dd>{formatDuration(health.averageActionMs)}</dd></div>
          <div><dt>Slowest action</dt><dd>{formatDuration(health.maxActionMs)}</dd></div>
          <div><dt>Snapshot failures</dt><dd>{health.snapshotFailures10m}</dd></div>
        </dl>
      </div>

      <div className="cg-health-details">
        <div>
          <strong>Current garden</strong>
          <span>{health.snapshot.plantCount ?? "—"} plants</span>
          <small>{formatBytes(health.snapshot.payloadBytes)} snapshot</small>
        </div>
        <div>
          <strong>Active devices</strong>
          <span>
            {health.devices15m.phone} phone · {health.devices15m.tablet} tablet ·{" "}
            {health.devices15m.desktop} desktop
          </span>
          <small>Last 15 minutes</small>
        </div>
        <div>
          <strong>Last recorded error</strong>
          <span>{formatTime(health.lastErrorAt)}</span>
          <small>Action or snapshot only</small>
        </div>
        <div>
          <strong>Commons today</strong>
          <span>{health.commons.careAwardedToday} Care · {health.commons.mutationsToday} actions</span>
          <small>{health.commons.activeContributorsToday} anonymous contributors</small>
        </div>
        <div>
          <strong>Region pressure</strong>
          <span>{health.commons.busyRegions} busy · {health.commons.restingRegions} resting</span>
          <small>Densest region: {health.commons.densestRegionPlants} / 180 plants</small>
        </div>
        <div>
          <strong>Garden capacity</strong>
          <span>{health.commons.gardenOccupancyPercent}% occupied</span>
          <small>
            {health.commons.expansionRecommended
              ? "Expansion threshold reached"
              : `${health.commons.scheduledSuccession} succeeding · ${health.commons.weeds} weeds`}
          </small>
        </div>
      </div>

      <div className="cg-funnel-heading">
        <div>
          <strong>Launch funnel</strong>
          <small>
            Anonymous first-touch sessions · last {health.funnel.windowDays} days
          </small>
        </div>
        <span>{health.funnel.uniqueSessions} sessions</span>
      </div>

      <div className="cg-funnel-steps" aria-label="Basil launch funnel">
        {health.funnel.steps.map((step) => (
          <div key={step.event}>
            <strong>{step.sessions}</strong>
            <span>{step.label}</span>
            <small>{step.conversionFromPrevious}% from prior</small>
          </div>
        ))}
      </div>

      <div className="cg-funnel-breakdowns">
        <div>
          <strong>Preview continuation</strong>
          <ul>
            <li><span>Soft offer viewed</span><b>{health.funnel.previewJourney.softPaywallViews}</b></li>
            <li><span>Chose to keep playing</span><b>{health.funnel.previewJourney.softDeclines}</b></li>
            <li><span>Earned Care afterward</span><b>{health.funnel.previewJourney.continuedAfterDecline}</b></li>
            <li><span>Reached ten-flower limit</span><b>{health.funnel.previewJourney.hardPaywallViews}</b></li>
            <li><span>24-hour previews expired</span><b>{health.funnel.previewJourney.expiredPreviews}</b></li>
          </ul>
        </div>
        <div>
          <strong>Devices</strong>
          {health.funnel.devices.length ? (
            <ul>
              {health.funnel.devices.map((device) => (
                <li key={device.device}>
                  <span>{device.device}</span><b>{device.sessions}</b>
                </li>
              ))}
            </ul>
          ) : <small>No launch sessions yet.</small>}
        </div>
        <div>
          <strong>Campaign / creative</strong>
          {health.funnel.attribution.length ? (
            <ul>
              {health.funnel.attribution.slice(0, 8).map((row) => (
                <li key={`${row.source}:${row.medium}:${row.campaign}:${row.creative}`}>
                  <span>{row.campaign} · {row.creative}</span>
                  <b>{row.sessions} / {row.purchases}</b>
                </li>
              ))}
            </ul>
          ) : <small>No attributed sessions yet.</small>}
        </div>
        <div>
          <strong>Recoverable failures</strong>
          <ul>
            <li><span>Garden actions</span><b>{health.funnel.failures.gardenActions}</b></li>
            <li><span>Garden restorations</span><b>{health.funnel.failures.gardenRestorations}</b></li>
            <li><span>Checkout canceled</span><b>{health.funnel.failures.checkoutCanceled}</b></li>
          </ul>
        </div>
      </div>

      <div className="cg-health-footer">
        <small>
          Measured {formatTime(health.measuredAt)} · raw funnel retention {health.funnel.retentionDays} days
        </small>
        <button type="button" disabled={refreshing} onClick={() => void loadHealth()}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </section>
  );
}
