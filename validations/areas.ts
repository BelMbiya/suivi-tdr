import { z } from "zod";
import { paginationSchema } from "@/validations/common";

const coordinatePairSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

export const areaListSchema = paginationSchema.extend({
  isActive: z.coerce.boolean().optional(),
});

export const areaBoundarySchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(coordinatePairSchema).min(4)).min(1),
});

export const createAreaSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1).toUpperCase(),
  description: z.string().trim().optional(),
  boundary: areaBoundarySchema.optional(),
});

export const updateAreaSchema = createAreaSchema.partial().extend({
  isActive: z.boolean().optional(),
});
