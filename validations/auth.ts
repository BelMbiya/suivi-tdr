import { z } from "zod";

export const loginSchema = z.object({
  organizationSlug: z.string().trim().min(1).default("default"),
  email: z.email().toLowerCase(),
  password: z.string().min(8),
});

export const refreshSchema = z.object({
  refreshToken: z.string().trim().optional(),
});

export const logoutSchema = z.object({
  refreshToken: z.string().trim().optional(),
});
