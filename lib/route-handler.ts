import { ZodError } from "zod";
import { fail } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

export async function handleRoute<T>(handler: () => Promise<T>) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.errors, error.status);
    }

    if (error instanceof ZodError) {
      return fail(
        "Validation failed",
        error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
        422,
      );
    }

    console.error(error);
    return fail("Internal server error", [], 500);
  }
}
