"use client";

import { type CSSProperties, useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  TrendUp,
  TrendDown,
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowClockwise,
  Info,
  Sparkle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { api } from "@/lib/api";
import { getDashboardTypographyVars } from "@/lib/typography";
import eventsData from "@/mocks/events.json";
import predictionsData from "@/mocks/predictions.json";

const categoryColors: Record<string, string> = {
  food: "#2E90FA",
  meal: "#2E90FA",
  entertainment: "#F79009",
  transport: "#10A861",
  coffee: "#875BF7",
  health: "#06AED4",
  other: "#737373",
};

type EventRow = {
  id: string;
  title: string;
  date: string;
  time: string;
  location?: string;
  predictedSpend: number;
  category: string;
  color: string;
  calendar: string;
};

type EventInput = {
  id: string;
  title: string;
  start: string;
  end?: string;
  predictedSpend?: number;
  category?: string;
  calendarType?: string;
};
function toEventRow(evt: EventInput): EventRow {
  const start = new Date(evt.start);
  return {
    id: evt.id,
    title: evt.title,
    date: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(start),
    time: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(start),
    predictedSpend: evt.predictedSpend ?? 0,
    category: evt.category || "other",
    color:
      categoryColors[evt.category as keyof typeof categoryColors] || "#737373",
    calendar: evt.calendarType || "other",
  };
}

const fallbackEvents = (eventsData as EventInput[]).map(toEventRow);
const fallbackPrediction = predictionsData.spendingPrediction;
const fallbackBreakdown = [
  {
    name: "Food",
    value: fallbackPrediction.breakdown.food,
    color: "#2E90FA",
  },
  {
    name: "Entertainment",
    value: fallbackPrediction.breakdown.entertainment,
    color: "#F79009",
  },
  {
    name: "Transport",
    value: fallbackPrediction.breakdown.transport,
    color: "#10A861",
  },
  {
    name: "Other",
    value: fallbackPrediction.breakdown.other,
    color: "#737373",
  },
];

export default function PredictionsPage() {
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [skippedEvents, setSkippedEvents] = useState<Set<string>>(new Set());
  const [weeklyEvents, setWeeklyEvents] =
    useState<EventRow[]>(fallbackEvents);
  const [spendingPrediction, setSpendingPrediction] =
    useState(fallbackPrediction);
  const [breakdownData, setBreakdownData] = useState(fallbackBreakdown);
  const [loading, setLoading] = useState(!!process.env.NEXT_PUBLIC_API_URL);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_API_URL) {
      setLoading(false);
      return;
    }
    api
      .getDashboard()
      .then((data) => {
        if (data.events?.length) {
          const rows = data.events.map((e: EventInput) =>
            toEventRow({
              id: e.id,
              title: e.title,
              start: e.start,
              end: e.end,
              predictedSpend: e.predictedSpend,
              category: e.category,
              calendarType: e.calendarType,
            })
          );
          setWeeklyEvents(rows);
        }
        const pred = data.forecast;
        if (pred?.next7DaysTotal != null) {
          const total = pred.next7DaysTotal;
          const breakdown = pred.byCategory ?? [];
          setSpendingPrediction({
            total: Math.round(total),
            confidence: 0.82,
            lastWeekActual: fallbackPrediction.lastWeekActual,
            breakdown: {
              food:
                breakdown.find((c: { key: string }) => c.key === "food")
                  ?.value ?? 0,
              entertainment:
                breakdown.find(
                  (c: { key: string }) => c.key === "entertainment"
                )?.value ?? 0,
              transport:
                breakdown.find(
                  (c: { key: string }) => c.key === "transport"
                )?.value ?? 0,
              other:
                breakdown.find((c: { key: string }) => c.key === "other")
                  ?.value ?? 37,
            },
          });
          setBreakdownData(
            breakdown.length
              ? breakdown.map((c: { name: string; value: number }) => ({
                  name: c.name,
                  value: c.value,
                  color:
                    categoryColors[c.name.toLowerCase()] ?? "#737373",
                }))
              : fallbackBreakdown
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { whatIfScenarios } = predictionsData;
  const currentTotal = weeklyEvents
    .filter((e) => !skippedEvents.has(e.id))
    .reduce((sum, e) => sum + e.predictedSpend, 0);
  const savings = spendingPrediction.total - currentTotal;

  const toggleSkip = (eventId: string) => {
    setSkippedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const applyScenario = (scenarioId: string) => {
    const scenario = whatIfScenarios.find((s) => s.id === scenarioId);
    if (!scenario) return;
    if (activeScenario === scenarioId) {
      setActiveScenario(null);
      setSkippedEvents((prev) => {
        const next = new Set(prev);
        next.delete(scenario.eventId);
        return next;
      });
    } else {
      setActiveScenario(scenarioId);
      setSkippedEvents((prev) => {
        const next = new Set(prev);
        next.add(scenario.eventId);
        return next;
      });
    }
  };

  const reset = () => {
    setSkippedEvents(new Set());
    setActiveScenario(null);
  };

  if (loading) {
    return (
      <PageShell>
        <div className="p-8 flex items-center justify-center min-h-[200px]">
          <p className="text-gray-500 text-sm font-medium">
            Loading&hellip;
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div
        className="p-6 lg:p-8 space-y-6 dashboard-typography"
        style={getDashboardTypographyVars() as CSSProperties}
      >
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-fade-up">
          {/* AI Prediction */}
          <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkle
                className="w-3.5 h-3.5 text-accent-purple"
                aria-hidden="true"
              />
              <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                AI Prediction
              </span>
            </div>
            <div className="text-2xl font-semibold text-white font-mono tabular-nums">
              ${spendingPrediction.total}
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Original weekly estimate
            </p>
            <div className="mt-4 flex items-center gap-2.5">
              <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-400 rounded-full progress-bar"
                  style={{
                    width: `${Math.round(
                      spendingPrediction.confidence * 100
                    )}%`,
                  }}
                />
              </div>
              <span className="text-xs text-gray-500 font-mono tabular-nums font-medium">
                {Math.round(spendingPrediction.confidence * 100)}%
              </span>
            </div>
          </div>

          {/* What-If Total */}
          <div
            className={`rounded-xl p-4 border ${
              savings > 0
                ? "bg-success-muted border-success/15"
                : "bg-surface-1 border-white/[0.06]"
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <ArrowClockwise
                className="w-3.5 h-3.5 text-gray-500"
                aria-hidden="true"
              />
              <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                What-If Total
              </span>
            </div>
            <div
              className={`text-2xl font-semibold font-mono tabular-nums ${
                savings > 0 ? "text-success" : "text-gray-100"
              }`}
            >
              ${currentTotal}
            </div>
            <p className="text-sm text-gray-400 mt-1">
              With your modifications
            </p>
            {savings > 0 && (
              <div className="mt-3 flex items-center gap-1.5">
                <TrendDown
                  className="w-3.5 h-3.5 text-success"
                  aria-hidden="true"
                />
                <span className="text-sm text-success font-medium font-mono">
                  Saving ${savings}
                </span>
              </div>
            )}
          </div>

          {/* Last Week Actual */}
          <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info
                className="w-3.5 h-3.5 text-gray-500"
                aria-hidden="true"
              />
              <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                Last Week
              </span>
            </div>
            <div className="text-2xl font-semibold text-gray-100 font-mono tabular-nums">
              ${spendingPrediction.lastWeekActual}
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Actual spending
            </p>
            <div className="mt-3 flex items-center gap-1.5">
              <TrendUp
                className="w-3.5 h-3.5 text-destructive"
                aria-hidden="true"
              />
              <span className="text-sm text-destructive font-medium font-mono">
                +$
                {spendingPrediction.total -
                  spendingPrediction.lastWeekActual}{" "}
                vs prediction
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div
          className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-up"
          style={{ animationDelay: "80ms" }}
        >
          {/* Event List */}
          <div className="lg:col-span-2 bg-surface-1 border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="text-base font-medium text-gray-200">
                Calendar Events This Week
              </h3>
              {skippedEvents.size > 0 && (
                <button
                  onClick={reset}
                  className="text-sm text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors focus-visible:ring-2 focus-visible:ring-gray-400 rounded font-medium"
                  type="button"
                >
                  <ArrowClockwise className="w-3 h-3" aria-hidden="true" />{" "}
                  Reset
                </button>
              )}
            </div>
            <div className="divide-y divide-white/[0.04]">
              {weeklyEvents.map((event) => {
                const isSkipped = skippedEvents.has(event.id);
                return (
                  <div
                    key={event.id}
                    className={`flex items-center gap-4 px-4 py-3 transition-colors ${
                      isSkipped ? "opacity-40" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <div
                      className="w-1 h-8 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          categoryColors[event.category] || "#737373",
                        opacity: 0.7,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm text-gray-200 font-medium truncate ${
                          isSkipped
                            ? "line-through text-gray-600"
                            : ""
                        }`}
                      >
                        {event.title}
                      </p>
                      <p
                        className="text-xs text-gray-600 mt-0.5 font-mono"
                        suppressHydrationWarning
                      >
                        {event.date} at {event.time}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span
                        className={`text-sm font-mono tabular-nums font-medium ${
                          isSkipped
                            ? "line-through text-gray-600"
                            : "text-gray-200"
                        }`}
                      >
                        {event.predictedSpend > 0
                          ? `$${event.predictedSpend}`
                          : "Free"}
                      </span>
                      <button
                        onClick={() => toggleSkip(event.id)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-gray-400 ${
                          isSkipped
                            ? "bg-success-muted text-success hover:bg-success/20"
                            : "bg-white/[0.04] text-gray-600 hover:bg-destructive-muted hover:text-destructive"
                        }`}
                        title={
                          isSkipped ? "Restore event" : "Skip event"
                        }
                        aria-label={
                          isSkipped
                            ? `Restore ${event.title}`
                            : `Skip ${event.title}`
                        }
                        type="button"
                      >
                        {isSkipped ? (
                          <CheckCircle
                            className="w-3.5 h-3.5"
                            aria-hidden="true"
                          />
                        ) : (
                          <XCircle
                            className="w-3.5 h-3.5"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Category Breakdown */}
            <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-4">
              <h3 className="text-base font-medium text-gray-200 mb-4">
                Category Breakdown
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={breakdownData}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    tick={{
                      fontSize: 10,
                      fill: "#5C5C5C",
                      fontWeight: 500,
                    }}
                    axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{
                      fontSize: 11,
                      fill: "#9E9E9E",
                      fontWeight: 500,
                    }}
                    width={80}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      fontWeight: 500,
                      background: "#1c1c20",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      color: "#e4e4e7",
                    }}
                    formatter={(v: unknown) => [`$${v}`, ""]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                    {breakdownData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.color}
                        fillOpacity={0.7}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* What-If Scenarios */}
            <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-4">
              <h3 className="text-base font-medium text-gray-200 mb-1">
                What-If Scenarios
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Apply a scenario to see your savings
              </p>
              <div className="space-y-2">
                {whatIfScenarios.map((scenario) => {
                  const isActive = activeScenario === scenario.id;
                  return (
                    <button
                      key={scenario.id}
                      onClick={() => applyScenario(scenario.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-gray-400 ${
                        isActive
                          ? "border-success/20 bg-success-muted"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
                      }`}
                      type="button"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-sm text-gray-200 ${
                            isActive ? "font-semibold" : "font-medium"
                          }`}
                        >
                          {scenario.label}
                        </span>
                        {isActive && (
                          <CheckCircle
                            className="w-3.5 h-3.5 text-success"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendDown
                          className="w-3 h-3 text-success"
                          aria-hidden="true"
                        />
                        <span className="text-sm text-success/80 font-mono font-medium">
                          Save ${scenario.savings} &rarr; $
                          {scenario.newTotal}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            {savings > 0 && (
              <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-4">
                <h3 className="text-base font-semibold text-white mb-1">
                  Ready to save
                </h3>
                <p className="text-sm text-gray-500 mb-3">
                  Turn your ${currentTotal} plan into a savings challenge
                  and earn rewards.
                </p>
                <Link
                  href="/challenges"
                  className="inline-flex items-center gap-2 bg-white/[0.08] border border-white/[0.1] text-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-white/[0.12] transition-colors focus-visible:ring-2 focus-visible:ring-gray-400"
                >
                  Create Challenge{" "}
                  <ArrowRight className="w-3 h-3" aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
