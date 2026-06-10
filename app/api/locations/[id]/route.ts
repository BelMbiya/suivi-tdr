import { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { handleRoute } from "@/lib/route-handler";
import { locationService } from "@/services/location.service";
import { idSchema } from "@/validations/common";

type Params = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const { id } = await params;
    const locationId = idSchema.parse(id);
    const result = await locationService.delete(actor, locationId);
    return ok(result, "Location deleted");
  });
}
