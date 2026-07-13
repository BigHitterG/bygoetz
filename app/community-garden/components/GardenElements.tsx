const ELEMENTS = [
  {
    type: "path",
    name: "Path",
    purpose: "Repeated travel and clearing would keep a route visible.",
    return: "An unused route would soften, overgrow, and become open ground again.",
  },
  {
    type: "bench",
    name: "Bench",
    purpose: "A shared resting place maintained by nearby visits and care.",
    return: "Without attention it would weather, fade, and eventually free its tile.",
  },
  {
    type: "fountain",
    name: "Fountain",
    purpose: "A communal landmark sustained through regular collective upkeep.",
    return: "Neglect would quiet the water, age the stone, and return the space.",
  },
  {
    type: "fence",
    name: "Fence",
    purpose: "A gentle way to shape beds and establish a temporary garden edge.",
    return: "Sections no one maintains would loosen and disappear naturally.",
  },
] as const;

export function GardenElements() {
  return (
    <section className="cg-library-section" aria-labelledby="garden-elements-title">
      <p className="cg-kicker">Field notes</p>
      <h3 id="garden-elements-title">Garden Elements</h3>
      <p className="cg-library-intro">
        These elements are not playable yet. They describe how future structures
        can belong to everyone without ownership or formal voting.
      </p>

      <div className="cg-voting-rule" aria-label="Maintenance as community voting">
        <div>
          <strong>Used and maintained</strong>
          <span>Remains in the garden</span>
        </div>
        <span className="cg-rule-divider" aria-hidden="true">or</span>
        <div>
          <strong>Ignored and unmaintained</strong>
          <span>Deteriorates into an open tile</span>
        </div>
      </div>

      <div className="cg-element-list">
        {ELEMENTS.map((element) => (
          <article key={element.type}>
            <span className={`cg-element-glyph is-${element.type}`} aria-hidden="true" />
            <div>
              <h4>{element.name}</h4>
              <p>{element.purpose}</p>
              <p className="cg-element-return">{element.return}</p>
            </div>
          </article>
        ))}
      </div>

      <p className="cg-guide-principle">
        Continued care becomes a quiet community vote. What people value remains;
        what no one values returns gently to the landscape.
      </p>
    </section>
  );
}

