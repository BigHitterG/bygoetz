export const DEFAULT_DAILY_CARE_LIMIT = 600;
export const MIN_DAILY_CARE_LIMIT = 300;
export const MAX_DAILY_CARE_LIMIT = 2_000;

export type CommunityGardenEconomy = {
  dailyCareLimit: number;
  fullRewardLimit: number;
  moderateRewardLimit: number;
  moderateActionsRequired: number;
  longActionsRequired: number;
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
