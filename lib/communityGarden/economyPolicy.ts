export const CARE_ECONOMY_MODE = "uncapped" as const;

export type CommunityGardenEconomy = {
  mode: typeof CARE_ECONOMY_MODE;
  firstHelpfulActionCare: number;
  standardActionCare: number;
  dailyCareLimit: null;
  actorActionsPerMinute: number;
  dailyTechnicalActionLimit: number;
  updatedAt: string;
};

export type CommunityGardenEconomyAudit = {
  previousDailyCareLimit: number;
  newDailyCareLimit: number;
  changedAt: string;
};

export type CommunityGardenEconomyAdmin = CommunityGardenEconomy & {
  auditHistory: CommunityGardenEconomyAudit[];
};
