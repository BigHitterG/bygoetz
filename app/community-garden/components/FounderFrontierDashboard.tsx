"use client";

import { useState, type CSSProperties } from "react";
import type {
  CommunityGardenFrontierHealth,
  CommunityGardenFrontierMapCell,
} from "@/lib/communityGarden/health";

type FrontierOverlay = "state" | "density" | "support" | "heritage";

const OVERLAYS: Array<{ id: FrontierOverlay; label: string }> = [
  { id: "state", label: "Land" },
  { id: "density", label: "Density" },
  { id: "support", label: "Support" },
  { id: "heritage", label: "Heritage" },
];

function cellKey(regionX: number, regionY: number) {
  return `${regionX}:${regionY}`;
}

function clampedRatio(value: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(Math.max(value / target, 0), 1);
}

function cellLevel(
  cell: CommunityGardenFrontierMapCell,
  overlay: FrontierOverlay,
  policy: CommunityGardenFrontierHealth["policy"],
) {
  let ratio = 0;
  if (overlay === "density") {
    ratio = clampedRatio(cell.plantCount, policy.effectiveRegionCapacity);
  } else if (overlay === "support") {
    ratio =
      (
        clampedRatio(cell.eligibleLivePlants, policy.supportedLivePlants) +
        clampedRatio(cell.coveredSubcells, policy.supportedSubcells) +
        clampedRatio(cell.eligibleAccounts7d, cell.requiredAccounts) +
        clampedRatio(cell.activeDays7d, policy.supportedActiveDays) +
        clampedRatio(
          cell.consecutiveSupportDays,
          policy.supportedConsecutiveDays,
        )
      ) / 5;
  } else if (overlay === "heritage") {
    ratio = clampedRatio(
      cell.heritageFlowers,
      Math.max(cell.heritageCapacity, policy.heritageCapacityPerRegion),
    );
  }
  return Math.min(Math.ceil(ratio * 5), 5);
}

function stateLabel(cell: CommunityGardenFrontierMapCell) {
  if (!cell.regionExists) return "Unopened candidate";
  if (cell.landState === "founding") return "Founding Garden";
  if (cell.landState === "established") return "Established land";
  if (cell.landState === "frontier") return "Active frontier";
  return "Fallow land";
}

function decisionLabel(action: CommunityGardenFrontierMapCell["recommendedAction"]) {
  if (action === "prepare") return "Review for opening";
  if (action === "establish") return "Review for establishment";
  if (action === "restore") return "Review for restoration";
  return "No action";
}

function trendPoints(values: number[], width = 320, height = 72) {
  if (values.length === 0) return "";
  const maximum = Math.max(...values, 1);
  const minimum = Math.min(...values, 0);
  const range = Math.max(maximum - minimum, 1);
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - minimum) / range) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function ProgressMetric({
  label,
  value,
  target,
  suffix = "",
}: {
  label: string;
  value: number;
  target: number;
  suffix?: string;
}) {
  return (
    <div className="cg-frontier-progress-row">
      <div>
        <span>{label}</span>
        <b>
          {value}{suffix} / {target}{suffix}
        </b>
      </div>
      <progress max={Math.max(target, 1)} value={Math.min(value, target)}>
        {value} of {target}
      </progress>
    </div>
  );
}

export function FounderFrontierDashboard({
  frontier,
  measuredAt,
}: {
  frontier: CommunityGardenFrontierHealth;
  measuredAt: string;
}) {
  const [overlay, setOverlay] = useState<FrontierOverlay>("state");
  const firstDecision = frontier.map.cells.find(
    (cell) => cell.recommendedAction !== "none",
  );
  const firstOpenCell = frontier.map.cells.find((cell) => cell.regionExists);
  const [selectedKey, setSelectedKey] = useState(() =>
    firstDecision
      ? cellKey(firstDecision.regionX, firstDecision.regionY)
      : firstOpenCell
        ? cellKey(firstOpenCell.regionX, firstOpenCell.regionY)
        : "",
  );

  const cellsByKey = new Map(
    frontier.map.cells.map((cell) => [cellKey(cell.regionX, cell.regionY), cell]),
  );
  const selected =
    cellsByKey.get(selectedKey) ?? firstDecision ?? firstOpenCell ?? null;
  const decisions = frontier.map.cells.filter(
    (cell) => cell.recommendedAction !== "none",
  );
  const latestTrend = frontier.trends.at(-1) ?? null;
  const firstTrend = frontier.trends.at(0) ?? null;
  const occupancyChange =
    latestTrend && firstTrend
      ? Number((latestTrend.occupancyPercent - firstTrend.occupancyPercent).toFixed(2))
      : 0;
  const evaluationAgeMs = frontier.evaluatedAt
    ? new Date(measuredAt).getTime() - new Date(frontier.evaluatedAt).getTime()
    : Number.POSITIVE_INFINITY;
  const evaluationIsLate = evaluationAgeMs > 36 * 60 * 60 * 1000;
  const ownerStatus = evaluationIsLate
    ? {
        tone: "attention",
        title: "Frontier check needs attention",
        copy: "The daily evaluation is more than 36 hours old. Ordinary gameplay is still available.",
      }
    : decisions.length > 0
      ? {
          tone: "review",
          title: `${decisions.length} region${decisions.length === 1 ? "" : "s"} ready for review`,
          copy: "The system has made recommendations, but no land will change without a later confirmed owner action.",
        }
      : {
          tone: "clear",
          title: "No owner decisions required",
          copy: "The garden is healthy and the frontier is still gathering distributed community support.",
        };

  const gridItems: Array<CommunityGardenFrontierMapCell | null> = [];
  const { minX, maxX, minY, maxY } = frontier.map.bounds;
  const columnCount = Math.max(maxX - minX + 1, 1);
  const mapStyle = {
    "--cg-frontier-columns": columnCount,
  } as CSSProperties;
  if ([minX, maxX, minY, maxY].every(Number.isFinite)) {
    for (let y = maxY; y >= minY; y -= 1) {
      for (let x = minX; x <= maxX; x += 1) {
        gridItems.push(cellsByKey.get(cellKey(x, y)) ?? null);
      }
    }
  }

  return (
    <section className="cg-frontier-dashboard" aria-labelledby="cg-frontier-map-title">
      <div className={`cg-frontier-owner-status is-${ownerStatus.tone}`}>
        <div>
          <small>Founder status</small>
          <strong>{ownerStatus.title}</strong>
          <p>{ownerStatus.copy}</p>
        </div>
        <span aria-hidden="true">{ownerStatus.tone === "clear" ? "✓" : "!"}</span>
      </div>

      <div className="cg-frontier-stage-note">
        <div>
          <small>Community stage</small>
          <strong>{frontier.communityStage}</strong>
        </div>
        <p>
          Guest flowers currently count at {frontier.guestAssist.weightPercent}%
          physical support, capped at {frontier.guestAssist.maximumSharePercent}%
          of a region. Guests never count as gardeners.
          {frontier.recommendationCooldownDays > 0
            ? ` New expansion recommendations are paced to one every ${frontier.recommendationCooldownDays} days after a land change.`
            : " Standard community quorum pacing is active."}
        </p>
      </div>

      <div className="cg-frontier-section-heading">
        <div>
          <p className="cg-kicker">Private stewardship map</p>
          <h3 id="cg-frontier-map-title">How the frontier is forming</h3>
          <small>Each square represents one 16 × 16 region. North is up.</small>
        </div>
        <div className="cg-frontier-overlay-tabs" aria-label="Frontier map view">
          {OVERLAYS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={overlay === option.id ? "is-active" : undefined}
              aria-pressed={overlay === option.id}
              onClick={() => setOverlay(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cg-frontier-layout">
        <div>
          <div className="cg-frontier-map-frame">
            <span className="cg-frontier-north" aria-hidden="true">N</span>
            <div
              className={`cg-frontier-map is-overlay-${overlay}`}
              style={mapStyle}
              role="grid"
              aria-label="Community Garden regional frontier map"
            >
              {gridItems.map((cell, index) => {
                if (!cell) {
                  return <span key={`empty-${index}`} className="cg-frontier-map-gap" />;
                }
                const key = cellKey(cell.regionX, cell.regionY);
                const level = cellLevel(cell, overlay, frontier.policy);
                return (
                  <button
                    key={key}
                    type="button"
                    role="gridcell"
                    className={[
                      "cg-frontier-cell",
                      `is-${cell.landState}`,
                      `is-level-${level}`,
                      !cell.regionExists ? "is-candidate" : "",
                      cell.recommendedAction !== "none" ? "has-decision" : "",
                      key === selectedKey ? "is-selected" : "",
                    ].filter(Boolean).join(" ")}
                    aria-label={`Region ${cell.regionX}, ${cell.regionY}. ${stateLabel(cell)}. ${cell.plantCount} plants. ${decisionLabel(cell.recommendedAction)}.`}
                    aria-selected={key === selectedKey}
                    title={`Region ${cell.regionX}, ${cell.regionY}`}
                    onClick={() => setSelectedKey(key)}
                  >
                    {cell.heritageFlowers > 0 ? <span aria-hidden="true">✦</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="cg-frontier-legend" aria-label="Frontier map legend">
            <span><i className="is-founding" />Founding</span>
            <span><i className="is-established" />Established</span>
            <span><i className="is-frontier" />Frontier</span>
            <span><i className="is-candidate" />Candidate</span>
            <span><i className="is-fallow" />Fallow</span>
            <span><i className="has-decision" />Review</span>
          </div>
        </div>

        {selected ? (
          <article className="cg-frontier-region-detail" aria-live="polite">
            <div className="cg-frontier-region-title">
              <div>
                <small>{stateLabel(selected)}</small>
                <h4>Region {selected.regionX}, {selected.regionY}</h4>
              </div>
              <span>{selected.occupancyPercent}% full</span>
            </div>
            <ProgressMetric
              label="Supported flowers"
              value={selected.eligibleLivePlants}
              target={frontier.policy.supportedLivePlants}
            />
            <ProgressMetric
              label="Area coverage"
              value={selected.coveredSubcells}
              target={frontier.policy.supportedSubcells}
            />
            <ProgressMetric
              label="Unique gardeners"
              value={selected.eligibleAccounts7d}
              target={selected.requiredAccounts}
            />
            <ProgressMetric
              label="Active days"
              value={selected.activeDays7d}
              target={frontier.policy.supportedActiveDays}
            />
            <ProgressMetric
              label="Support streak"
              value={selected.consecutiveSupportDays}
              target={frontier.policy.supportedConsecutiveDays}
            />
            <div className="cg-frontier-region-facts">
              <span><b>{selected.plantCount}</b> living plants</span>
              <span><b>{selected.heritageFlowers}</b> Heritage</span>
              <span><b>+{selected.guestAssistLivePlants}</b> Guest Assist</span>
              <span><b>{selected.recommendedAction === "none" ? "—" : selected.recommendedAction}</b> recommendation</span>
            </div>
            {selected.guestLivePlants > 0 ? (
              <p className="cg-frontier-guest-note">
                {selected.guestLivePlants} temporary guest flower
                {selected.guestLivePlants === 1 ? " is" : "s are"} adding {" "}
                {selected.guestAssistLivePlants} supported-flower credit and {" "}
                {selected.guestAssistSubcells} coverage section
                {selected.guestAssistSubcells === 1 ? "" : "s"}. Account activity
                is still required for the region to advance.
              </p>
            ) : null}
            {selected.reasons.length > 0 ? (
              <details>
                <summary>Why this region is not advancing yet</summary>
                <ul>
                  {selected.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              </details>
            ) : (
              <p className="cg-frontier-region-ready">
                This region has met the measured local requirements.
              </p>
            )}
          </article>
        ) : null}
      </div>

      <div className="cg-frontier-lower-grid">
        <article className="cg-frontier-decisions">
          <div>
            <small>Owner decision inbox</small>
            <strong>{decisions.length ? `${decisions.length} to review` : "Nothing waiting"}</strong>
          </div>
          {decisions.length ? (
            <ul>
              {decisions.map((cell) => (
                <li key={cellKey(cell.regionX, cell.regionY)}>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(cellKey(cell.regionX, cell.regionY))}
                  >
                    <span>Region {cell.regionX}, {cell.regionY}</span>
                    <b>{decisionLabel(cell.recommendedAction)}</b>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>The daily evaluator has not recommended opening, establishing, or restoring land.</p>
          )}
          <small>Read-only: this dashboard cannot change the garden.</small>
        </article>

        <article className="cg-frontier-trends">
          <div>
            <small>Last {frontier.trends.length || 1} daily checks</small>
            <strong>Garden growth</strong>
          </div>
          {frontier.trends.length ? (
            <>
              <svg viewBox="0 0 320 72" role="img" aria-label="Garden occupancy trend">
                <polyline
                  points={trendPoints(frontier.trends.map((trend) => trend.occupancyPercent))}
                />
              </svg>
              <div className="cg-frontier-trend-facts">
                <span><b>{latestTrend?.occupancyPercent ?? 0}%</b> occupied</span>
                <span><b>{occupancyChange > 0 ? "+" : ""}{occupancyChange}%</b> change</span>
                <span><b>{latestTrend?.activeAccounts7d ?? 0} / {latestTrend?.requiredAccounts ?? 0}</b> gardeners</span>
              </div>
            </>
          ) : <p>Trend history will appear after the daily frontier check runs.</p>}
        </article>

        <article className="cg-frontier-history">
          <div>
            <small>Permanent audit trail</small>
            <strong>Recent land changes</strong>
          </div>
          {frontier.recentStateChanges.length ? (
            <ul>
              {frontier.recentStateChanges.slice(0, 5).map((change) => (
                <li key={change.id}>
                  <span>Region {change.regionX}, {change.regionY}</span>
                  <b>{change.previousState ?? "unopened"} → {change.nextState}</b>
                  <small>{change.reason}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>No frontier land has been changed. The Founding Garden remains intact.</p>
          )}
        </article>
      </div>
    </section>
  );
}
