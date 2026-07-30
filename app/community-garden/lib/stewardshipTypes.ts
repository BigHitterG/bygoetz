export type GardenStewardshipRankKey =
  | "gardener"
  | "helper"
  | "caretaker"
  | "community_gardener"
  | "steward"
  | "elder_gardener";

export type GardenTaskCategory =
  | "cultivation"
  | "watering"
  | "neighbor_care"
  | "exploration"
  | "ecology"
  | "continuity";

export type GardenStewardshipTask = {
  id: string;
  slot: number;
  templateKey: string;
  category: GardenTaskCategory;
  title: string;
  description: string;
  progress: number;
  target: number;
};

export type GardenStewardshipNotification = {
  id: string;
  type: "task_complete" | "rank_up" | "project_complete";
  payload: {
    title?: string;
    description?: string;
    category?: GardenTaskCategory;
    rankKey?: GardenStewardshipRankKey;
    capacity?: number;
    projectKey?: string;
  };
  createdAt: string;
};

export type GardenStewardshipPoint = {
  gridX: number;
  gridY: number;
  plantId?: string;
  count?: number;
};

export type GardenStewardshipSummary = {
  rankKey: GardenStewardshipRankKey;
  capacity: number;
  tasksCompleted: number;
  activeDays: number;
  categoriesCompleted: number;
  communityProjectsCompleted: number;
  replacementAvailableAt: string | null;
  flowers: {
    living: number;
    coordinates: GardenStewardshipPoint[];
    recent: GardenStewardshipPoint | null;
    oldest: GardenStewardshipPoint | null;
    mainCluster: GardenStewardshipPoint | null;
  };
  tasks: GardenStewardshipTask[];
  recentAccolades: Array<{
    id: string;
    title: string;
    description: string;
    earnedAt: string;
  }>;
  notifications: GardenStewardshipNotification[];
  project: null | {
    id: string;
    title: string;
    description: string;
    globalProgress: number;
    globalTarget: number;
    personalProgress: number;
    personalTarget: number;
    completed: boolean;
    endsAt: string;
  };
};

export const GARDEN_STEWARDSHIP_RANKS: Array<{
  key: GardenStewardshipRankKey;
  name: string;
  capacity: number;
  tasks: number;
  categories: number;
  activeDays: number;
  projects: number;
}> = [
  { key: "gardener", name: "Gardener", capacity: 100, tasks: 0, categories: 0, activeDays: 0, projects: 0 },
  { key: "helper", name: "Helper", capacity: 125, tasks: 3, categories: 2, activeDays: 0, projects: 0 },
  { key: "caretaker", name: "Caretaker", capacity: 175, tasks: 10, categories: 4, activeDays: 3, projects: 0 },
  { key: "community_gardener", name: "Community Gardener", capacity: 250, tasks: 25, categories: 5, activeDays: 7, projects: 0 },
  { key: "steward", name: "Steward", capacity: 350, tasks: 60, categories: 6, activeDays: 21, projects: 0 },
  { key: "elder_gardener", name: "Elder Gardener", capacity: 500, tasks: 120, categories: 6, activeDays: 45, projects: 3 },
];

export function getGardenStewardshipRankName(rank: GardenStewardshipRankKey) {
  return GARDEN_STEWARDSHIP_RANKS.find((item) => item.key === rank)?.name ?? "Gardener";
}

export function getNextGardenStewardshipRank(rank: GardenStewardshipRankKey) {
  const index = GARDEN_STEWARDSHIP_RANKS.findIndex((item) => item.key === rank);
  return index >= 0 ? GARDEN_STEWARDSHIP_RANKS[index + 1] ?? null : GARDEN_STEWARDSHIP_RANKS[1];
}

