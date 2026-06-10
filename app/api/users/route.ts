import { NextRequest } from "next/server";
import { created, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { handleRoute } from "@/lib/route-handler";
import { userService } from "@/services/user.service";
import { createUserSchema, userListSchema } from "@/validations/users";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const params = userListSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await userService.list(actor, params);
    return ok(result);
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const input = createUserSchema.parse(await request.json());
    const result = await userService.create(actor, input);
    return created(result, "User created");
  });
}
