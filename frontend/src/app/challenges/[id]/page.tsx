"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Fire, Star, Trophy } from "@phosphor-icons/react";
import { PageShell } from "@/components/layout/PageShell";
import { BadgesGrid } from "@/components/challenges/BadgesGrid";
import { Leaderboard } from "@/components/challenges/Leaderboard";
import { api } from "@/lib/api";
import {
  formatChallengeValue,
  getActiveChallenge,
  getChallengeCurrentSpend,
  getChallengeReward,
} from "@/lib/dashboard";
import { formatDate } from "@/lib/format";
import { getStoredMonthlyBudget } from "@/lib/preferences";
import type { Challenge, DashboardPayload } from "@/lib/types";

export default function ChallengeDetailPage() {
  const params = useParams<{ id: string }>();
  const challengeId = Array.isArray(params.id) ? params.id[0] : params.id;
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

  const challenge = useMemo<Challenge | undefined>(() => {
    if (!dashboard) return undefined;
    return (
      dashboard.challenges.list.find((item) => item.id === challengeId) ??
      getActiveChallenge(dashboard)
    );
  }, [challengeId, dashboard]);

  const pct =
    challenge && challenge.goal > 0
      ? Math.min(100, (getChallengeCurrentSpend(challenge) / challenge.goal) * 100)
      : 0;

  if (loading) {
    return (
      <PageShell>
        <div className="p-6 flex items-center justify-center min-h-[200px]">
          <p className="text-gray-500 text-sm font-medium">Loading challenge...</p>
        </div>
      </PageShell>
    );
  }

  if (!dashboard || !challenge) {
    return (
      <PageShell>
        <div className="p-6 flex items-center justify-center min-h-[240px]">
          <div className="text-center space-y-2">
            <p className="text-gray-300 text-sm font-medium">
              Challenge details are unavailable.
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
      <div className="p-6 lg:p-8 space-y-6">
        <Link
          href="/challenges"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-200 transition-colors font-medium"
        >
          <ArrowLeft size={18} weight="bold" />
          Back to challenges
        </Link>

        <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-5 animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={20} weight="fill" className="text-warning-strong" />
            <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
              Challenge Details
            </span>
          </div>
          <h1 className="text-zinc-100 text-xl font-semibold tracking-tight mb-1">
            {challenge.name}
          </h1>
          {challenge.description && (
            <p className="text-sm text-zinc-400">{challenge.description}</p>
          )}
          <p className="mt-2 text-sm text-zinc-500">
            Goal: {formatChallengeValue(challenge.goal, challenge.unit)} · Ends{" "}
            {formatDate(challenge.endDate)}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 animate-fade-up" style={{ animationDelay: "60ms" }}>
          <div className="space-y-4">
            <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-4">
              <h3 className="mb-3 font-semibold text-zinc-100 text-sm">Your Progress</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-accent-blue progress-bar"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-sm text-gray-400 font-medium">
                      {formatChallengeValue(getChallengeCurrentSpend(challenge), challenge.unit)} /{" "}
                      {formatChallengeValue(challenge.goal, challenge.unit)}
                    </p>
                    <span className="text-sm text-white font-bold font-mono tabular-nums">
                      {Math.round(pct)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {challenge.streak != null && (
              <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-4">
                <h3 className="mb-2 font-semibold text-zinc-100 text-sm">Streak</h3>
                <div className="flex items-center gap-2">
                  <Fire size={20} weight="fill" className="text-warning" />
                  <p className="text-2xl font-semibold text-warning font-mono tabular-nums">
                    {challenge.streak} days
                  </p>
                </div>
              </div>
            )}

            <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-4">
              <h3 className="mb-2 font-semibold text-zinc-100 text-sm">Reward</h3>
              <div className="flex items-center gap-2">
                <Star size={20} weight="fill" className="text-warning-strong" />
                <p className="text-2xl font-semibold text-white font-mono tabular-nums">
                  {getChallengeReward(challenge)} pts
                </p>
              </div>
            </div>

            <Leaderboard
              entries={dashboard.challenges.leaderboard}
              valueLabel={challenge.unit === "CAD" ? "spent" : challenge.unit}
              valueFormat={(value) =>
                challenge.unit === "CAD"
                  ? `$${value}`
                  : `${Math.round(value)} ${challenge.unit}`
              }
            />
          </div>
          <div>
            <BadgesGrid badges={challenge.badges ?? dashboard.challenges.badges} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
