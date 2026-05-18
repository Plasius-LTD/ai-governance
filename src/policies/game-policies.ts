export interface GovernancePolicy { name: string; evaluate(ctx: any): any; }
export class OverdrivePolicy implements GovernancePolicy {
  name = "overdrive";
  evaluate(ctx: any) { return { allowed: true, modifications: {} }; }
}
export class RewardBoundPolicy implements GovernancePolicy {
  name = "reward-bound";
  constructor(private cap: number) {}
  evaluate(ctx: any) { return { allowed: true, modifications: { rewardCap: Math.min(ctx.requestedReward, this.cap) } }; }
}
export class HarderModePolicy implements GovernancePolicy {
  name = "harder-mode";
  evaluate(ctx: any) { return { allowed: true, modifications: { difficultyMultiplier: 1.2 } }; }
}
