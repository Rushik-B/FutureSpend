/**
 * Sankey data transformer — converts forecast/cashflow data into
 * the nodes + links format consumed by the CashflowSankey component.
 *
 * Designed to be pluggable: when a real backend is available, the API
 * can return the SankeyData shape directly and skip transformation.
 */

// ── Public types ──────────────────────────────────────────────

export interface SankeyNode {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export interface SankeyLink {
  source: number;
  target: number;
  value: number;
  color: string;
  percentage: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  currencySymbol: string;
}

// ── Category colors (matching Sure's palette) ─────────────────

const CATEGORY_COLORS: Record<string, string> = {
  food: "#F79009",
  transport: "#2E90FA",
  social: "#9E77ED",
  entertainment: "#EC2222",
  other: "#5C5C5C",
};

const ROOT_COLOR = "#2E90FA";

// ── Transformer ───────────────────────────────────────────────

interface CategoryEntry {
  name: string;
  value: number;
  key: string;
}

interface ForecastInput {
  next7DaysTotal: number;
  remainingBudget: number;
  monthlyBudget: number;
  byCategory: CategoryEntry[];
}

/**
 * Build Sankey nodes/links from our forecast shape.
 *
 * Layout:
 *   This Week ─→ [Category nodes]
 *
 * Mirrors the backend `/api/dashboard/sankey` shape so the UI stays stable
 * even when it has to build the graph client-side.
 */
export function buildSankeyFromForecast(
  forecast: ForecastInput,
  currencySymbol = "CA$"
): SankeyData {
  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  const totalSpend = Math.max(0, forecast.next7DaysTotal);

  nodes.push({
    name: "This Week",
    value: totalSpend,
    percentage: 100,
    color: ROOT_COLOR,
  });

  forecast.byCategory
    .filter((category) => category.value > 0)
    .forEach((category, index) => {
      const value = Math.max(0, category.value);
      const percentage = totalSpend > 0 ? Math.round((value / totalSpend) * 1000) / 10 : 0;
      const color = CATEGORY_COLORS[category.key] ?? CATEGORY_COLORS.other;

      nodes.push({
        name: category.name,
        value,
        percentage,
        color,
      });

      links.push({
        source: 0,
        target: index + 1,
        value,
        color,
        percentage,
      });
    });

  return { nodes, links, currencySymbol };
}

/**
 * Passthrough: if backend already returns SankeyData, validate and return it.
 */
export function parseSankeyResponse(raw: unknown): SankeyData | null {
  if (
    raw &&
    typeof raw === "object" &&
    "nodes" in raw &&
    "links" in raw &&
    Array.isArray((raw as SankeyData).nodes) &&
    Array.isArray((raw as SankeyData).links)
  ) {
    return raw as SankeyData;
  }
  return null;
}
