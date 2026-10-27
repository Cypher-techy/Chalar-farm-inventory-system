export interface PayeBand {
  upToKes: number | null; // null = infinity
  ratePercent: number;
}

export interface StatutoryRuleConfig {
  versionCode: string;
  personalReliefKes: number;
  shifRatePercent: number;
  ahlEmployeeRatePercent: number;
  ahlEmployerRatePercent: number;
  nssfTier1LimitKes: number;
  nssfTier2LimitKes: number;
  nssfRatePercent: number;
  payeBands: PayeBand[];
}

export const DEFAULT_KENYA_2026_STATUTORY_RULES: StatutoryRuleConfig = {
  versionCode: 'KE-STAT-2026-V1',
  personalReliefKes: 2400,
  shifRatePercent: 2.75,
  ahlEmployeeRatePercent: 1.5,
  ahlEmployerRatePercent: 1.5,
  nssfTier1LimitKes: 8000,
  nssfTier2LimitKes: 72000,
  nssfRatePercent: 6.0,
  payeBands: [
    { upToKes: 24000, ratePercent: 10 },
    { upToKes: 32333, ratePercent: 25 },
    { upToKes: 500000, ratePercent: 30 },
    { upToKes: 800000, ratePercent: 32.5 },
    { upToKes: null, ratePercent: 35 },
  ],
};

export interface PayrollCalculationInput {
  basicPayKes: number;
  overtimePayKes: number;
  allowancesKes: number;
  otherDeductionsKes?: number;
  rules?: StatutoryRuleConfig;
}

export interface PayrollCalculationResult {
  basicPayKes: number;
  overtimePayKes: number;
  allowancesKes: number;
  grossPayKes: number;
  nssfEmployeeKes: number;
  nssfEmployerKes: number;
  shifKes: number;
  housingLevyEmployeeKes: number;
  housingLevyEmployerKes: number;
  taxablePayKes: number;
  payeBeforeReliefKes: number;
  personalReliefKes: number;
  payeTaxKes: number;
  otherDeductionsKes: number;
  totalDeductionsKes: number;
  netPayKes: number;
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function calculateKenyanPayroll(
  input: PayrollCalculationInput
): PayrollCalculationResult {
  const rules = input.rules ?? DEFAULT_KENYA_2026_STATUTORY_RULES;
  const basicPayKes = round2(Math.max(0, input.basicPayKes));
  const overtimePayKes = round2(Math.max(0, input.overtimePayKes));
  const allowancesKes = round2(Math.max(0, input.allowancesKes));
  const otherDeductionsKes = round2(Math.max(0, input.otherDeductionsKes ?? 0));

  const grossPayKes = round2(basicPayKes + overtimePayKes + allowancesKes);

  // 1. NSSF (Tier I + Tier II capped at nssfTier2LimitKes)
  const pensionablePay = Math.min(grossPayKes, rules.nssfTier2LimitKes);
  const nssfEmployeeKes = round2(pensionablePay * (rules.nssfRatePercent / 100));
  const nssfEmployerKes = nssfEmployeeKes;

  // 2. SHIF (2.75% of Gross Pay, minimum KES 300 if gross > 0)
  const rawShif = grossPayKes * (rules.shifRatePercent / 100);
  const shifKes = grossPayKes > 0 ? round2(Math.max(300, rawShif)) : 0;

  // 3. Affordable Housing Levy (1.5% Employee + 1.5% Employer)
  const housingLevyEmployeeKes = round2(
    grossPayKes * (rules.ahlEmployeeRatePercent / 100)
  );
  const housingLevyEmployerKes = round2(
    grossPayKes * (rules.ahlEmployerRatePercent / 100)
  );

  // 4. Taxable Pay (Gross minus allowable statutory deductions: NSSF, SHIF, AHL)
  const taxablePayKes = round2(
    Math.max(0, grossPayKes - nssfEmployeeKes - shifKes - housingLevyEmployeeKes)
  );

  // 5. Graduated PAYE calculation
  let remainingTaxable = taxablePayKes;
  let previousUpperLimit = 0;
  let payeBeforeRelief = 0;

  for (const band of rules.payeBands) {
    if (remainingTaxable <= 0) break;
    if (band.upToKes === null) {
      payeBeforeRelief += remainingTaxable * (band.ratePercent / 100);
      remainingTaxable = 0;
    } else {
      const bandWidth = Math.max(0, band.upToKes - previousUpperLimit);
      const taxableInBand = Math.min(remainingTaxable, bandWidth);
      payeBeforeRelief += taxableInBand * (band.ratePercent / 100);
      remainingTaxable -= taxableInBand;
      previousUpperLimit = band.upToKes;
    }
  }

  const payeBeforeReliefKes = round2(payeBeforeRelief);
  const personalReliefKes = taxablePayKes > 0 ? round2(rules.personalReliefKes) : 0;
  const payeTaxKes =
    taxablePayKes <= 24000
      ? 0
      : round2(Math.max(0, payeBeforeReliefKes - personalReliefKes));

  const totalDeductionsKes = round2(
    nssfEmployeeKes + shifKes + housingLevyEmployeeKes + payeTaxKes + otherDeductionsKes
  );
  const netPayKes = round2(Math.max(0, grossPayKes - totalDeductionsKes));

  return {
    basicPayKes,
    overtimePayKes,
    allowancesKes,
    grossPayKes,
    nssfEmployeeKes,
    nssfEmployerKes,
    shifKes,
    housingLevyEmployeeKes,
    housingLevyEmployerKes,
    taxablePayKes,
    payeBeforeReliefKes,
    personalReliefKes,
    payeTaxKes,
    otherDeductionsKes,
    totalDeductionsKes,
    netPayKes,
  };
}
