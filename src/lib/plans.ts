export type SubscriptionPlan = 'essential' | 'full';

export function normalizePlan(value: unknown): SubscriptionPlan {
  return value === 'essential' ? 'essential' : 'full';
}

export function isEssentialPlan(plan: SubscriptionPlan): boolean {
  return plan === 'essential';
}
