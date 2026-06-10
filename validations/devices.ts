import { z } from "zod";
import { paginationSchema } from "@/validations/common";

export const deviceListSchema = paginationSchema.extend({
  userId: z.uuid().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const createDeviceSchema = z.object({
  userId: z.uuid(),
  name: z.string().trim().min(1),
  platform: z.string().trim().min(1).default("WEB"),
  externalId: z.string().trim().optional(),
  isActive: z.boolean().default(true),
});

export const updateDeviceSchema = createDeviceSchema.partial();
