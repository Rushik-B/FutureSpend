"use client";

import { type CSSProperties, useEffect, useState } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendUp,
  Trophy,
  CalendarBlank,
  ArrowRight,
  Crosshair,
  HeartStraight,
  Star,
  Warning,
  ChatCircle,
} from "@phosphor-icons/react";
import { PageShell } from "@/components/layout/PageShell";
import { api } from "@/lib/api";
import { getDashboardTypographyVars } from "@/lib/typography";
import forecastData from "@/mocks/forecast.json";

const currentUser = {
  name: "Alex Demo",
  healthScore: 74,
  healthScoreTrend: 6,
  points: 2340,
};
const spendingHistoryData = [
  { week: "Jan W1", predicted: 320, actual: 298 },
  { week: "Jan W2", predicted: 410, actual: 445 },
  { week: "Jan W3", predicted: 380, actual: 362 },
  { week: "Jan W4", predicted: 290, actual: 278 },
  { week: "Feb W1", predicted: 350, actual: 341 },
  { week: "Feb W2", predicted: 420, actual: 389 },
  { week: "Mar W1", predicted: 412, actual: null },
];
const healthScoreHistory = [
  { date: "Oct", score: 52 },
  { date: "Nov", score: 58 },
  { date: "Dec", score: 61 },
  { date: "Jan", score: 67 },
  { date: "Feb", score: 68 },
  { date: "Mar", score: 74 },
];
const fallbackForecast = forecastData as {
  next7DaysTotal: number;
  remainingBudget: number;
  monthlyBudget: number;
  byCategory: Array<{ name: string; value: number; key: string }>;
};
const fallbackChallenges = [
  { id: "c1", name: "Weekend Warrior", current: 85, target: 274, reward: 650 },
  { id: "c2", name: "Dining Out Diet", current: 45, target: 180, reward: 400 },
];

const categoryColors: Record<string, string> = {
  Food: "#2E90FA",
  Transport: "#10A861",
  Social: "#F79009",
  Shopping: "#875BF7",
  Subscriptions: "#737373",
};

export default function DashboardPage() {
  const [forecast, setForecast] = useState(fallbackForecast);
  const [activeChallenges, setActiveChallenges] = useState(fallbackChallenges);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_API_URL) {
      setLoading(false);
      return;
    }
    api
      .getDashboard()
      .then((data) => {
        setForecast(data.forecast);
        const list = data.challenges?.list ?? [];
        if (list.length > 0) {
          setActiveChallenges(
            list
              .slice(0, 2)
              .map((c: { id: string; name: string; goal: number }) => ({
                id: c.id,
                name: c.name,
                current: Math.round(c.goal * 0.35),
                target: c.goal,
                reward: 650,
              }))
          );
        }
      })
      .catch(() => {
        setForecast(fallbackForecast);
        setActiveChallenges(fallbackChallenges);
      })
      .finally(() => setLoading(false));
  }, []);

  const score = currentUser.healthScore;

  const pieData = (forecast.byCategory ?? []).map((c) => ({
    name: c.name,
    value: c.value,
    color: categoryColors[c.name] ?? "#737373",
  }));

  const totalCategorySpend = pieData.reduce((s, c) => s + c.value, 0);

  if (loading) {
    return (
      <PageShell>
        <div className="p-8 flex items-center justify-center min-h-[200px]">
          <p className="text-gray-500 text-sm font-medium">Loading&hellip;</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div
        className="p-6 lg:p-8 space-y-7 dashboard-typography"
        style={getDashboardTypographyVars() as CSSProperties}
      >
        {/* Greeting */}
        <div className="flex items-center justify-between flex-wrap gap-4 animate-fade-up">
          <div>
            <h2
              className="text-white text-xl lg:text-3xl font-medium tracking-tight"
              style={{ textWrap: "balance" }}
            >
              Good morning, {currentUser.name.split(" ")[0]}
            </h2>
            <p className="text-sm lg:text-base text-gray-400 mt-1 font-medium">
              Your financial snapshot for this week.
            </p>
          </div>
          <Link
            href="/calendar"
            className="flex items-center gap-2 bg-white/[0.06] border border-white/[0.08] text-gray-200 px-4 py-2 rounded-lg hover:bg-white/[0.1] transition-colors text-sm font-medium focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            <TrendUp size={16} weight="bold" aria-hidden="true" />
            Predict This Week
          </Link>
        </div>

        {/* Top Stats */}
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-up"
          style={{ animationDelay: "60ms" }}
        >
          {/* Health Score */}
          <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <HeartStraight
                size={18}
                weight="fill"
                className="text-gray-500"
                aria-hidden="true"
              />
              <span className="flex items-center gap-1 text-sm text-success font-mono font-medium">
                <TrendUp size={14} weight="bold" aria-hidden="true" />+
                {currentUser.healthScoreTrend}
              </span>
            </div>
            <div className="text-3xl font-medium text-white font-mono tabular-nums">
              {score}
            </div>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              Health Score
            </p>
            <div className="mt-3 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full progress-bar"
                style={{
                  width: `${score}%`,
                  backgroundColor:
                    score >= 75
                      ? "#10A861"
                      : score >= 50
                      ? "#F79009"
                      : "#EC2222",
                }}
              />
            </div>
          </div>

          {/* Predicted This Week */}
          <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <TrendUp
                size={18}
                weight="bold"
                className="text-gray-500"
                aria-hidden="true"
              />
              <span className="text-sm text-destructive font-mono font-medium">
                +$26
              </span>
            </div>
            <div className="text-3xl font-medium text-white font-mono tabular-nums">
              ${forecast.next7DaysTotal}
            </div>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              Predicted This Week
            </p>
            <p className="text-sm text-gray-600 mt-1 font-mono font-medium">
              82% confidence
            </p>
          </div>

          {/* Points */}
          <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <Star
                size={18}
                weight="fill"
                className="text-gray-500"
                aria-hidden="true"
              />
              <span className="text-sm text-gray-500 font-medium">
                Silver Saver
              </span>
            </div>
            <div className="text-3xl font-medium text-white font-mono tabular-nums">
              {currentUser.points.toLocaleString()}
            </div>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              Total Points
            </p>
            <p className="text-sm text-gray-600 mt-1 font-mono font-medium">
              660 pts to Gold
            </p>
          </div>

          {/* Weekend Target */}
          <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <Trophy
                size={18}
                weight="fill"
                className="text-gray-500"
                aria-hidden="true"
              />
              <span className="text-sm text-gray-500 font-medium">
                2 active
              </span>
            </div>
            <div className="text-3xl font-medium text-white font-mono tabular-nums">
              $274
            </div>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              Weekend Target
            </p>
            <p className="text-sm text-gray-600 mt-1 font-mono font-medium">
              $85 spent of $274
            </p>
          </div>
        </div>

        {/* Charts Row */}
        <div
          className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-up"
          style={{ animationDelay: "120ms" }}
        >
          {/* Spending Chart */}
          <div className="lg:col-span-2 bg-surface-1 border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base text-gray-200 font-medium">
                Predicted vs Actual
              </h3>
              <span className="text-sm text-gray-600 font-mono font-medium">
                Last 9 weeks
              </span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart
                data={spendingHistoryData}
                margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="gPredicted"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#2E90FA"
                      stopOpacity={0.15}
                    />
                    <stop
                      offset="100%"
                      stopColor="#2E90FA"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient
                    id="gActual"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#10A861"
                      stopOpacity={0.15}
                    />
                    <stop
                      offset="100%"
                      stopColor="#10A861"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10, fill: "#5C5C5C", fontWeight: 500 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#5C5C5C" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#1c1c20",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    color: "#e4e4e7",
                  }}
                  formatter={(value: unknown, name: string) => [
                    value != null ? `$${value}` : "In progress",
                    name === "predicted" ? "Predicted" : "Actual",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="predicted"
                  stroke="#2E90FA"
                  strokeWidth={2}
                  fill="url(#gPredicted)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#10A861"
                  strokeWidth={2}
                  fill="url(#gActual)"
                  dot={false}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-[2px] rounded bg-accent-blue" />
                <span className="text-sm text-gray-500 font-medium">
                  Predicted
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-[2px] rounded bg-success" />
                <span className="text-sm text-gray-500 font-medium">
                  Actual
                </span>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base text-gray-200 font-medium">
                This Week
              </h3>
              <Link
                href="/calendar"
                className="text-sm text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors font-medium"
              >
                Details{" "}
                <ArrowRight size={14} weight="bold" aria-hidden="true" />
              </Link>
            </div>

            {/* Horizontal stacked bar */}
            <div className="h-2.5 rounded-full overflow-hidden flex mb-5">
              {pieData.map((item) => (
                <div
                  key={item.name}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${(item.value / totalCategorySpend) * 100}%`,
                    backgroundColor: item.color,
                    opacity: 0.75,
                  }}
                />
              ))}
            </div>

            <div className="space-y-3">
              {pieData.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor: item.color,
                        opacity: 0.75,
                      }}
                    />
                    <span className="text-sm text-gray-400 font-medium">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-sm font-mono text-gray-200 tabular-nums font-medium">
                    ${item.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-sm text-gray-500 font-medium">
                Total
              </span>
              <span className="text-lg font-mono font-medium text-gray-100 tabular-nums">
                ${totalCategorySpend}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-up"
          style={{ animationDelay: "180ms" }}
        >
          {/* Active Challenges */}
          <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base text-gray-200 font-medium">
                Active Challenges
              </h3>
              <Link
                href="/challenges"
                className="text-sm text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors font-medium"
              >
                View All{" "}
                <ArrowRight size={14} weight="bold" aria-hidden="true" />
              </Link>
            </div>
            <div className="space-y-5">
              {activeChallenges.map((challenge) => {
                const pct = Math.round(
                  (challenge.current / challenge.target) * 100
                );
                const isWarning = pct > 75;
                return (
                  <div key={challenge.id} className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Trophy
                          size={16}
                          weight="fill"
                          className="text-gray-500 flex-shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-sm text-gray-200 truncate font-medium">
                          {challenge.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isWarning && (
                          <Warning
                            size={14}
                            weight="fill"
                            className="text-warning"
                            aria-hidden="true"
                          />
                        )}
                        <span className="text-sm text-gray-500 font-mono tabular-nums font-medium">
                          ${challenge.current} / ${challenge.target}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full progress-bar"
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          backgroundColor: isWarning
                            ? "#F79009"
                            : "#10A861",
                          opacity: 0.85,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-medium">
                        {pct}% of budget used
                      </span>
                      <span className="text-sm text-gray-500 font-mono tabular-nums font-medium">
                        {challenge.reward} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Health Score Trend */}
          <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base text-gray-200 font-medium">
                Health Score Trend
              </h3>
              <span className="text-sm text-success/80 font-mono font-medium">
                +{currentUser.healthScoreTrend} this month
              </span>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart
                data={healthScoreHistory}
                margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="healthGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#10A861"
                      stopOpacity={0.15}
                    />
                    <stop
                      offset="100%"
                      stopColor="#10A861"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#5C5C5C", fontWeight: 500 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[40, 100]}
                  tick={{ fontSize: 10, fill: "#5C5C5C" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#1c1c20",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    color: "#e4e4e7",
                  }}
                  formatter={(v: number) => [`${v}/100`, "Health Score"]}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#10A861"
                  strokeWidth={2}
                  fill="url(#healthGrad)"
                  dot={{ fill: "#10A861", r: 3, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: "Spending Accuracy", value: "85%" },
                { label: "Challenge Win Rate", value: "75%" },
                { label: "Savings Rate", value: "68%" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-white/[0.03] border border-white/[0.04] rounded-lg p-2.5 text-center"
                >
                  <div className="text-lg font-mono font-medium text-white tabular-nums">
                    {item.value}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 leading-tight uppercase tracking-wide font-medium">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-2 animate-fade-up"
          style={{ animationDelay: "240ms" }}
        >
          {[
            { label: "Connect Calendar", icon: CalendarBlank, path: "/calendar" },
            { label: "New Prediction", icon: TrendUp, path: "/calendar" },
            { label: "Start Challenge", icon: Crosshair, path: "/challenges" },
            { label: "Ask AI", icon: ChatCircle, path: "/coach" },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.path}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] hover:border-white/[0.1] transition-colors"
            >
              <action.icon
                size={16}
                weight="bold"
                aria-hidden="true"
              />
              <span className="text-sm font-medium">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
