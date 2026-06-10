import { z } from "zod";
import { LOCATION_SOURCES } from "@/types/domain";
import { LOCATION_PERIODS } from "@/utils/date-period";
import { dateRangeSchema, paginationSchema } from "@/validations/common";

export const createLocationSchema = z.object({
  userId: z.uuid(),
  areaId: z.uuid().optional(),
  deviceId: z.uuid().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
  speed: z.number().optional(),
  altitude: z.number().optional(),
  heading: z.number().min(0).max(360).optional(),
  batteryLevel: z.number().int().min(0).max(100).optional(),
  source: z.enum(LOCATION_SOURCES).default("WEB"),
  clientId: z.string().trim().optional(),
  recordedAt: z.coerce.date().default(() => new Date()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const locationHistorySchema = paginationSchema
  .merge(dateRangeSchema)
  .extend({
    userId: z.uuid(),
    areaId: z.uuid().optional(),
  });

export const locationListSchema = paginationSchema.extend({
  pageSize: z.coerce.number().int().min(1).max(2000).default(100),
  areaId: z.uuid().optional(),
  userId: z.uuid().optional(),
  today: z.coerce.boolean().default(false),
  period: z.enum(LOCATION_PERIODS).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  mode: z.enum(["latest", "all"]).default("latest"),
});
