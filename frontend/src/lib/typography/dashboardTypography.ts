export const DASHBOARD_FONT_WEIGHT_SCALE = 6.4;

export function scaledDashboardWeight(baseWeight: number): number {
  return Math.min(900, Math.round(baseWeight * DASHBOARD_FONT_WEIGHT_SCALE));
}

export function getDashboardTypographyVars(): Record<`--${string}`, number> {
  return {
    "--dashboard-weight-normal": scaledDashboardWeight(400),
    "--dashboard-weight-medium": scaledDashboardWeight(500),
    "--dashboard-weight-semibold": scaledDashboardWeight(600),
    "--dashboard-weight-bold": scaledDashboardWeight(700),
  };
}
