import {
  getPlantDefinition,
  PLANT_TYPES,
} from "../lib/roseLifecycle";

const FUTURE_PLANTS = [
  {
    name: "Tulip",
    realWorld: "Perennial bulb; may return for several years",
    gameWorld: "84 hours proposed",
  },
  {
    name: "Coneflower",
    realWorld: "Perennial; commonly lives 3 or more years",
    gameWorld: "132 hours proposed",
  },
  {
    name: "Garden sage",
    realWorld: "Woody perennial; often productive for 3-5 years",
    gameWorld: "144 hours proposed",
  },
] as const;

export function PlantGlossary() {
  return (
    <section className="cg-library-section" aria-labelledby="plant-glossary-title">
      <p className="cg-kicker">Living collection</p>
      <h3 id="plant-glossary-title">Plant Encyclopedia</h3>
      <p className="cg-library-intro">
        Every plant has its own compressed rhythm. Watering renews its care clock,
        while its maturity continues from the day it was planted.
      </p>

      <div className="cg-plant-entries">
        {PLANT_TYPES.map((plantType) => {
          const plant = getPlantDefinition(plantType);
          return (
            <article className="cg-plant-entry" key={plant.type}>
              <div className="cg-plant-entry-heading">
                <span className={`cg-plant-glyph is-${plant.type}`} aria-hidden="true" />
                <div>
                  <h4>{plant.name}</h4>
                  <p>{plant.scientificName}</p>
                </div>
              </div>
              <p>{plant.character}</p>
              <dl>
                <div>
                  <dt>Real garden</dt>
                  <dd>{plant.realWorldLifespan}</dd>
                </div>
                <div>
                  <dt>Shared garden</dt>
                  <dd>{plant.gameLifespan}</dd>
                </div>
              </dl>
              <p className="cg-care-note">{plant.careNote}</p>
            </article>
          );
        })}
      </div>

      <div className="cg-life-table-wrap">
        <h4>Garden time</h4>
        <table className="cg-life-table">
          <thead>
            <tr>
              <th scope="col">Plant</th>
              <th scope="col">Real-world life</th>
              <th scope="col">In-game life</th>
            </tr>
          </thead>
          <tbody>
            {PLANT_TYPES.map((plantType) => {
              const plant = getPlantDefinition(plantType);
              return (
                <tr key={plant.type}>
                  <th scope="row">{plant.name}</th>
                  <td>{plant.realWorldLifespan}</td>
                  <td>{plant.gameLifespan}</td>
                </tr>
              );
            })}
            {FUTURE_PLANTS.map((plant) => (
              <tr className="is-future" key={plant.name}>
                <th scope="row">{plant.name}</th>
                <td>{plant.realWorld}</td>
                <td>{plant.gameWorld}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="cg-table-note">
          Real lifespans vary by variety, weather, soil, and care. Proposed plants
          are field notes, not yet available to plant.
        </p>
      </div>
    </section>
  );
}

