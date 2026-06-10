import { z } from "zod";
import { GEOFENCE_TYPES } from "@/types/domain";
import { paginationSchema } from "@/validations/common";

const coordinatePairSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

export const geofenceListSchema = paginationSchema.extend({
  areaId: z.uuid().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const geofencePolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(coordinatePairSchema).min(4)).min(1),
});

const geofenceBaseSchema = z.object({
  areaId: z.uuid().optional(),
  name: z.string().trim().min(1),
  type: z.enum(GEOFENCE_TYPES),
  centerLat: z.number().min(-90).max(90).optional(),
  centerLng: z.number().min(-180).max(180).optional(),
  radiusMeters: z.number().positive().optional(),
  polygon: geofencePolygonSchema.optional(),
});

function validateGeofenceShape(
  value: z.infer<typeof geofenceBaseSchema> | Partial<z.infer<typeof geofenceBaseSchema>>,
  context: z.RefinementCtx,
) {
    if (
      value.type === "CIRCLE" &&
      (value.centerLat == null ||
        value.centerLng == null ||
        value.radiusMeters == null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Circle geofence requires centerLat, centerLng and radiusMeters",
      });
    }

    if (value.type === "POLYGON" && !value.polygon) {
      context.addIssue({
        code: "custom",
        message: "Polygon geofence requires polygon geometry",
      });
    }
}

export const createGeofenceSchema =
  geofenceBaseSchema.superRefine(validateGeofenceShape);

export const updateGeofenceSchema = geofenceBaseSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  })
  .superRefine(validateGeofenceShape);
