"use client";

import { Trophy, Fire, UsersThree, Crosshair, SunHorizon, Lock } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ComponentType<Record<string, unknown>>> = {
  Trophy,
  Flame: Fire,
  Users: UsersThree,
  Target: Crosshair,
  Sunrise: SunHorizon,
};

interface Badge {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  icon: string;
}

interface BadgesGridProps {
  badges: Badge[];
}

export function BadgesGrid({ badges }: BadgesGridProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-100">Badges</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {badges.map((badge) => {
          const Icon = ICON_MAP[badge.icon] || Trophy;
          return (
            <div
              key={badge.id}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors",
                badge.earned
                  ? "border-warning/20 bg-warning-muted"
                  : "border-white/[0.06] bg-surface-1 opacity-60"
              )}
            >
              <div
                className={cn(
                  "rounded-full p-2",
                  badge.earned ? "bg-warning/20" : "bg-white/[0.06]"
                )}
              >
                {badge.earned ? (
                  <Icon className="text-warning-strong" size={26} weight="fill" />
                ) : (
                  <Lock size={26} weight="fill" className="text-gray-600" />
                )}
              </div>
              <p className="text-xs font-medium text-zinc-200">{badge.name}</p>
              <p className="text-xs text-zinc-500">{badge.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
