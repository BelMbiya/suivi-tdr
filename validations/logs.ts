import { z } from "zod";
import { paginationSchema } from "@/validations/common";

export const auditLogListSchema = paginationSchema.extend({
  actorId: z.uuid().optional(),
  entityType: z.string().trim().optional(),
});

export const geofenceEventListSchema = paginationSchema.extend({
  userId: z.uuid().optional(),
  geofenceId: z.uuid().optional(),
  areaId: z.uuid().optional(),
});
