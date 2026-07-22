import { getPlantDefinition, PLANT_TYPES } from "../lib/roseLifecycle";

export function PlantGlossary() {
  return (
    <section className="cg-library-section" aria-labelledby="plant-glossary-title">
      <p className="cg-kicker">Living collection</p>
      <h3 id="plant-glossary-title">Plant Encyclopedia</h3>
      <p className="cg-library-intro">
        Every flower has two clocks: watering renews its care clock, while its
        maximum season continues from the day it was planted. Flowers return to
        open ground; they never turn into weeds. Watering is shared, while each
        gardener keeps their own four-hour Care cooldown.
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
                  <dt>Without water</dt>
                  <dd>{plant.gameLifespan}</dd>
                </div>
                <div>
                  <dt>Maximum season</dt>
                  <dd>{plant.absoluteLifespan}</dd>
                </div>
              </dl>
              <p className="cg-care-note">{plant.careNote}</p>
            </article>
          );
        })}
        <article className="cg-plant-entry is-weed">
          <div className="cg-plant-entry-heading">
            <span className="cg-plant-glyph is-weed" aria-hidden="true" />
            <div>
              <h4>Weed</h4>
              <p>Garden pressure</p>
            </div>
          </div>
          <p>
            Separate volunteer growth that appears only on open tiles in a busy
            community patch. A weed is not the remains of a flower.
          </p>
          <dl>
            <div>
              <dt>Appears</dt>
              <dd>From 140 plants in a 16 by 16 patch</dd>
            </div>
            <div>
              <dt>Patch limit</dt>
              <dd>Up to 12 weeds</dd>
            </div>
            <div>
              <dt>Maximum time</dt>
              <dd>36 hours, or sooner if the patch recovers</dd>
            </div>
          </dl>
          <p className="cg-care-note">Pull a weed to reopen its tile and earn Care.</p>
        </article>
      </div>

      <div className="cg-life-table-wrap">
        <h4>Garden time</h4>
        <table className="cg-life-table">
          <thead>
            <tr>
              <th scope="col">Plant</th>
              <th scope="col">Without water</th>
              <th scope="col">Maximum season</th>
            </tr>
          </thead>
          <tbody>
            {PLANT_TYPES.map((plantType) => {
              const plant = getPlantDefinition(plantType);
              return (
                <tr key={plant.type}>
                  <th scope="row">{plant.name}</th>
                  <td>{plant.gameLifespan}</td>
                  <td>{plant.absoluteLifespan}</td>
                </tr>
              );
            })}
            <tr className="is-weed">
              <th scope="row">Weed</th>
              <td>Not a flower care clock</td>
              <td>Up to 36 hours</td>
            </tr>
          </tbody>
        </table>
        <p className="cg-table-note">
          A flower can leave at whichever arrives first: its no-water return time,
          maximum season, or its turn to return as one of your oldest flowers after
          your Community Garden ecological footprint passes 100. Continued planting
          always keeps your newest flowers and reopens older ground for others.
        </p>
      </div>
    </section>
  );
}

