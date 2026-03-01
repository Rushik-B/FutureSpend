"use client";

import { Medal } from "@phosphor-icons/react";

interface LeaderboardEntry {
  rank: number;
  name: string;
  value: number;
  isCurrentUser?: boolean;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  valueLabel?: string;
  valueFormat?: (v: number) => string;
}

export function Leaderboard({
  entries,
  valueLabel = "Saved",
  valueFormat = (v) => `$${v}`,
}: LeaderboardProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-100">Leaderboard</h3>
      <div className="bg-surface-1 border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="divide-y divide-white/[0.04]">
          {entries.map((entry) => {
            const isCurrentUser = entry.isCurrentUser || entry.name === "You";
            return (
              <div
                key={entry.rank}
                className={`flex items-center justify-between px-4 py-3 transition-colors ${
                  isCurrentUser
                    ? "bg-accent-blue-muted"
                    : "hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center gap-3">
                  {entry.rank <= 3 ? (
                    <Medal
                      size={18}
                      weight="fill"
                      style={{
                        color:
                          entry.rank === 1
                            ? "#F79009"
                            : entry.rank === 2
                              ? "#737373"
                              : "#cd7f32",
                      }}
                    />
                  ) : (
                    <span className="w-4 text-center text-xs text-gray-500 font-bold font-mono">
                      {entry.rank}
                    </span>
                  )}
                  <span
                    className={`text-sm ${
                      isCurrentUser
                        ? "font-semibold text-accent-blue"
                        : "font-medium text-zinc-200"
                    }`}
                  >
                    {entry.name}
                  </span>
                </div>
                <span className="text-sm font-medium text-zinc-400 font-mono tabular-nums">
                  {valueFormat(entry.value)} {valueLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
