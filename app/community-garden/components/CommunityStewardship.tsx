"use client";

import { useState } from "react";

import type {
  GardenStewardshipNotification,
  GardenStewardshipPoint,
  GardenStewardshipSummary,
} from "../lib/stewardshipTypes";
import {
  GARDEN_STEWARDSHIP_RANKS,
  getGardenStewardshipRankName,
  getNextGardenStewardshipRank,
} from "../lib/stewardshipTypes";

type NavigateTarget = "recent" | "oldest" | "cluster";

export function CommunityStewardshipPanel({
  summary,
  compact = false,
  replacingId,
  onReplace,
  onNavigate,
  onToggleFlowers,
  flowersVisible = false,
}: {
  summary: GardenStewardshipSummary;
  compact?: boolean;
  replacingId?: string | null;
  onReplace?: (assignmentId: string) => void;
  onNavigate?: (target: NavigateTarget, point: GardenStewardshipPoint) => void;
  onToggleFlowers?: () => void;
  flowersVisible?: boolean;
}) {
  const [renderedAt] = useState(() => Date.now());
  const nextRank = getNextGardenStewardshipRank(summary.rankKey);
  const replacementReady =
    !summary.replacementAvailableAt ||
    Date.parse(summary.replacementAvailableAt) <= renderedAt;

  return (
    <section className={`cg-stewardship-panel${compact ? " is-compact" : ""}`}>
      <header className="cg-stewardship-heading">
        <div>
          <p className="cg-kicker">Community Stewardship</p>
          <h3>{getGardenStewardshipRankName(summary.rankKey)}</h3>
        </div>
        <div className="cg-stewardship-footprint">
          <span>Current footprint</span>
          <strong>{summary.capacity}</strong>
          {nextRank ? (
            <small>
              Next footprint goal <b>{nextRank.capacity}</b> · {nextRank.name}
            </small>
          ) : (
            <small>Largest lasting footprint</small>
          )}
        </div>
      </header>

      <details className="cg-stewardship-explainer">
        <summary>How Stewardship works</summary>
        <p>
          Garden Tasks build your Stewardship rank. Higher ranks let more of your
          newest ordinary flowers remain in the shared garden. Care still buys
          land and items in My Garden.
        </p>
      </details>

      <div className="cg-stewardship-rank-ladder" aria-label="Stewardship ranks">
        {GARDEN_STEWARDSHIP_RANKS.map((rank) => {
          const currentIndex = GARDEN_STEWARDSHIP_RANKS.findIndex(
            (item) => item.key === summary.rankKey,
          );
          const rankIndex = GARDEN_STEWARDSHIP_RANKS.findIndex(
            (item) => item.key === rank.key,
          );
          return (
            <div
              className={`${rank.key === summary.rankKey ? "is-current" : ""}${
                rankIndex < currentIndex ? " is-earned" : ""
              }`}
              key={rank.key}
            >
              <i aria-hidden="true" />
              <strong>{rank.name}</strong>
              <span>{rank.capacity}</span>
            </div>
          );
        })}
      </div>

      <div className="cg-stewardship-rank-progress">
        <span>{summary.tasksCompleted} tasks</span>
        <span>{summary.categoriesCompleted} categories</span>
        <span>{summary.activeDays} garden days</span>
      </div>
      {nextRank ? (
        <p className="cg-stewardship-next">
          Next: <strong>{nextRank.name}</strong> · {Math.max(0, nextRank.tasks - summary.tasksCompleted)} tasks,
          {" "}{Math.max(0, nextRank.categories - summary.categoriesCompleted)} categories,
          {" "}{Math.max(0, nextRank.activeDays - summary.activeDays)} garden days remaining.
        </p>
      ) : (
        <p className="cg-stewardship-next">The garden recognizes you as an Elder Gardener.</p>
      )}

      <details className="cg-stewardship-footprint-note">
        <summary>Your public footprint</summary>
        <p>
          {summary.flowers.living} of {summary.capacity} ordinary flowers are
          currently growing. At the limit, planting a new flower keeps the new
          one and gently releases your oldest ordinary flower.
        </p>
      </details>

      <div>
        <div className="cg-garden-task-heading">
          <h4>Today&apos;s Garden Tasks</h4>
          <span>{summary.tasks.filter((task) => task.status === "completed").length} of 3 done</span>
        </div>
        <div className="cg-garden-task-list">
          {summary.tasks.map((task) => {
            const complete = task.status === "completed";
            return (
              <article className={`cg-garden-task${complete ? " is-complete" : ""}`} key={task.id}>
                <div className="cg-garden-task-copy">
                  <small>{task.category.replace("_", " ")}</small>
                  <strong>{task.title}</strong>
                  <p>{task.description}</p>
                </div>
                <div className="cg-garden-task-progress">
                  <span>{complete ? "Done today" : `${task.progress} / ${task.target}`}</span>
                  <div aria-hidden="true">
                    <i style={{ width: `${Math.min(100, (task.progress / task.target) * 100)}%` }} />
                  </div>
                </div>
                {!complete && onReplace && replacementReady ? (
                  <button
                    type="button"
                    disabled={replacingId === task.id}
                    onClick={() => onReplace(task.id)}
                  >
                    {replacingId === task.id ? "Swapping…" : "Swap task"}
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
        {!replacementReady ? (
          <p className="cg-task-swap-status">Task swap used · available tomorrow</p>
        ) : null}
      </div>

      {summary.project ? (
        <article className="cg-community-project">
          <p className="cg-kicker">Community project</p>
          <strong>{summary.project.title}</strong>
          <p>{summary.project.description}</p>
          <div className="cg-community-project-progress">
            <span>Garden {summary.project.globalProgress} / {summary.project.globalTarget}</span>
            <span>You {summary.project.personalProgress} / {summary.project.personalTarget}</span>
          </div>
        </article>
      ) : null}

      {onToggleFlowers || onNavigate ? (
        <div className="cg-stewardship-map-tools">
          {onToggleFlowers ? (
            <button type="button" onClick={onToggleFlowers}>
              {flowersVisible ? "Hide my flowers" : "Show my flowers"}
            </button>
          ) : null}
          {onNavigate && summary.flowers.recent ? (
            <button type="button" onClick={() => onNavigate("recent", summary.flowers.recent!)}>
              Find recent plantings
            </button>
          ) : null}
          {onNavigate && summary.flowers.oldest ? (
            <button type="button" onClick={() => onNavigate("oldest", summary.flowers.oldest!)}>
              Find oldest flower
            </button>
          ) : null}
          {onNavigate && summary.flowers.mainCluster ? (
            <button type="button" onClick={() => onNavigate("cluster", summary.flowers.mainCluster!)}>
              Show main cluster
            </button>
          ) : null}
        </div>
      ) : null}

      {!compact && summary.recentAccolades.length > 0 ? (
        <div className="cg-stewardship-accolades">
          <h4>Recent accolades</h4>
          <ul>
            {summary.recentAccolades.slice(0, 6).map((accolade) => (
              <li key={accolade.id}><span aria-hidden="true">✦</span>{accolade.title}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function GardenTaskCelebration({
  notification,
  onClose,
}: {
  notification: GardenStewardshipNotification | null;
  onClose: () => void;
}) {
  if (!notification) return null;
  const isRank = notification.type === "rank_up";
  const isProject = notification.type === "project_complete";
  const title = isRank
    ? `${getGardenStewardshipRankName(notification.payload.rankKey ?? "gardener")} reached`
    : notification.payload.title ?? (isProject ? "Community project complete" : "Garden Task complete");

  if (!isRank) {
    return (
      <aside className="cg-stewardship-toast" role="status" aria-live="polite">
        <span aria-hidden="true">✓</span>
        <div>
          <small>{isProject ? "Community project" : "Garden Task complete"}</small>
          <strong>{title}</strong>
        </div>
        <button type="button" aria-label="Dismiss notification" onClick={onClose}>×</button>
      </aside>
    );
  }

  return (
    <div className="cg-stewardship-celebration" role="dialog" aria-modal="true" aria-labelledby="cg-stewardship-celebration-title">
      <div className="cg-stewardship-confetti" aria-hidden="true">✦ · ❀ · ✦</div>
      <p className="cg-kicker">Stewardship rank</p>
      <h2 id="cg-stewardship-celebration-title">{title}</h2>
      <p>Your ordinary Community Garden footprint now holds {notification.payload.capacity ?? "more"} flowers.</p>
      <button type="button" onClick={onClose}>Continue gardening</button>
    </div>
  );
}
