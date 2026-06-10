import { z } from "zod";
import { ROLE_NAMES } from "@/types/domain";
import { paginationSchema } from "@/validations/common";

export const userListSchema = paginationSchema
  .omit({ pageSize: true })
  .extend({
    pageSize: z.coerce.number().int().min(1).max(200).default(20),
    areaId: z.uuid().optional(),
    role: z.enum(ROLE_NAMES).optional(),
    isActive: z.coerce.boolean().optional(),
  });

export const createUserSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(8),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  roles: z.array(z.enum(ROLE_NAMES)).min(1).default(["USER"]),
  areaIds: z.array(z.uuid()).default([]),
});

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .partial()
  .extend({
    isActive: z.boolean().optional(),
    areaIds: z.array(z.uuid()).optional(),
    roles: z.array(z.enum(ROLE_NAMES)).min(1).optional(),
  });
