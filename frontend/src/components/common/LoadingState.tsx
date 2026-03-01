import { SpinnerGap } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = "Loading...", className }: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 py-12",
        className
      )}
    >
      <SpinnerGap size={32} weight="bold" className="animate-spin text-primary-500" />
      <p className="text-sm text-slate-600">{message}</p>
    </div>
  );
}
