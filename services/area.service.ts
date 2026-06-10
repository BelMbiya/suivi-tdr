import { AuditAction } from "@/generated/prisma/client";
import { requireRole } from "@/lib/auth/permissions";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { areaRepository } from "@/repositories/area.repository";
import { auditRepository } from "@/repositories/audit.repository";
import type { CurrentUser } from "@/types/domain";

type AreaBoundary = {
  type: "Polygon";
  coordinates: [number, number][][];
};

async function syncAreaGeometry(areaId: string, boundary?: AreaBoundary | null) {
  if (!boundary) {
    await prisma.$executeRaw`
      UPDATE "Area"
      SET "geom" = NULL
      WHERE "id" = ${areaId}::uuid
    `;
    return;
  }

  await prisma.$executeRaw`
    UPDATE "Area"
    SET "geom" = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(boundary)}), 4326))
    WHERE "id" = ${areaId}::uuid
  `;
}

export const areaService = {
  async list(
    actor: CurrentUser,
    params: {
      page: number;
      pageSize: number;
      search?: string;
      isActive?: boolean;
    },
  ) {
    requireRole(actor, "MANAGER");
    const [total, areas] = await areaRepository.list({
      ...params,
      organizationId: actor.organizationId,
    });

    return {
      items: areas,
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  },

  async create(
    actor: CurrentUser,
    input: {
      name: string;
      code: string;
      description?: string;
      boundary?: AreaBoundary;
    },
  ) {
    requireRole(actor, "ADMIN");

    const area = await areaRepository.create({
      organization: { connect: { id: actor.organizationId } },
      name: input.name,
      code: input.code,
      description: input.description,
      boundary: input.boundary,
    });

    await syncAreaGeometry(area.id, input.boundary);
    await auditRepository.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.CREATE,
      entityType: "Area",
      entityId: area.id,
    });

    return areaRepository.findById(area.id);
  },

  async update(
    actor: CurrentUser,
    areaId: string,
    input: {
      name?: string;
      code?: string;
      description?: string;
      boundary?: AreaBoundary;
      isActive?: boolean;
    },
  ) {
    requireRole(actor, "ADMIN");

    const existing = await areaRepository.findById(areaId);

    if (!existing || existing.organizationId !== actor.organizationId) {
      throw new NotFoundError("Area not found");
    }

    const area = await areaRepository.update(areaId, {
      name: input.name,
      code: input.code,
      description: input.description,
      boundary: input.boundary,
      isActive: input.isActive,
    });

    if ("boundary" in input) {
      await syncAreaGeometry(area.id, input.boundary);
    }

    await auditRepository.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entityType: "Area",
      entityId: area.id,
    });

    return areaRepository.findById(area.id);
  },

  async delete(actor: CurrentUser, areaId: string) {
    requireRole(actor, "ADMIN");

    const existing = await areaRepository.findById(areaId);

    if (!existing || existing.organizationId !== actor.organizationId) {
      throw new NotFoundError("Area not found");
    }

    const area = await areaRepository.delete(areaId);
    await auditRepository.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.DELETE,
      entityType: "Area",
      entityId: area.id,
    });

    return area;
  },
};
