import { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { handleRoute } from "@/lib/route-handler";
import { userService } from "@/services/user.service";
import { idSchema } from "@/validations/common";
import { updateUserSchema } from "@/validations/users";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const { id } = await params;
    const userId = idSchema.parse(id);
    const input = updateUserSchema.parse(await request.json());
    const result = await userService.update(actor, userId, input);
    return ok(result, "User updated");
  });
}
