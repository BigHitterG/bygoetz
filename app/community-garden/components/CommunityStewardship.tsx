"use client";

import { useState } from "react";

import type {
  GardenStewardshipNotification,
  GardenStewardshipPoint,
  GardenStewardshipSummary,
} from "../lib/stewardshipTypes";
import {
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
          <strong>{summary.flowers.living} / {summary.capacity}</strong>
          <span>flowers growing</span>
        </div>
      </header>

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

      <div className="cg-garden-task-list">
        {summary.tasks.map((task) => (
          <article className="cg-garden-task" key={task.id}>
            <div className="cg-garden-task-copy">
              <small>{task.category.replace("_", " ")}</small>
              <strong>{task.title}</strong>
              <p>{task.description}</p>
            </div>
            <div className="cg-garden-task-progress">
              <span>{task.progress} / {task.target}</span>
              <div aria-hidden="true">
                <i style={{ width: `${Math.min(100, (task.progress / task.target) * 100)}%` }} />
              </div>
            </div>
            {onReplace ? (
              <button
                type="button"
                disabled={!replacementReady || replacingId === task.id}
                onClick={() => onReplace(task.id)}
              >
                {replacingId === task.id
                  ? "Replacing…"
                  : replacementReady
                    ? "Replace task"
                    : "Replacement used today"}
              </button>
            ) : null}
          </article>
        ))}
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
              Recent plantings
            </button>
          ) : null}
          {onNavigate && summary.flowers.oldest ? (
            <button type="button" onClick={() => onNavigate("oldest", summary.flowers.oldest!)}>
              Oldest flower
            </button>
          ) : null}
          {onNavigate && summary.flowers.mainCluster ? (
            <button type="button" onClick={() => onNavigate("cluster", summary.flowers.mainCluster!)}>
              Main cluster
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
  return (
    <div className="cg-stewardship-celebration" role="dialog" aria-modal="true" aria-labelledby="cg-stewardship-celebration-title">
      <div className="cg-stewardship-confetti" aria-hidden="true">✦ · ❀ · ✦</div>
      <p className="cg-kicker">{isRank ? "Stewardship rank" : isProject ? "Together we grew" : "Accolade earned"}</p>
      <h2 id="cg-stewardship-celebration-title">{title}</h2>
      <p>
        {isRank
          ? `Your ordinary Community Garden footprint now holds ${notification.payload.capacity ?? "more"} flowers.`
          : notification.payload.description ?? "Your contribution has been added to your Garden Journal."}
      </p>
      <button type="button" onClick={onClose}>Continue gardening</button>
    </div>
  );
}
