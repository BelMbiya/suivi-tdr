import { requireAreaAccess, requireRole } from "@/lib/auth/permissions";
import { logRepository } from "@/repositories/log.repository";
import type { CurrentUser } from "@/types/domain";

export const logService = {
  async auditLogs(
    actor: CurrentUser,
    params: {
      page: number;
      pageSize: number;
      search?: string;
      actorId?: string;
      entityType?: string;
    },
  ) {
    requireRole(actor, "ADMIN");
    const [total, items] = await logRepository.auditLogs({
      ...params,
      organizationId: actor.organizationId,
    });
    return { items, total, page: params.page, pageSize: params.pageSize };
  },

  async geofenceEvents(
    actor: CurrentUser,
    params: {
      page: number;
      pageSize: number;
      search?: string;
      userId?: string;
      geofenceId?: string;
      areaId?: string;
    },
  ) {
    requireRole(actor, "MANAGER");

    if (params.areaId) {
      requireAreaAccess(actor, params.areaId);
    }

    const [total, items] = await logRepository.geofenceEvents({
      ...params,
      organizationId: actor.organizationId,
    });
    return { items, total, page: params.page, pageSize: params.pageSize };
  },
};
