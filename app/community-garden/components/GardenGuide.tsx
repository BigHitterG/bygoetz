const LIFE_STAGES = [
  { name: "Seed", className: "is-seed" },
  { name: "Sprout", className: "is-sprout" },
  { name: "Growing", className: "is-growing" },
  { name: "Bloom", className: "is-blooming" },
  { name: "Wilt", className: "is-wilting" },
  { name: "Return", className: "is-returned" },
] as const;

export function GardenGuide() {
  return (
    <section className="cg-guide cg-library-section" aria-labelledby="garden-guide-title">
      <p className="cg-kicker">A shared living artwork</p>
      <h3 id="garden-guide-title">Garden Guide</h3>

      <dl className="cg-guide-list">
        <div>
          <dt>Explore</dt>
          <dd>Tap the ground to walk. Use - and + for a wider or closer view.</dd>
        </div>
        <div>
          <dt>Travel</dt>
          <dd>The red dots on the map are roses. Tap anywhere on the map to visit.</dd>
        </div>
        <div>
          <dt>Care</dt>
          <dd>Select an open spot, choose a seed, and plant. Select any living plant to water it.</dd>
        </div>
        <div>
          <dt>Choose</dt>
          <dd>Rose, sunflower, and lavender each grow and return at a different pace.</dd>
        </div>
      </dl>

      <div className="cg-life-guide">
        <h4>One shared life cycle</h4>
        <ol>
          {LIFE_STAGES.map((stage) => (
            <li key={stage.name}>
              <span className={`cg-stage-icon ${stage.className}`} aria-hidden="true" />
              <span>{stage.name}</span>
            </li>
          ))}
        </ol>
        <p>
          Water renews a plant&apos;s care clock. Without care it wilts, returns
          to the soil, and leaves room for something new.
        </p>
      </div>

      <p className="cg-guide-principle">
        No accounts. No owners. No scores. The garden remembers the care, never
        who gave it.
      </p>
      <div className="cg-play-notes">
        <h4>How this world decides</h4>
        <p>
          Care is the vote. Plants that are watered remain. Future paths and
          objects will follow the same rhythm, slowly returning to open ground
          when the community stops maintaining them.
        </p>
      </div>
    </section>
  );
}

