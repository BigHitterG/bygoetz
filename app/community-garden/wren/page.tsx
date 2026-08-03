import type { Metadata } from "next";
import { getWrenPublicProfile } from "@/lib/communityGarden/wrenAgent";
import styles from "./wren.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wren | Basil AI Garden Steward",
  description: "A transparent record of Wren, Basil's AI-directed garden steward, current mission, My Garden, and recent work.",
};

export default async function WrenPage() {
  const wren = await getWrenPublicProfile();
  const mission = wren.currentMission;
  const actionTotal = Object.values(wren.last24Hours).reduce(
    (sum, count) => sum + count,
    0,
  );

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.sprite} aria-hidden="true"><span>W</span></div>
        <div>
          <p>Basil system resident</p>
          <h1>Wren</h1>
          <strong>{wren.disclosure.label}</strong>
          <p>{wren.publicBio}</p>
        </div>
      </header>

      <section className={styles.disclosure}>
        <h2>What &quot;AI-directed&quot; means</h2>
        <p>{wren.disclosure.text}</p>
        <dl>
          <div><dt>Autonomy</dt><dd>Tier {wren.disclosure.autonomyTier}</dd></div>
          <div><dt>Planner</dt><dd>{wren.disclosure.plannerMode.replaceAll("_", " ")}</dd></div>
          <div><dt>Always connected to a model</dt><dd>No</dd></div>
          <div><dt>Future live-agent adapter</dt><dd>Supported, disabled</dd></div>
        </dl>
      </section>

      <section className={styles.grid}>
        <article>
          <p>Current mission</p>
          <h2>{mission?.objective ?? "Waiting for the next scheduled Codex mission"}</h2>
          <span>{mission ? `${mission.scope.replaceAll("_", " ")} / ${mission.status}` : "No active mission"}</span>
        </article>
        <article>
          <p>Wren&apos;s My Garden</p>
          <h2>{wren.myGarden.plantCount} plants</h2>
          <span>{wren.myGarden.pathCount} paths / {wren.myGarden.habitatCount} habitats / plot level {wren.myGarden.plotLevel}</span>
        </article>
        <article>
          <p>Last 24 hours</p>
          <h2>{actionTotal} logged actions</h2>
          <span>{Object.entries(wren.last24Hours).map(([name, count]) => `${count} ${name}`).join(" / ") || "No completed actions yet"}</span>
        </article>
      </section>

      <section className={styles.budget}>
        <h2>Transparent garden budget</h2>
        <p>Wren&apos;s non-player My Garden maintenance budget is capped at eight Care per day and is stored in a private audit ledger. It does not increase human lifetime progression or consume player rewards.</p>
      </section>

      <footer>
        <a href="/community-garden">Visit the Community Garden</a>
        <a href="/api/community-garden/wren">View Wren&apos;s machine-readable record</a>
      </footer>
    </main>
  );
}
