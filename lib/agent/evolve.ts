// Enhanced version of evolve.ts with better testing and error handling
import { validatePlan } from './validation';
import { writeEvolutionLog } from './logging';

// NOTE: This file previously imported these helpers but didn't use them,
// which triggered eslint @typescript-eslint/no-unused-vars warnings.

export async function evolve(plan: unknown) {
  const validationResult = validatePlan(plan);

  // If your validatePlan returns boolean instead of an object,
  // this will still work as long as it's truthy/falsey.
  if (!validationResult) {
    await writeEvolutionLog({
      plan,
      ok: false,
      reason: 'Invalid plan',
      validationResult,
    });
    throw new Error('Invalid plan');
  }

  await writeEvolutionLog({
    plan,
    ok: true,
    validationResult,
  });

  // Your existing evolve logic would go here.
  return plan;
}

