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
    <section className="cg-guide" aria-labelledby="garden-guide-title">
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
          <dd>Select an open spot to plant, or select a living rose to water it.</dd>
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
          Water renews a rose. Without care it wilts, returns to the soil, and
          leaves room for something new.
        </p>
      </div>

      <p className="cg-guide-principle">
        No accounts. No owners. No scores. The garden remembers the care, never
        who gave it.
      </p>
      <p className="cg-guide-future">
        Future plants and shared objects will follow the same rule: what the
        community cares for is what remains.
      </p>
    </section>
  );
}

