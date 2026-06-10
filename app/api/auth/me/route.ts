import { ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { handleRoute } from "@/lib/route-handler";
import { userRepository } from "@/repositories/user.repository";

export async function GET() {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const profile = await userRepository.findById(actor.id);

    return ok({
      ...actor,
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
    });
  });
}
