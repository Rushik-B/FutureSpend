"use client";

import { useEffect, useState } from "react";
import { GearSix, User, Bell, ShieldCheck } from "@phosphor-icons/react";
import { PageShell } from "@/components/layout/PageShell";
import {
  DEFAULT_MONTHLY_BUDGET,
  getStoredMonthlyBudget,
  setStoredMonthlyBudget,
} from "@/lib/preferences";

export default function SettingsPage() {
  const [name, setName] = useState("Alex Demo");
  const [email, setEmail] = useState("alex@example.com");
  const [monthlyBudget, setMonthlyBudget] = useState(
    () => String(getStoredMonthlyBudget())
  );
  const [alertsBeforeEvents, setAlertsBeforeEvents] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMonthlyBudget(String(getStoredMonthlyBudget()));
  }, []);

  const handleSave = () => {
    const parsedBudget = Number(monthlyBudget);
    const normalizedBudget =
      Number.isFinite(parsedBudget) && parsedBudget > 0
        ? parsedBudget
        : DEFAULT_MONTHLY_BUDGET;
    setStoredMonthlyBudget(normalizedBudget);
    setMonthlyBudget(String(normalizedBudget));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <PageShell>
      <div className="p-4 md:p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8 animate-fade-up" style={{ animationDelay: "0ms" }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-white/[0.08] rounded-xl flex items-center justify-center">
              <GearSix size={22} weight="duotone" className="text-accent-blue" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100 font-[Inter]">
              Settings
            </h1>
          </div>
          <p className="text-zinc-500 text-sm ml-[52px]">
            Manage your profile, notifications, and privacy preferences
          </p>
        </div>

        <div className="max-w-xl space-y-6">
          {/* Profile Section */}
          <div
            className="bg-surface-1 border border-white/[0.06] rounded-xl p-5 animate-fade-up"
            style={{ animationDelay: "60ms" }}
          >
            <div className="flex items-center gap-2.5 mb-5">
              <User size={18} weight="duotone" className="text-accent-blue" />
              <h2 className="text-base font-semibold text-zinc-100 font-[Inter]">
                Profile
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-zinc-400 mb-1.5"
                >
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-surface-3 border border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-blue/40 transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-zinc-400 mb-1.5"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-3 border border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-blue/40 transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="budget"
                  className="block text-sm font-medium text-zinc-400 mb-1.5"
                >
                  Monthly budget (CAD)
                </label>
                <input
                  id="budget"
                  type="number"
                  min="1"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  className="w-full bg-surface-3 border border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-blue/40 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Notifications Section */}
          <div
            className="bg-surface-1 border border-white/[0.06] rounded-xl p-5 animate-fade-up"
            style={{ animationDelay: "120ms" }}
          >
            <div className="flex items-center gap-2.5 mb-5">
              <Bell size={18} weight="duotone" className="text-accent-blue" />
              <h2 className="text-base font-semibold text-zinc-100 font-[Inter]">
                Notifications
              </h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-400">
                    Alerts before high-spend events
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Get notified before events that may impact your budget
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={alertsBeforeEvents}
                  onClick={() => setAlertsBeforeEvents(!alertsBeforeEvents)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${
                    alertsBeforeEvents ? "bg-accent-blue" : "bg-surface-3"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      alertsBeforeEvents
                        ? "translate-x-[22px] mt-[2px]"
                        : "translate-x-[2px] mt-[2px]"
                    }`}
                  />
                </button>
              </div>

              <div className="border-t border-white/[0.06]" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-400">
                    Weekly summary email
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Receive a weekly digest of your spending and insights
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={weeklySummary}
                  onClick={() => setWeeklySummary(!weeklySummary)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${
                    weeklySummary ? "bg-accent-blue" : "bg-surface-3"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      weeklySummary
                        ? "translate-x-[22px] mt-[2px]"
                        : "translate-x-[2px] mt-[2px]"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Privacy Section */}
          <div
            className="bg-surface-1 border border-white/[0.06] rounded-xl p-5 animate-fade-up"
            style={{ animationDelay: "180ms" }}
          >
            <div className="flex items-center gap-2.5 mb-4">
              <ShieldCheck
                size={18}
                weight="duotone"
                className="text-accent-blue"
              />
              <h2 className="text-base font-semibold text-zinc-100 font-[Inter]">
                Privacy
              </h2>
            </div>

            <p className="text-sm text-zinc-500 leading-relaxed">
              Your calendar and transaction data are used only to generate your
              spending forecast and insights. We do not sell your data. You can
              disconnect calendars and delete uploaded data at any time from this
              page. For the demo, all data is stored locally and not sent to any
              server.
            </p>
          </div>

          {/* Save Button */}
          <div
            className="animate-fade-up"
            style={{ animationDelay: "240ms" }}
          >
            <button
              onClick={handleSave}
              className="bg-accent-blue text-white rounded-lg px-4 py-2.5 font-semibold text-sm hover:bg-accent-blue/80 transition-colors"
            >
              {saved ? "Saved!" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
