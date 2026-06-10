import { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { handleRoute } from "@/lib/route-handler";
import { areaService } from "@/services/area.service";
import { idSchema } from "@/validations/common";
import { updateAreaSchema } from "@/validations/areas";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const { id } = await params;
    const areaId = idSchema.parse(id);
    const input = updateAreaSchema.parse(await request.json());
    const result = await areaService.update(actor, areaId, input);
    return ok(result, "Area updated");
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const { id } = await params;
    const areaId = idSchema.parse(id);
    const result = await areaService.delete(actor, areaId);
    return ok(result, "Area disabled");
  });
}
