import {
  getMyGardenCollection,
  MY_GARDEN_PLANTS,
} from "../lib/myGardenCatalog";
import {
  getPlantDefinition,
  PLANT_TYPES,
  SPECIAL_WATERING_FLOWER_NAME,
  type CommunityPlantType,
} from "../lib/roseLifecycle";
import { GardenCatalogSprite } from "./GardenCatalogSprite";

function matchesQuery(query: string, ...values: Array<string | number>) {
  if (!query) return true;
  const haystack = values.join(" ").toLowerCase();
  return query.split(/\s+/).every((term) => haystack.includes(term));
}

export function PlantGlossary({ query = "" }: { query?: string }) {
  const plants = MY_GARDEN_PLANTS.filter((catalogPlant) => {
    const plant = getPlantDefinition(catalogPlant.type);
    const collection = getMyGardenCollection(catalogPlant.collection);
    return matchesQuery(
      query,
      plant.name,
      plant.scientificName,
      plant.character,
      plant.realWorldLifespan,
      plant.gameLifespan,
      plant.absoluteLifespan,
      collection.name,
    );
  });
  const showCareBlossom = matchesQuery(query, SPECIAL_WATERING_FLOWER_NAME, "rare white watering bonus red center");
  const showHeritage = matchesQuery(query, "Heritage Flower permanent gold aura lifespan landmark community");
  const showWeed = matchesQuery(query, "weed pressure crowded patch pull care");

  return (
    <section className="cg-library-section" aria-labelledby="plant-glossary-title">
      <p className="cg-kicker">Living collection</p>
      <h3 id="plant-glossary-title">Plant Encyclopedia</h3>
      <p className="cg-library-intro">
        Community Garden flowers have a care clock and a maximum season. My Garden
        flowers are permanent and need no maintenance. Plants that live in both
        gardens show both sets of rules below.
      </p>

      <div className="cg-plant-entries">
        {plants.map((catalogPlant) => {
          const plant = getPlantDefinition(catalogPlant.type);
          const collection = getMyGardenCollection(catalogPlant.collection);
          const communityPlant = PLANT_TYPES.includes(
            catalogPlant.type as CommunityPlantType,
          );
          return (
            <article className="cg-plant-entry" key={plant.type} id={`field-guide-plant-${plant.type}`}>
              <div className="cg-plant-entry-heading">
                <GardenCatalogSprite kind="plant" type={catalogPlant.type} />
                <div>
                  <h4>{plant.name}</h4>
                  <p>{plant.scientificName}</p>
                </div>
              </div>
              <div className="cg-field-guide-badges">
                {communityPlant ? <span>Community Garden</span> : null}
                <span>My Garden</span>
              </div>
              <p>{plant.character}</p>
              <dl>
                <div>
                  <dt>Real garden</dt>
                  <dd>{plant.realWorldLifespan}</dd>
                </div>
                {communityPlant ? (
                  <>
                    <div><dt>Without water</dt><dd>{plant.gameLifespan}</dd></div>
                    <div><dt>Maximum season</dt><dd>{plant.absoluteLifespan}</dd></div>
                  </>
                ) : null}
                <div><dt>My Garden</dt><dd>Permanent · no maintenance</dd></div>
                <div><dt>Collection</dt><dd>{collection.name}</dd></div>
                <div><dt>Unlock</dt><dd>{catalogPlant.lifetimeCareRequired.toLocaleString()} lifetime Care</dd></div>
                <div><dt>Place</dt><dd>{catalogPlant.careCost.toLocaleString()} Care</dd></div>
              </dl>
              <p className="cg-care-note">{plant.careNote}</p>
            </article>
          );
        })}

        {showCareBlossom ? (
          <article className="cg-plant-entry is-care-blossom">
            <div className="cg-plant-entry-heading">
              <span className="cg-care-blossom-glyph" aria-hidden="true"><i /></span>
              <div><h4>{SPECIAL_WATERING_FLOWER_NAME}</h4><p>Special find · Community Garden</p></div>
            </div>
            <p>This tiny white flower occasionally appears beside a Care-ready rose, sunflower, or lavender. Water its flower before the opportunity rests.</p>
            <dl>
              <div><dt>Appearance</dt><dd>White petals with a red center</dd></div>
              <div><dt>Rarity</dt><dd>About 1 in 64 community flowers</dd></div>
              <div><dt>Reward</dt><dd>+2 bonus Care</dd></div>
            </dl>
            <p className="cg-care-note">A Care Blossom is a temporary bonus marker, not a seed or separate plant type.</p>
          </article>
        ) : null}

        {showHeritage ? (
          <article className="cg-plant-entry is-heritage">
            <div className="cg-plant-entry-heading">
              <span className="cg-heritage-flower-glyph" aria-hidden="true">✦</span>
              <div><h4>Heritage Flower</h4><p>Community landmark · not a separate species</p></div>
            </div>
            <p>An ordinary rose, sunflower, or lavender can naturally become Heritage when several gardeners sustain it over time inside a living cluster.</p>
            <dl>
              <div><dt>Minimum age</dt><dd>5 days</dd></div>
              <div><dt>Shared care</dt><dd>3 different days from 3 gardeners</dd></div>
              <div><dt>Garden setting</dt><dd>At least 6 nearby flowers</dd></div>
              <div><dt>Inner ring</dt><dd>4× maximum season</dd></div>
              <div><dt>Outer ring</dt><dd>2× maximum season</dd></div>
            </dl>
            <p className="cg-care-note">Heritage Flowers leave the ordinary 100-flower footprint and keep their place. Nearby flowers still need water. Overlapping protection never stacks; the strongest nearby aura applies.</p>
          </article>
        ) : null}

        {showWeed ? (
          <article className="cg-plant-entry is-weed">
            <div className="cg-plant-entry-heading">
              <span className="cg-plant-glyph is-weed" aria-hidden="true" />
              <div><h4>Weed</h4><p>Ecology · Community Garden</p></div>
            </div>
            <p>Separate volunteer growth that appears only on open tiles in a busy community patch. A weed is not the remains of a flower.</p>
            <dl>
              <div><dt>Appears</dt><dd>From 140 plants in a 16 by 16 patch</dd></div>
              <div><dt>Patch limit</dt><dd>Up to 12 weeds</dd></div>
              <div><dt>Maximum time</dt><dd>36 hours, or sooner if the patch recovers</dd></div>
            </dl>
            <p className="cg-care-note">Pull a weed to reopen its tile and earn Care.</p>
          </article>
        ) : null}
      </div>

      {!plants.length && !showCareBlossom && !showHeritage && !showWeed ? (
        <p className="cg-field-guide-empty">No plant entries match that search.</p>
      ) : null}
    </section>
  );
}
