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
      </div>

      <div className="cg-health-footer">
        <small>Measured {formatTime(health.measuredAt)}</small>
        <button type="button" disabled={refreshing} onClick={() => void loadHealth()}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </section>
  );
}
