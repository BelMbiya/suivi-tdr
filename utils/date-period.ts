export const LOCATION_PERIODS = [
  "today",
  "yesterday",
  "last7days",
  "last30days",
  "custom",
  "all",
] as const;

export type LocationPeriod = (typeof LOCATION_PERIODS)[number];

export type DateRange = {
  from?: Date;
  to?: Date;
};

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = startOfDay(date);
  value.setDate(value.getDate() + 1);
  return value;
}

export function toDatetimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function defaultCustomRange() {
  const now = new Date();
  return {
    from: toDatetimeLocalValue(startOfDay(now)),
    to: toDatetimeLocalValue(endOfDay(now)),
  };
}

export function resolveLocationPeriodRange(
  period: LocationPeriod,
  customFrom?: string,
  customTo?: string,
): DateRange {
  const now = new Date();

  switch (period) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    }
    case "last7days": {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case "last30days": {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case "custom": {
      if (customFrom && customTo) {
        return { from: new Date(customFrom), to: new Date(customTo) };
      }
      return { from: startOfDay(now), to: endOfDay(now) };
    }
    case "all":
    default:
      return {};
  }
}

export function buildLocationSearchParams(params: {
  mode: "latest" | "all";
  pageSize?: number;
  page?: number;
  search?: string;
  areaId?: string;
  userId?: string;
  period: LocationPeriod;
  customFrom?: string;
  customTo?: string;
}) {
  const query = new URLSearchParams({
    mode: params.mode,
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 100),
    period: params.period,
  });

  if (params.search) {
    query.set("search", params.search);
  }

  if (params.areaId) {
    query.set("areaId", params.areaId);
  }

  if (params.userId) {
    query.set("userId", params.userId);
  }

  const range = resolveLocationPeriodRange(
    params.period,
    params.customFrom,
    params.customTo,
  );

  if (range.from) {
    query.set("from", range.from.toISOString());
  }

  if (range.to) {
    query.set("to", range.to.toISOString());
  }

  if (params.period === "custom") {
    if (params.customFrom) {
      query.set("customFrom", params.customFrom);
    }
    if (params.customTo) {
      query.set("customTo", params.customTo);
    }
  }

  return query;
}

export function isWithinDateRange(
  recordedAt: string | Date,
  range: DateRange,
) {
  if (!range.from && !range.to) {
    return true;
  }

  const timestamp = new Date(recordedAt).getTime();

  if (range.from && timestamp < range.from.getTime()) {
    return false;
  }

  if (range.to && timestamp >= range.to.getTime()) {
    return false;
  }

  return true;
}
