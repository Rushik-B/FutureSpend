"use client";

import { type CSSProperties, useMemo, useState, useEffect } from "react";
import {
  Trophy,
  TrendUp,
  TrendDown,
  Crown,
  Medal,
  Star,
  Crosshair,
  CaretUp,
  CaretDown,
  Fire,
} from "@phosphor-icons/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { PageShell } from "@/components/layout/PageShell";
import { api } from "@/lib/api";
import { CHART_TOOLTIP_STYLE } from "@/lib/constants";
import {
  getActiveChallenge,
  getChallengeDaysRemaining,
  getChallengeReward,
  getChallengeTarget,
  getInitials,
  getLeaderboardEntryPoints,
} from "@/lib/dashboard";
import { getStoredMonthlyBudget } from "@/lib/preferences";
import { getDashboardTypographyVars } from "@/lib/typography";
import type { DashboardPayload } from "@/lib/types";

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<"current" | "alltime">("current");
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!process.env.NEXT_PUBLIC_API_URL);

  useEffect(() => {
    let cancelled = false;

    api
      .getDashboard({ monthlyBudget: getStoredMonthlyBudget() })
      .then((data) => {
        if (cancelled) return;
        setDashboard(data);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeChallenge = dashboard ? getActiveChallenge(dashboard) : undefined;
  const challengeTarget = activeChallenge ? getChallengeTarget(activeChallenge) : 0;
  const extendedLeaderboard = useMemo(
    () =>
      (dashboard?.challenges.leaderboard ?? []).map((entry, index) => ({
        rank: entry.rank,
        id: `u${index + 1}`,
        name: entry.name,
        avatar: entry.avatar ?? getInitials(entry.name),
        spent: entry.value,
        target: challengeTarget,
        status: (entry.value <= challengeTarget ? "under" : "over") as "under" | "over",
        avatarColor: entry.color ?? ["#10A861", "#2E90FA", "#875BF7", "#F79009", "#EC2222", "#06AED4"][index % 6],
        isCurrentUser: entry.isCurrentUser || entry.name === dashboard?.profile.name,
      })),
    [challengeTarget, dashboard]
  );

  const allTimeLeaderboard = dashboard?.allTimeLeaderboard ?? [];
  const barData = extendedLeaderboard.map((participant) => ({
    name: participant.name.split(" ")[0],
    spent: participant.spent,
    target: participant.target,
    color: participant.avatarColor,
    isCurrentUser: participant.isCurrentUser,
  }));

  const getRankIcon = (rank: number) => {
    if (rank === 1)
      return (
        <Crown className="w-5 h-5 text-warning-strong fill-warning-strong" />
      );
    if (rank === 2)
      return <Medal className="w-5 h-5 text-gray-400 fill-gray-400" />;
    if (rank === 3)
      return <Medal className="w-5 h-5 text-warning fill-warning" />;
    return (
      <span className="text-base text-gray-500 w-6 text-center font-semibold font-mono tabular-nums">
        {rank}
      </span>
    );
  };

  const currentEntry = extendedLeaderboard.find((entry) => entry.isCurrentUser);
  const leader = currentEntry
    ? extendedLeaderboard.find((entry) => entry.rank === currentEntry.rank - 1)
    : undefined;
  const trailing = currentEntry
    ? extendedLeaderboard.find((entry) => entry.rank === currentEntry.rank + 1)
    : undefined;
  const daysRemaining = activeChallenge ? getChallengeDaysRemaining(activeChallenge) : 0;
  const currentRemaining = Math.max(
    0,
    challengeTarget - (currentEntry?.spent ?? 0)
  );
  const leaderGap = leader && currentEntry
    ? Math.max(0, currentEntry.spent - leader.spent)
    : 0;
  const trailingGap = trailing && currentEntry
    ? Math.abs(trailing.spent - currentEntry.spent)
    : 0;

  if (loading) {
    return (
      <PageShell>
        <div className="p-6 flex items-center justify-center min-h-[240px]">
          <p className="text-gray-500 text-sm font-medium">Loading leaderboard...</p>
        </div>
      </PageShell>
    );
  }

  if (!dashboard || !activeChallenge) {
    return (
      <PageShell>
        <div className="p-6 flex items-center justify-center min-h-[240px]">
          <div className="text-center space-y-2">
            <p className="text-gray-300 text-sm font-medium">
              Leaderboard data is unavailable.
            </p>
            <p className="text-gray-600 text-sm">
              {error ?? "Start the backend and set NEXT_PUBLIC_API_URL."}
            </p>
          </div>
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
        {/* Hero Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-accent-blue/10 to-surface-1 border border-white/[0.06] rounded-xl p-8 lg:p-10 animate-fade-up">
          <div className="relative">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Trophy className="w-6 h-6 text-warning-strong fill-warning-strong" />
                  <span className="text-base lg:text-lg text-gray-400 font-medium">
                    Active Group Challenge
                  </span>
                </div>
                <h2 className="text-white text-3xl lg:text-4xl font-semibold tracking-tight mb-2">
                  {activeChallenge.name}
                </h2>
                <p className="text-base lg:text-lg text-gray-400">
                  Target: Stay under ${challengeTarget} this weekend
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl lg:text-4xl text-white font-semibold font-mono tabular-nums">
                  {daysRemaining}d
                </div>
                <p className="text-base text-gray-500">remaining</p>
              </div>
            </div>
            <div className="mt-7 flex items-center gap-4">
              <div className="flex -space-x-2">
                {extendedLeaderboard.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="w-10 h-10 rounded-full border-2 border-surface-1 flex items-center justify-center text-white text-sm font-semibold"
                    style={{ backgroundColor: p.avatarColor }}
                  >
                    {p.avatar}
                  </div>
                ))}
              </div>
              <span className="text-base text-gray-400">
                {activeChallenge.participants || extendedLeaderboard.length} participants
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <Star className="w-5 h-5 text-warning-strong fill-warning-strong" />
                <span className="text-base lg:text-lg text-warning-strong font-semibold font-mono tabular-nums">
                  {getChallengeReward(activeChallenge)} pts prize
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Toggle */}
        <div
          className="flex gap-1 bg-surface-2 p-1.5 rounded-xl w-fit animate-fade-up"
          style={{ animationDelay: "60ms" }}
        >
          {(["current", "alltime"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-base font-medium transition-all ${
                activeTab === tab
                  ? "bg-surface-4 text-gray-100 shadow-border-xs"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab === "current" ? "Current Challenge" : "All-Time Rankings"}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div
          className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-up"
          style={{ animationDelay: "120ms" }}
        >
          <div className="lg:col-span-2">
            {activeTab === "current" ? (
              <div className="bg-surface-1 border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-200">
                    Weekend Warrior Rankings
                  </h3>
                  <span className="text-base text-gray-500 bg-surface-3 px-3 py-1 rounded-md font-mono tabular-nums">
                    Live
                  </span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {extendedLeaderboard.map((participant) => {
                    const pct =
                      participant.target > 0
                        ? Math.round((participant.spent / participant.target) * 100)
                        : 0;
                    const isCurrentUser = participant.isCurrentUser;
                    const isOver = participant.status === "over";
                    return (
                      <div
                        key={participant.id}
                        className={`flex items-center gap-5 px-6 py-5 transition-colors ${
                          isCurrentUser
                            ? "bg-accent-blue-muted"
                            : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <div className="w-8 flex justify-center flex-shrink-0">
                          {getRankIcon(participant.rank)}
                        </div>
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                          style={{
                            backgroundColor: participant.avatarColor,
                          }}
                        >
                          {participant.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p
                              className={`text-base lg:text-lg text-gray-100 ${
                                isCurrentUser
                                  ? "font-bold"
                                  : "font-medium"
                              }`}
                            >
                              {participant.name}
                              {isCurrentUser && (
                                <span className="ml-1 text-accent-blue font-semibold">
                                  (You)
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="mt-2.5 h-2 bg-white/[0.06] rounded-full overflow-hidden w-40">
                            <div
                              className="h-full rounded-full progress-bar"
                              style={{
                                width: `${Math.min(pct, 100)}%`,
                                backgroundColor: isOver
                                  ? "#EC2222"
                                  : participant.avatarColor,
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg text-white font-semibold font-mono tabular-nums">
                            ${participant.spent}
                          </p>
                          <p className="text-base text-gray-500 font-mono tabular-nums">
                            of ${participant.target}
                          </p>
                        </div>
                        <div
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-base font-semibold ${
                            isOver
                              ? "bg-destructive-muted text-destructive border border-destructive/20"
                              : "bg-success-muted text-success border border-success/20"
                          }`}
                        >
                          {isOver ? (
                            <>
                              <TrendUp className="w-4 h-4" /> over
                            </>
                          ) : (
                            <>
                              <TrendDown className="w-4 h-4" /> under
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-surface-1 border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="px-6 py-5 border-b border-white/[0.06]">
                  <h3 className="text-lg font-medium text-gray-200">
                    All-Time Points Leaderboard
                  </h3>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {allTimeLeaderboard.map((participant) => (
                    <div
                      key={participant.rank}
                      className={`flex items-center gap-5 px-6 py-5 ${
                        participant.isCurrentUser
                          ? "bg-accent-blue-muted"
                          : "hover:bg-white/[0.02]"
                      } transition-colors`}
                    >
                      <div className="w-8 flex justify-center flex-shrink-0">
                        {getRankIcon(participant.rank)}
                      </div>
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                        style={{ backgroundColor: participant.color }}
                      >
                        {participant.avatar}
                      </div>
                      <div className="flex-1">
                        <p
                          className={`text-base lg:text-lg text-gray-100 ${
                            participant.isCurrentUser
                              ? "font-bold"
                              : "font-medium"
                          }`}
                        >
                          {participant.name}
                          {participant.isCurrentUser && (
                            <span className="ml-1 text-accent-blue font-semibold">
                              (You)
                            </span>
                          )}
                        </p>
                        <p className="text-base text-gray-500">
                          {participant.wins} challenge wins
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Star className="w-4.5 h-4.5 text-warning-strong fill-warning-strong" />
                        <span className="text-base text-gray-200 font-semibold font-mono tabular-nums">
                          {getLeaderboardEntryPoints(participant).toLocaleString()} pts
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Chart */}
            <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-lg font-medium text-gray-100 mb-5">
                Spending Comparison
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={barData}
                  margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#737373", fontWeight: 500 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#737373" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(v: number) => [`$${v}`, "Spent"]}
                  />
                  <ReferenceLine
                    y={challengeTarget}
                    stroke="#EC2222"
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                  />
                  <Bar dataKey="spent" radius={4}>
                    {barData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.isCurrentUser ? "#2E90FA" : entry.color}
                        opacity={entry.isCurrentUser ? 1 : 0.7}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 flex items-center gap-2 text-base text-gray-500">
                <span className="border-t-2 border-dashed border-destructive w-4" />{" "}
                Target: ${challengeTarget}
              </div>
            </div>

            {/* Your Position */}
            <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-lg font-medium text-gray-100 mb-4">
                Your Position
              </h3>
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-full bg-accent-blue flex items-center justify-center text-white text-lg font-semibold">
                  {getInitials(dashboard.profile.name)}
                </div>
                <div>
                  <p className="text-lg text-white font-bold">
                    {currentEntry
                      ? `Rank #${currentEntry.rank} of ${extendedLeaderboard.length}`
                      : "Not in the active challenge yet"}
                  </p>
                  <p className="text-base text-gray-500 font-mono tabular-nums">
                    {currentEntry
                      ? `$${currentEntry.spent} spent · $${currentRemaining} remaining`
                      : `Target: $${challengeTarget}`}
                  </p>
                </div>
              </div>
              <div className="space-y-3 text-base">
                {leader ? (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 font-medium">
                      vs {leader.name} (#{leader.rank})
                    </span>
                    <span className="text-destructive flex items-center gap-1.5 font-semibold font-mono tabular-nums text-base">
                      <CaretUp className="w-4 h-4" /> +${leaderGap} behind
                    </span>
                  </div>
                ) : (
                  <p className="text-gray-400 font-medium">
                    You&apos;re leading the current challenge.
                  </p>
                )}
                {trailing ? (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 font-medium">
                      vs {trailing.name} (#{trailing.rank})
                    </span>
                    <span className="text-success flex items-center gap-1.5 font-semibold font-mono tabular-nums text-base">
                      <CaretDown className="w-4 h-4" /> ${trailingGap} ahead
                    </span>
                  </div>
                ) : currentEntry ? (
                  <p className="text-gray-500 font-medium">
                    No trailing competitor yet.
                  </p>
                ) : null}
              </div>
            </div>

            {/* AI Tip */}
            <div className="bg-warning-muted border border-warning/15 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Fire className="w-5 h-5 text-warning" />
                <h3 className="text-lg font-medium text-warning">AI Tip</h3>
              </div>
              <p className="text-base text-gray-300 leading-relaxed">
                {dashboard.leaderboardTip}
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
