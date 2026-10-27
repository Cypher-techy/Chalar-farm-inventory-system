/**
 * Whether clearly-labelled demo data (including the *.demo staff accounts) may
 * be seeded. Explicit ENABLE_DEMO_SEED wins; otherwise demo data is allowed
 * everywhere except NODE_ENV=production.
 */
export function isDemoSeedEnabled(): boolean {
  if (process.env.ENABLE_DEMO_SEED === 'false') return false;
  if (process.env.ENABLE_DEMO_SEED === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}
