const WORLD_MIN = -96;
const WORLD_MAX = 63;
const CHUNK_SIZE = 16;
const MIN_NEIGHBORHOOD_PLANTS = 18;
const MAX_CHUNK_PLANTS = 208;
const SPAWN_COUNT = 12;
const SPAWN_SEPARATION = 10;

type FrontierPlant = {
  grid_x: number;
  grid_y: number;
};

export type GardenSpawnPoint = {
  gridX: number;
  gridY: number;
};

type Chunk = {
  chunkX: number;
  chunkY: number;
  plants: number;
};

function getPrimaryChunkKeys(chunks: Map<string, Chunk>) {
  const eligible = new Set(
    Array.from(chunks.values())
      .filter((chunk) => chunk.plants >= 4)
      .map((chunk) => chunkKey(chunk.chunkX, chunk.chunkY)),
  );
  const visited = new Set<string>();
  const components: Array<{ keys: string[]; plants: number }> = [];

  for (const startingKey of eligible) {
    if (visited.has(startingKey)) continue;
    const keys: string[] = [];
    let plants = 0;
    const queue = [startingKey];
    visited.add(startingKey);
    while (queue.length > 0) {
      const key = queue.shift();
      if (!key) continue;
      const chunk = chunks.get(key);
      if (!chunk) continue;
      keys.push(key);
      plants += chunk.plants;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const neighbor = chunkKey(
            chunk.chunkX + offsetX,
            chunk.chunkY + offsetY,
          );
          if (eligible.has(neighbor) && !visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }
    components.push({ keys, plants });
  }

  components.sort((left, right) => right.plants - left.plants);
  return new Set(components[0]?.keys ?? []);
}

function chunkKey(chunkX: number, chunkY: number) {
  return `${chunkX}:${chunkY}`;
}

function plantKey(gridX: number, gridY: number) {
  return `${gridX}:${gridY}`;
}

function isValidCoordinate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= WORLD_MIN &&
    value <= WORLD_MAX
  );
}

function stableCoordinateNoise(gridX: number, gridY: number, version: number) {
  let value = Math.imul(gridX + 113, 73_856_093);
  value ^= Math.imul(gridY + 127, 19_349_663);
  value ^= Math.imul(version | 0, 83_492_791);
  return ((value >>> 0) % 10_000) / 10_000;
}

function getChunkCenter(chunk: Chunk) {
  return {
    gridX: Math.max(
      WORLD_MIN + 2,
      Math.min(WORLD_MAX - 2, chunk.chunkX * CHUNK_SIZE + CHUNK_SIZE / 2),
    ),
    gridY: Math.max(
      WORLD_MIN + 2,
      Math.min(WORLD_MAX - 2, chunk.chunkY * CHUNK_SIZE + CHUNK_SIZE / 2),
    ),
  };
}

function chooseOpenCell(
  chunk: Chunk,
  occupied: Set<string>,
  version: number,
): GardenSpawnPoint | null {
  const center = getChunkCenter(chunk);
  const candidates: Array<GardenSpawnPoint & { score: number }> = [];
  const minX = Math.max(WORLD_MIN + 2, chunk.chunkX * CHUNK_SIZE);
  const maxX = Math.min(WORLD_MAX - 2, minX + CHUNK_SIZE - 1);
  const minY = Math.max(WORLD_MIN + 2, chunk.chunkY * CHUNK_SIZE);
  const maxY = Math.min(WORLD_MAX - 2, minY + CHUNK_SIZE - 1);

  for (let gridY = minY; gridY <= maxY; gridY += 1) {
    for (let gridX = minX; gridX <= maxX; gridX += 1) {
      if (occupied.has(plantKey(gridX, gridY))) continue;
      let nearbyPlants = 0;
      let openNeighbors = 0;
      for (let offsetY = -3; offsetY <= 3; offsetY += 1) {
        for (let offsetX = -3; offsetX <= 3; offsetX += 1) {
          const key = plantKey(gridX + offsetX, gridY + offsetY);
          if (occupied.has(key)) nearbyPlants += 1;
          else if (Math.abs(offsetX) <= 2 && Math.abs(offsetY) <= 2) {
            openNeighbors += 1;
          }
        }
      }
      if (nearbyPlants < 1 || openNeighbors < 17) continue;
      candidates.push({
        gridX,
        gridY,
        score:
          nearbyPlants * 4 +
          openNeighbors * 1.5 -
          Math.hypot(gridX - center.gridX, gridY - center.gridY) +
          stableCoordinateNoise(gridX, gridY, version),
      });
    }
  }

  candidates.sort((left, right) => right.score - left.score);
  const best = candidates[0];
  return best ? { gridX: best.gridX, gridY: best.gridY } : null;
}

export function computeFrontierSpawnPoints(
  input: unknown[],
  version: number,
): GardenSpawnPoint[] {
  const plants = input.filter(
    (plant): plant is FrontierPlant =>
      Boolean(plant) &&
      typeof plant === "object" &&
      isValidCoordinate((plant as FrontierPlant).grid_x) &&
      isValidCoordinate((plant as FrontierPlant).grid_y),
  );
  if (plants.length === 0) return [{ gridX: 0, gridY: 0 }];

  const occupied = new Set(
    plants.map((plant) => plantKey(plant.grid_x, plant.grid_y)),
  );
  const chunks = new Map<string, Chunk>();
  for (const plant of plants) {
    const chunkX = Math.floor(plant.grid_x / CHUNK_SIZE);
    const chunkY = Math.floor(plant.grid_y / CHUNK_SIZE);
    const key = chunkKey(chunkX, chunkY);
    const chunk = chunks.get(key) ?? { chunkX, chunkY, plants: 0 };
    chunk.plants += 1;
    chunks.set(key, chunk);
  }
  const primaryChunkKeys = getPrimaryChunkKeys(chunks);

  const candidates = Array.from(chunks.values())
    .map((chunk) => {
      let neighborhoodPlants = 0;
      let openEdges = 0;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const nearby = chunks.get(
            chunkKey(chunk.chunkX + offsetX, chunk.chunkY + offsetY),
          );
          neighborhoodPlants += nearby?.plants ?? 0;
          if ((nearby?.plants ?? 0) < 4) openEdges += 1;
        }
      }
      const distanceFromCenter = Math.hypot(chunk.chunkX, chunk.chunkY);
      const densityTarget = 38;
      return {
        ...chunk,
        neighborhoodPlants,
        score:
          openEdges * 14 +
          Math.min(distanceFromCenter, 5) * 2 -
          Math.abs(chunk.plants - densityTarget) * 0.35 +
          stableCoordinateNoise(chunk.chunkX, chunk.chunkY, version),
      };
    })
    .filter(
      (chunk) =>
        primaryChunkKeys.has(chunkKey(chunk.chunkX, chunk.chunkY)) &&
        chunk.plants < MAX_CHUNK_PLANTS &&
        chunk.neighborhoodPlants >= MIN_NEIGHBORHOOD_PLANTS,
    )
    .sort((left, right) => right.score - left.score);

  const spawnPoints: GardenSpawnPoint[] = [];
  for (const chunk of candidates) {
    const point = chooseOpenCell(chunk, occupied, version);
    if (!point) continue;
    if (
      spawnPoints.some(
        (existing) =>
          Math.hypot(existing.gridX - point.gridX, existing.gridY - point.gridY) <
          SPAWN_SEPARATION,
      )
    ) {
      continue;
    }
    spawnPoints.push(point);
    if (spawnPoints.length >= SPAWN_COUNT) break;
  }

  if (spawnPoints.length > 0) return spawnPoints;
  const fallback = chooseOpenCell(
    chunks.get(chunkKey(0, 0)) ?? { chunkX: 0, chunkY: 0, plants: 0 },
    occupied,
    version,
  );
  return [fallback ?? { gridX: 0, gridY: 0 }];
}
