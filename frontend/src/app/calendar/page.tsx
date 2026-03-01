"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  parseISO,
  differenceInMinutes,
  isToday,
} from "date-fns";
import {
  CaretLeft,
  CaretRight,
  CurrencyDollar,
  Clock,
  X,
  CalendarDots,
} from "@phosphor-icons/react";
import { cva } from "class-variance-authority";
import { PageShell } from "@/components/layout/PageShell";
import { api } from "@/lib/api";
import { getStoredMonthlyBudget } from "@/lib/preferences";
import { cn } from "@/lib/utils";

/* ─── Types ─── */

type CalendarType = "work" | "personal" | "social" | "health";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  calendarType: CalendarType;
  predictedSpend: number;
  category: string;
}

/* ─── Constants ─── */

const HOUR_HEIGHT = 64; // px per hour slot
const VISIBLE_HOURS = { from: 0, to: 24 }; // full day
const HOURS = Array.from(
  { length: VISIBLE_HOURS.to - VISIBLE_HOURS.from },
  (_, i) => i + VISIBLE_HOURS.from
);

const CALENDAR_TYPES: { key: CalendarType; label: string }[] = [
  { key: "work", label: "Work" },
  { key: "personal", label: "Personal" },
  { key: "social", label: "Social" },
  { key: "health", label: "Health" },
];

const CALENDAR_COLORS: Record<
  CalendarType,
  { bg: string; border: string; text: string; dot: string }
> = {
  work: {
    bg: "bg-accent-blue/10",
    border: "border-accent-blue/25",
    text: "text-accent-blue",
    dot: "bg-accent-blue",
  },
  personal: {
    bg: "bg-gray-400/10",
    border: "border-gray-400/25",
    text: "text-gray-300",
    dot: "bg-gray-400",
  },
  social: {
    bg: "bg-accent-purple/10",
    border: "border-accent-purple/25",
    text: "text-accent-purple",
    dot: "bg-accent-purple",
  },
  health: {
    bg: "bg-success/10",
    border: "border-success/25",
    text: "text-success",
    dot: "bg-success",
  },
};

/* ─── Event badge variants (inspired by big-calendar) ─── */

const eventCardVariants = cva(
  "absolute rounded-md border px-2 py-1.5 text-xs cursor-pointer select-none transition-all hover:brightness-125 hover:shadow-lg overflow-hidden",
  {
    variants: {
      color: {
        work: "border-accent-blue/30 bg-accent-blue/15 text-accent-blue",
        personal: "border-gray-500/30 bg-gray-500/15 text-gray-300",
        social: "border-accent-purple/30 bg-accent-purple/15 text-accent-purple",
        health: "border-success/30 bg-success/15 text-success",
      },
    },
    defaultVariants: {
      color: "work",
    },
  }
);

/* ─── Helpers (adapted from big-calendar) ─── */

function groupEvents(dayEvents: CalendarEvent[]): CalendarEvent[][] {
  const sorted = [...dayEvents].sort(
    (a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime()
  );
  const groups: CalendarEvent[][] = [];

  for (const event of sorted) {
    const eventStart = parseISO(event.start);
    let placed = false;

    for (const group of groups) {
      const lastEvent = group[group.length - 1];
      const lastEnd = parseISO(lastEvent.end);
      if (eventStart >= lastEnd) {
        group.push(event);
        placed = true;
        break;
      }
    }

    if (!placed) groups.push([event]);
  }

  return groups;
}

function getEventPosition(
  event: CalendarEvent,
  groupIndex: number,
  groupCount: number
) {
  const start = parseISO(event.start);
  const end = parseISO(event.end);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const durationMinutes = differenceInMinutes(end, start);

  const visibleStartMinutes = VISIBLE_HOURS.from * 60;
  const top = ((startMinutes - visibleStartMinutes) / 60) * HOUR_HEIGHT;
  const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT - 2, 24);
  const width = groupCount > 1 ? 100 / groupCount : 100;
  const left = groupIndex * width;

  return { top, height, width, left };
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour > 12) return `${hour - 12} PM`;
  return `${hour} AM`;
}

/* ─── Current time indicator (only on today, inside grid so it scrolls correctly) ─── */

function CurrentTimeIndicator({
  minutesIntoHour,
}: {
  minutesIntoHour: number;
}) {
  const topPx = (minutesIntoHour / 60) * HOUR_HEIGHT;
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-10"
      style={{ top: `${topPx}px` }}
    >
      <div className="relative flex items-center">
        <div className="h-3 w-3 flex-shrink-0 rounded-full bg-red-500" />
        <div className="min-w-0 flex-1 border-t border-red-500" />
      </div>
    </div>
  );
}

/* ─── Main component ─── */

export default function CalendarPage() {
  const [rawEvents, setRawEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(!!process.env.NEXT_PUBLIC_API_URL);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [activeCalendars, setActiveCalendars] = useState<CalendarType[]>([
    "work",
    "personal",
    "social",
    "health",
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Fetch events from API if available
  useEffect(() => {
    let cancelled = false;

    api
      .getDashboard({ monthlyBudget: getStoredMonthlyBudget() })
      .then((data) => {
        if (cancelled) return;
        if (data.events?.length) {
          const events = data.events.map((event) => ({
            id: event.id,
            title: event.title,
            start: event.start,
            end: event.end,
            calendarType: event.calendarType,
            predictedSpend: event.predictedSpend ?? 0,
            category: event.category ?? "other",
          }));
          setRawEvents(events);
          setSelectedDate(parseISO(events[0].start));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-scroll to 7am on mount (full 24h grid starts at midnight)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
    }
  }, []);

  // Derived state
  const weekStart = useMemo(
    () => startOfWeek(selectedDate, { weekStartsOn: 1 }),
    [selectedDate]
  );
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const filteredEvents = useMemo(
    () => rawEvents.filter((e) => activeCalendars.includes(e.calendarType)),
    [rawEvents, activeCalendars]
  );

  const totalPredicted = useMemo(
    () => filteredEvents.reduce((sum, e) => sum + e.predictedSpend, 0),
    [filteredEvents]
  );

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    return `${format(weekStart, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
  }, [weekStart]);

  // Navigation
  const goToPreviousWeek = useCallback(
    () => setSelectedDate((d) => subWeeks(d, 1)),
    []
  );
  const goToNextWeek = useCallback(
    () => setSelectedDate((d) => addWeeks(d, 1)),
    []
  );
  const goToToday = useCallback(() => setSelectedDate(new Date()), []);

  const toggleCalendar = useCallback((type: CalendarType) => {
    setActiveCalendars((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  // Get events for a specific day
  const getDayEvents = useCallback(
    (day: Date) =>
      filteredEvents.filter((e) => isSameDay(parseISO(e.start), day)),
    [filteredEvents]
  );

  // Current time indicator: only show when today is in the visible week
  const todayIndex = weekDays.findIndex((d) => isToday(d));
  const currentHour = now.getHours();
  const minutesIntoHour = now.getMinutes();
  const showTimeIndicator =
    todayIndex >= 0 &&
    currentHour >= VISIBLE_HOURS.from &&
    currentHour < VISIBLE_HOURS.to;

  if (loading) {
    return (
      <PageShell>
        <div className="flex min-h-[400px] items-center justify-center p-6">
          <div className="flex items-center gap-3 text-gray-500">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span className="text-sm">Loading calendar...</span>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex h-full flex-col gap-4 p-5">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goToToday}
              className="rounded-lg border border-white/[0.09] bg-surface-1 px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              Today
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goToPreviousWeek}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.09] bg-surface-1 text-gray-500 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <CaretLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goToNextWeek}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.09] bg-surface-1 text-gray-500 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <CaretRight className="h-4 w-4" />
              </button>
            </div>

            <h2 className="text-base font-semibold text-white">
              {weekLabel}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-surface-1 px-3 py-1.5">
              <CurrencyDollar className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-xs text-gray-400">
                Week total:{" "}
                <span className="font-semibold tabular-nums text-white">
                  ${totalPredicted}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* ─── Calendar filters ─── */}
        <div className="flex items-center gap-2">
          {CALENDAR_TYPES.map(({ key, label }) => {
            const colors = CALENDAR_COLORS[key];
            const active = activeCalendars.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleCalendar(key)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                  active
                    ? `${colors.bg} ${colors.border} ${colors.text}`
                    : "border-white/[0.06] bg-transparent text-gray-600 hover:border-white/[0.09] hover:text-gray-500"
                )}
              >
                <div
                  className={cn(
                    "h-2 w-2 rounded-full transition-colors",
                    active ? colors.dot : "bg-[var(--text-muted)]"
                  )}
                />
                {label}
              </button>
            );
          })}
        </div>

        {/* ─── Calendar grid ─── */}
        <div className="flex min-h-0 flex-1 gap-4">
          {/* Week view */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-surface-1">
            {/* Single scroll container — header is sticky so columns always align */}
            <div
              ref={scrollRef}
              className="relative flex-1 overflow-y-auto"
              style={{ maxHeight: "calc(100vh - 280px)" }}
            >
              <table className="w-full border-collapse" style={{ minWidth: 700 }}>
                {/* Sticky day headers */}
                <thead>
                  <tr className="sticky top-0 z-20 bg-surface-1">
                    <th
                      className="w-14 min-w-[56px] border-b border-white/[0.06]"
                      aria-label="Time"
                    />
                    {weekDays.map((day, i) => {
                      const today = isToday(day);
                      return (
                        <th
                          key={day.toISOString()}
                          className={cn(
                            "border-b border-l border-white/[0.06] py-3 text-center font-normal",
                            i === 6 && "border-r-0"
                          )}
                        >
                          <span
                            className={cn(
                              "block text-xs font-medium",
                              today
                                ? "text-accent-blue"
                                : "text-gray-600"
                            )}
                          >
                            {format(day, "EEE")}
                          </span>
                          <span
                            className={cn(
                              "mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                              today
                                ? "bg-accent-blue text-white"
                                : "text-white"
                            )}
                          >
                            {format(day, "d")}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* Time grid body */}
                <tbody>
                  {HOURS.map((hour, hourIndex) => (
                    <tr key={hour}>
                      {/* Hour label */}
                      <td
                        className="relative w-14 min-w-[56px] select-none align-top"
                        style={{ height: `${HOUR_HEIGHT}px` }}
                      >
                        {hourIndex !== 0 && (
                          <span className="absolute -top-2.5 right-3 text-xs font-medium text-gray-600">
                            {formatHour(hour)}
                          </span>
                        )}
                      </td>

                      {/* Day cells */}
                      {weekDays.map((day, dayIndex) => {
                        // Only render events in the first hour row to avoid duplicates
                        const isFirstHour = hourIndex === 0;
                        const isCurrentTimeCell =
                          showTimeIndicator &&
                          hour === currentHour &&
                          dayIndex === todayIndex;

                        return (
                          <td
                            key={`${day.toISOString()}-${hour}`}
                            className="relative border-l border-white/[0.06] p-0"
                            style={{ height: `${HOUR_HEIGHT}px` }}
                          >
                            {/* Hour line */}
                            {hourIndex !== 0 && (
                              <div className="absolute inset-x-0 top-0 border-t border-white/[0.06]" />
                            )}
                            {/* Half-hour dashed line */}
                            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/[0.06] opacity-30" />

                            {/* Current time indicator — only in today's column, scrolls with grid */}
                            {isCurrentTimeCell && (
                              <CurrentTimeIndicator
                                minutesIntoHour={minutesIntoHour}
                              />
                            )}

                            {/* Render all events for this day-column in the first row */}
                            {isFirstHour && (() => {
                              const dayEvents = getDayEvents(day);
                              const groups = groupEvents(dayEvents);

                              return groups.map((group, groupIndex) =>
                                group.map((event) => {
                                  const pos = getEventPosition(
                                    event,
                                    groupIndex,
                                    groups.length
                                  );
                                  const hasOverlap = groups.length > 1;

                                  return (
                                    <div
                                      key={event.id}
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => setSelectedEvent(event)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          setSelectedEvent(event);
                                        }
                                      }}
                                      className={eventCardVariants({
                                        color: event.calendarType,
                                      })}
                                      style={{
                                        top: `${pos.top}px`,
                                        height: `${pos.height}px`,
                                        width: hasOverlap
                                          ? `calc(${pos.width}% - 4px)`
                                          : "calc(100% - 4px)",
                                        left: hasOverlap
                                          ? `calc(${pos.left}% + 2px)`
                                          : "2px",
                                        padding: "4px 8px",
                                        zIndex: 10,
                                      }}
                                    >
                                      <p className="truncate text-xs font-semibold leading-tight">
                                        {event.title}
                                      </p>
                                      {pos.height > 32 && (
                                        <p className="mt-0.5 text-xs opacity-70">
                                          {format(parseISO(event.start), "h:mm a")}
                                        </p>
                                      )}
                                      {pos.height > 50 &&
                                        event.predictedSpend > 0 && (
                                          <p className="mt-0.5 text-xs font-medium opacity-80">
                                            ~${event.predictedSpend}
                                          </p>
                                        )}
                                    </div>
                                  );
                                })
                              );
                            })()}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Sidebar ─── */}
          <div className="w-64 flex-shrink-0 space-y-4">
            {/* Event detail card */}
            {selectedEvent ? (
              <div className="rounded-xl border border-white/[0.06] bg-surface-1 p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
                      CALENDAR_COLORS[selectedEvent.calendarType].bg,
                      CALENDAR_COLORS[selectedEvent.calendarType].border,
                      CALENDAR_COLORS[selectedEvent.calendarType].text
                    )}
                  >
                    <div
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        CALENDAR_COLORS[selectedEvent.calendarType].dot
                      )}
                    />
                    {selectedEvent.calendarType}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedEvent(null)}
                    className="flex h-5 w-5 items-center justify-center rounded text-gray-600 transition-colors hover:bg-white/[0.06] hover:text-gray-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <h3 className="mb-3 text-sm font-semibold text-white">
                  {selectedEvent.title}
                </h3>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock className="h-3.5 w-3.5 text-gray-600" />
                    <span>
                      {format(parseISO(selectedEvent.start), "EEE, MMM d")} at{" "}
                      {format(parseISO(selectedEvent.start), "h:mm a")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <CalendarDots className="h-3.5 w-3.5 text-gray-600" />
                    <span>
                      {differenceInMinutes(
                        parseISO(selectedEvent.end),
                        parseISO(selectedEvent.start)
                      )}{" "}
                      minutes
                    </span>
                  </div>
                  {selectedEvent.predictedSpend > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <CurrencyDollar className="h-3.5 w-3.5 text-gray-600" />
                      <span className="font-medium text-white">
                        Predicted: ${selectedEvent.predictedSpend}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-surface-1 p-4">
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06]">
                    <CalendarDots className="h-5 w-5 text-gray-600" />
                  </div>
                  <p className="text-xs text-gray-500">
                    Click an event to view details
                  </p>
                </div>
              </div>
            )}

            {/* Week summary */}
            <div className="rounded-xl border border-white/[0.06] bg-surface-1 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-600">
                Week Summary
              </h3>

              <div className="space-y-2.5">
                {CALENDAR_TYPES.map(({ key, label }) => {
                  const typeEvents = filteredEvents.filter(
                    (e) => e.calendarType === key
                  );
                  const spend = typeEvents.reduce(
                    (s, e) => s + e.predictedSpend,
                    0
                  );
                  if (typeEvents.length === 0) return null;
                  const colors = CALENDAR_COLORS[key];

                  return (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn("h-2 w-2 rounded-full", colors.dot)}
                        />
                        <span className="text-xs text-gray-400">
                          {label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">
                          {typeEvents.length} event
                          {typeEvents.length !== 1 ? "s" : ""}
                        </span>
                        {spend > 0 && (
                          <span className="tabular-nums text-xs font-medium text-white">
                            ${spend}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="mt-3 border-t border-white/[0.06] pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">
                      Total predicted
                    </span>
                    <span className="tabular-nums text-sm font-semibold text-white">
                      ${totalPredicted}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
