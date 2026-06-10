"use client";

import { Input } from "@/components/ui/input";
import type { LocationPeriod } from "@/utils/date-period";

const periodLabels: Record<LocationPeriod, string> = {
  today: "Aujourd'hui",
  yesterday: "Hier",
  last7days: "7 derniers jours",
  last30days: "30 derniers jours",
  custom: "Période personnalisée",
  all: "Toutes les dates",
};

type DatePeriodFilterProps = {
  period: LocationPeriod;
  customFrom: string;
  customTo: string;
  compact?: boolean;
  onPeriodChange: (period: LocationPeriod) => void;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
};

export function DatePeriodFilter({
  period,
  customFrom,
  customTo,
  compact = false,
  onPeriodChange,
  onCustomFromChange,
  onCustomToChange,
}: DatePeriodFilterProps) {
  return (
    <div className={`grid gap-3 ${compact ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
      <label className="space-y-1 text-xs font-medium text-zinc-700">
        Période
        <select
          className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
          value={period}
          onChange={(event) => onPeriodChange(event.target.value as LocationPeriod)}
        >
          {Object.entries(periodLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {period === "custom" ? (
        <>
          <label className="space-y-1 text-xs font-medium text-zinc-700">
            Du
            <Input
              type="datetime-local"
              value={customFrom}
              onChange={(event) => onCustomFromChange(event.target.value)}
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-zinc-700">
            Au
            <Input
              type="datetime-local"
              value={customTo}
              onChange={(event) => onCustomToChange(event.target.value)}
            />
          </label>
        </>
      ) : null}
    </div>
  );
}
