"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChartBar,
  CreditCard,
  Lock,
  LockOpen,
  Minus,
  Plus,
  ShieldCheck,
  Wallet,
} from "@phosphor-icons/react";
import {
  BarChart,
  Bar,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageShell } from "@/components/layout/PageShell";
import { api } from "@/lib/api";
import { CHART_TOOLTIP_STYLE } from "@/lib/constants";
import { getDashboardTypographyVars } from "@/lib/typography";

interface BankSummary {
  checking: number;
  vaults: Record<string, number>;
  total: number;
  recent_transactions: Array<{
    type: string;
    amount: number;
    vault?: string;
    reason?: string;
    checking_after?: number;
    vault_after?: number;
  }>;
}

type VaultMode = "add" | "remove" | null;

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-CA", { minimumFractionDigits: 2 })}`;
}

export default function BankingPage() {
  const [summary, setSummary] = useState<BankSummary | null>(null);
  const [vaultInput, setVaultInput] = useState("");
  const [vaultMode, setVaultMode] = useState<VaultMode>(null);
  const [showVaultConfirm, setShowVaultConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!process.env.NEXT_PUBLIC_API_URL);

  const fetchSummary = useCallback(() => {
    if (!process.env.NEXT_PUBLIC_API_URL) {
      setError("Start the backend and set NEXT_PUBLIC_API_URL.");
      setLoading(false);
      return;
    }

    api
      .bankSummary()
      .then((data) => {
        setSummary(data);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const vaultAmount = summary?.vaults.default ?? 0;
  const available = summary?.checking ?? 0;
  const totalBalance = summary?.total ?? 0;
  const vaultPercent = totalBalance > 0 ? Math.round((vaultAmount / totalBalance) * 100) : 0;
  const availPercent = totalBalance > 0 ? Math.max(0, 100 - vaultPercent) : 0;

  const chartData = useMemo(
    () => [
      { name: "Available", amount: available, color: "#2E90FA" },
      { name: "Locked", amount: vaultAmount, color: "#10A861" },
    ],
    [available, vaultAmount]
  );

  const recentTransactions = useMemo(
    () =>
      [...(summary?.recent_transactions ?? [])]
        .reverse()
        .map((transaction, index) => {
          const isUnlock = transaction.type === "unlock";
          return {
            id: `${transaction.type}-${index}`,
            label: isUnlock
              ? `Unlocked from ${transaction.vault ?? "vault"}`
              : `Locked into ${transaction.vault ?? "vault"}`,
            detail: transaction.reason ?? (isUnlock ? "withdrawal" : "savings"),
            amount: isUnlock ? transaction.amount : -transaction.amount,
            checkingAfter: transaction.checking_after ?? available,
          };
        }),
    [available, summary?.recent_transactions]
  );

  const handleVaultChange = (mode: Exclude<VaultMode, null>) => {
    if (!process.env.NEXT_PUBLIC_API_URL) {
      return;
    }

    const amount = Number(vaultInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const action = mode === "add" ? api.bankLock : api.bankUnlock;
    action(amount, "default", mode === "add" ? "savings" : "withdrawal")
      .then((result) => {
        if (result.ok === false) {
          setError(result.error ?? "Vault update failed.");
          return;
        }
        setShowVaultConfirm(true);
        setError(null);
        setTimeout(() => setShowVaultConfirm(false), 3000);
        fetchSummary();
      })
      .catch((err: Error) => {
        setError(err.message);
      });

    setVaultInput("");
    setVaultMode(null);
  };

  if (loading) {
    return (
      <PageShell>
        <div className="p-4 flex items-center justify-center min-h-[200px]">
          <p className="text-gray-500 text-sm font-medium">Loading bank summary...</p>
        </div>
      </PageShell>
    );
  }

  if (!summary) {
    return (
      <PageShell>
        <div className="p-6 flex items-center justify-center min-h-[240px]">
          <div className="text-center space-y-2">
            <p className="text-gray-300 text-sm font-medium">
              Banking data is unavailable.
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
        <div className="flex items-center justify-between animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-accent-blue/15 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-accent-blue" />
            </div>
            <div>
              <h2 className="text-gray-100 text-xl lg:text-2xl font-semibold tracking-tight">
                Banking
              </h2>
              <p className="text-sm text-gray-500 font-medium">
                Live vault summary from the backend ledger
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-accent-blue-muted border border-accent-blue/20 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 bg-accent-blue rounded-full animate-pulse" />
            <span className="text-sm text-accent-blue font-medium">
              Live sync
            </span>
          </div>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-up"
          style={{ animationDelay: "60ms" }}
        >
          <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <Wallet className="w-5 h-5 text-gray-500" />
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">
                Connected Account
              </p>
            </div>
            <div className="text-3xl font-semibold text-gray-100 font-mono tabular-nums">
              {formatCurrency(totalBalance)}
            </div>
            <p className="text-base text-gray-500 mt-1 font-medium">
              Total Balance
            </p>
            <div className="mt-4 flex items-center gap-2.5">
              <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-blue rounded-full progress-bar"
                  style={{ width: `${availPercent}%` }}
                />
              </div>
              <span className="text-sm text-gray-400 font-mono font-medium tabular-nums">
                {availPercent}% free
              </span>
            </div>
          </div>

          <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-success-muted rounded-md flex items-center justify-center">
                <LockOpen className="w-4 h-4 text-success" />
              </div>
              <span className="text-base text-gray-400 font-medium">
                Available
              </span>
            </div>
            <div className="text-3xl text-gray-100 font-semibold font-mono tabular-nums">
              {formatCurrency(available)}
            </div>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              Free to spend
            </p>
          </div>

          <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-success-muted rounded-md flex items-center justify-center">
                <Lock className="w-4 h-4 text-success" />
              </div>
              <span className="text-base text-gray-400 font-medium">
                Savings Vault
              </span>
            </div>
            <div className="text-3xl text-success font-semibold font-mono tabular-nums">
              {formatCurrency(vaultAmount)}
            </div>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              Locked for savings
            </p>
          </div>
        </div>

        <div
          className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-up"
          style={{ animationDelay: "120ms" }}
        >
          <div className="lg:col-span-2 bg-surface-1 border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="text-base text-gray-200 font-semibold">
                Recent Vault Activity
              </h3>
              <span className="text-sm text-gray-600 font-mono">
                {recentTransactions.length} recorded
              </span>
            </div>
            {recentTransactions.length > 0 ? (
              <div className="divide-y divide-white/[0.04]">
                {recentTransactions.map((transaction) => {
                  const isIncome = transaction.amount > 0;
                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                        style={{
                          backgroundColor: isIncome ? "#10A86118" : "#2E90FA18",
                        }}
                      >
                        {isIncome ? "↗" : "↘"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base text-gray-100 font-medium">
                          {transaction.label}
                        </p>
                        <p className="text-sm text-gray-600 mt-0.5 font-mono">
                          {transaction.detail} · checking {formatCurrency(transaction.checkingAfter)}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p
                            className={`text-base font-semibold font-mono tabular-nums ${
                              isIncome ? "text-success" : "text-gray-100"
                            }`}
                          >
                            {isIncome ? "+" : "-"}
                            {formatCurrency(Math.abs(transaction.amount)).replace("$", "$")}
                          </p>
                        </div>
                        {isIncome ? (
                          <ArrowDownLeft className="w-4 h-4 text-success flex-shrink-0" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-gray-300 font-medium">No vault transactions yet.</p>
                <p className="text-gray-600 text-sm mt-1">
                  Lock or unlock funds to create live activity here.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-5 h-5 text-success" />
                <h3 className="text-gray-100 font-semibold text-base">
                  Savings Vault
                </h3>
              </div>

              {showVaultConfirm && (
                <div className="mb-4 bg-success-muted border border-success/20 rounded-lg p-3 text-sm text-success font-medium flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Vault updated successfully!
                </div>
              )}

              {error && (
                <div className="mb-4 bg-destructive-muted border border-destructive/20 rounded-lg p-3 text-sm text-destructive font-medium">
                  {error}
                </div>
              )}

              <div className="relative flex justify-center mb-4">
                <div className="w-28 h-28 relative">
                  <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#10A861"
                      strokeWidth="3"
                      strokeDasharray={`${vaultPercent}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Lock className="w-4 h-4 text-success mb-0.5" />
                    <span className="text-base text-success font-semibold font-mono">
                      {vaultPercent}%
                    </span>
                    <span className="text-sm text-gray-600 font-medium">
                      locked
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-center mb-4">
                <p className="text-xl text-success font-semibold font-mono tabular-nums">
                  {formatCurrency(vaultAmount)}
                </p>
                <p className="text-sm text-gray-500 font-medium">
                  locked in vault
                </p>
              </div>

              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setVaultMode(vaultMode === "add" ? null : "add")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-base font-medium border transition-all ${
                    vaultMode === "add"
                      ? "bg-success text-white border-success"
                      : "bg-success-muted text-success border-success/20 hover:bg-success/20"
                  }`}
                >
                  <Plus className="w-4 h-4" /> Lock
                </button>
                <button
                  type="button"
                  onClick={() => setVaultMode(vaultMode === "remove" ? null : "remove")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-base font-medium border transition-all ${
                    vaultMode === "remove"
                      ? "bg-warning text-white border-warning"
                      : "bg-warning-muted text-warning border-warning/20 hover:bg-warning/20"
                  }`}
                >
                  <Minus className="w-4 h-4" /> Unlock
                </button>
              </div>

              {vaultMode && (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={vaultInput}
                    onChange={(e) => setVaultInput(e.target.value)}
                    placeholder="Amount"
                    className="flex-1 border border-white/[0.08] bg-surface-3 rounded-lg px-3 py-2.5 text-base text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleVaultChange(vaultMode)}
                    className="px-4 py-2.5 bg-accent-blue text-white rounded-lg text-base font-semibold hover:bg-accent-blue/80 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>

            <div className="bg-surface-1 border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <ChartBar className="w-5 h-5 text-accent-blue" />
                <h3 className="text-gray-100 font-semibold text-base">
                  Balance Split
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-4 font-medium">
                Current checking vs locked savings
              </p>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#71717a", fontWeight: 500 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#71717a" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value: number) => [formatCurrency(value), ""]}
                  />
                  <Bar dataKey="amount" radius={4}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2.5">
                {chartData.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between">
                    <span className="text-sm text-gray-400 font-medium">
                      {entry.name}
                    </span>
                    <span className="text-sm font-semibold font-mono tabular-nums text-gray-200">
                      {formatCurrency(entry.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
