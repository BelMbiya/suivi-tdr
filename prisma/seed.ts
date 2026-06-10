import {
  AuditAction,
  GeofenceEventType,
  GeofenceType,
  LocationAreaStatus,
  LocationSource,
  RoleName,
} from "../generated/prisma/client";
import { hashPassword } from "../lib/auth/password";
import { prisma } from "../lib/prisma";
import { offsetFromCenter } from "../utils/geo";

const organizationId = "10000000-0000-4000-8000-000000000001";
const defaultPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

function id(prefix: string, index: number) {
  const group = prefix[0] ?? "9";
  return `${group}${String(index).padStart(7, "0")}-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

const KM_PER_DEGREE_LAT = 111.32;
const MAX_BRANCH_RADIUS_METERS = 30;

function polygonFromMeters(lng: number, lat: number, radiusMeters: number) {
  const radiusKm = Math.min(radiusMeters, MAX_BRANCH_RADIUS_METERS) / 1000;
  const deltaLat = radiusKm / KM_PER_DEGREE_LAT;
  const deltaLng =
    radiusKm / (KM_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));

  return {
    type: "Polygon" as const,
    coordinates: [
      [
        [lng - deltaLng, lat - deltaLat],
        [lng + deltaLng, lat - deltaLat],
        [lng + deltaLng, lat + deltaLat],
        [lng - deltaLng, lat + deltaLat],
        [lng - deltaLng, lat - deltaLat],
      ],
    ],
  };
}

const baseAreas = [
  { name: "Gombe Centre", code: "AREA-001", lat: -4.315, lng: 15.312, radiusMeters: 20 },
  { name: "Limete Industriel", code: "AREA-002", lat: -4.35, lng: 15.34, radiusMeters: 25 },
  { name: "Ngaliema Ouest", code: "AREA-003", lat: -4.38, lng: 15.25, radiusMeters: 30 },
  { name: "Kintambo", code: "AREA-004", lat: -4.335, lng: 15.285, radiusMeters: 18 },
  { name: "Bandalungwa", code: "AREA-005", lat: -4.34, lng: 15.295, radiusMeters: 22 },
  { name: "Matete", code: "AREA-006", lat: -4.39, lng: 15.35, radiusMeters: 28 },
  { name: "Lemba", code: "AREA-007", lat: -4.405, lng: 15.32, radiusMeters: 15 },
  { name: "N'Djili", code: "AREA-008", lat: -4.385, lng: 15.42, radiusMeters: 30 },
  { name: "Masina", code: "AREA-009", lat: -4.375, lng: 15.39, radiusMeters: 24 },
  { name: "Brazza Centre", code: "AREA-010", lat: -4.265, lng: 15.283, radiusMeters: 20 },
];

const seedUsers = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@track-tdr.local",
    firstName: "Super",
    lastName: "Admin",
    roles: [RoleName.SUPER_ADMIN],
    areaIndexes: [0, 1, 2, 3, 4],
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    email: "admin.ops@track-tdr.local",
    firstName: "Aline",
    lastName: "Mbala",
    roles: [RoleName.ADMIN],
    areaIndexes: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    email: "manager.north@track-tdr.local",
    firstName: "Patrick",
    lastName: "Mavungu",
    roles: [RoleName.MANAGER],
    areaIndexes: [0, 1, 2],
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    email: "manager.south@track-tdr.local",
    firstName: "Grace",
    lastName: "Ilunga",
    roles: [RoleName.MANAGER],
    areaIndexes: [3, 4, 5],
  },
  ...Array.from({ length: 6 }, (_, index) => ({
    id: id("2000000", index + 5),
    email: `agent.${index + 1}@track-tdr.local`,
    firstName: ["Jean", "Sarah", "Moise", "Chantal", "David", "Nadine"][index],
    lastName: ["Kabasele", "Mbuyi", "Lukusa", "Tshibola", "Moke", "Nsimba"][index],
    roles: [RoleName.USER],
    areaIndexes: [index % baseAreas.length],
  })),
];

async function main() {
  const roles = await Promise.all(
    Object.values(RoleName).map((name) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  const organization = await prisma.organization.upsert({
    where: { slug: "default" },
    update: {
      name: "Default Organization",
      isActive: true,
    },
    create: {
      id: organizationId,
      name: "Default Organization",
      slug: "default",
    },
  });

  const passwordHash = await hashPassword(defaultPassword);
  const roleByName = new Map(roles.map((role) => [role.name, role]));

  const areas = [];
  for (const [index, area] of baseAreas.entries()) {
    const areaId = id("3000000", index + 1);
    const boundary = polygonFromMeters(area.lng, area.lat, area.radiusMeters);
    const savedArea = await prisma.area.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: area.code,
        },
      },
      update: {
        name: area.name,
        description: `Zone operationnelle ${area.name} · rayon ${area.radiusMeters} m`,
        boundary,
        isActive: true,
      },
      create: {
        id: areaId,
        organizationId: organization.id,
        name: area.name,
        code: area.code,
        description: `Zone operationnelle ${area.name} · rayon ${area.radiusMeters} m`,
        boundary,
      },
    });
    await prisma.$executeRaw`
      UPDATE "Area"
      SET "geom" = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(boundary)}), 4326))
      WHERE "id" = ${savedArea.id}::uuid
    `;
    areas.push({ ...area, id: savedArea.id, boundary });
  }

  const users = [];
  for (const seedUser of seedUsers) {
    const savedUser = await prisma.user.upsert({
      where: {
        organizationId_email: {
          organizationId: organization.id,
          email: seedUser.email,
        },
      },
      update: {
        firstName: seedUser.firstName,
        lastName: seedUser.lastName,
        isActive: true,
      },
      create: {
        id: seedUser.id,
        organizationId: organization.id,
        email: seedUser.email,
        firstName: seedUser.firstName,
        lastName: seedUser.lastName,
        passwordHash,
      },
    });

    for (const roleName of seedUser.roles) {
      const role = roleByName.get(roleName);
      if (role) {
        await prisma.userRole.upsert({
          where: {
            userId_roleId: {
              userId: savedUser.id,
              roleId: role.id,
            },
          },
          update: {},
          create: {
            userId: savedUser.id,
            roleId: role.id,
          },
        });
      }
    }

    for (const areaIndex of seedUser.areaIndexes) {
      const area = areas[areaIndex];
      await prisma.userArea.upsert({
        where: {
          userId_areaId: {
            userId: savedUser.id,
            areaId: area.id,
          },
        },
        update: {},
        create: {
          userId: savedUser.id,
          areaId: area.id,
        },
      });
    }
    users.push({ ...seedUser, id: savedUser.id });
  }

  for (const [index, user] of users.entries()) {
    await prisma.device.upsert({
      where: {
        organizationId_externalId: {
          organizationId: organization.id,
          externalId: `web-device-${index + 1}`,
        },
      },
      update: {
        userId: user.id,
        name: `Device ${index + 1}`,
        isActive: true,
        lastSeenAt: new Date(),
      },
      create: {
        id: id("4000000", index + 1),
        organizationId: organization.id,
        userId: user.id,
        name: `Device ${index + 1}`,
        platform: "WEB",
        externalId: `web-device-${index + 1}`,
        lastSeenAt: new Date(),
      },
    });
  }

  const devices = await prisma.device.findMany({
    where: { organizationId: organization.id },
    orderBy: { externalId: "asc" },
  });

  for (const [index, area] of areas.entries()) {
    const branchRadius = baseAreas[index]?.radiusMeters ?? 25;
    const geofenceRadius = Math.min(branchRadius, MAX_BRANCH_RADIUS_METERS);
    const geofence = await prisma.geofence.upsert({
      where: { id: id("5000000", index + 1) },
      update: {
        areaId: area.id,
        name: `${area.name} Control Zone`,
        type: GeofenceType.CIRCLE,
        centerLat: area.lat,
        centerLng: area.lng,
        radiusMeters: geofenceRadius,
        polygon: undefined,
        isActive: true,
      },
      create: {
        id: id("5000000", index + 1),
        organizationId: organization.id,
        areaId: area.id,
        name: `${area.name} Control Zone`,
        type: GeofenceType.CIRCLE,
        centerLat: area.lat,
        centerLng: area.lng,
        radiusMeters: geofenceRadius,
      },
    });

    await prisma.$executeRaw`
      UPDATE "Geofence"
      SET "geom" = ST_Buffer(
        ST_SetSRID(ST_MakePoint(${area.lng}, ${area.lat}), 4326)::geography,
        ${geofenceRadius}
      )::geometry
      WHERE "id" = ${geofence.id}::uuid
    `;
  }

  const geofences = await prisma.geofence.findMany({
    where: { organizationId: organization.id },
    orderBy: { name: "asc" },
  });

  const routeBearings = [35, 110, 195, 285, 75, 250, 10, 170, 140, 320];
  const pointsPerRoute = 30;

  for (const [userIndex, user] of users.entries()) {
    const assignedArea = areas[user.areaIndexes[0] ?? 0];
    const device = devices[userIndex % devices.length];
    const routeId = `route-${userIndex + 1}`;
    const branchRadiusMeters = baseAreas[user.areaIndexes[0] ?? 0]?.radiusMeters ?? 25;
    const bearing = routeBearings[userIndex % routeBearings.length];
    const leavesBranch = userIndex % 3 !== 1;
    const maxTravelMeters = leavesBranch
      ? 450 + (userIndex % 5) * 180
      : Math.max(8, branchRadiusMeters * 0.55);
    const areaCenter = { latitude: assignedArea.lat, longitude: assignedArea.lng };

    for (let step = 0; step < pointsPerRoute; step += 1) {
      const progress = step / (pointsPerRoute - 1);
      const travelMeters = progress * maxTravelMeters;
      const wobbleMeters = leavesBranch ? Math.sin(progress * Math.PI * 2) * 12 : 0;
      const point = offsetFromCenter(
        assignedArea.lat,
        assignedArea.lng,
        bearing,
        travelMeters,
      );
      const wobbled = wobbleMeters
        ? offsetFromCenter(point.latitude, point.longitude, bearing + 90, Math.abs(wobbleMeters))
        : point;
      const recordedAt = new Date(Date.now() - (pointsPerRoute - step) * 90_000);
      const distanceFromArea = Math.hypot(
        (wobbled.latitude - assignedArea.lat) * KM_PER_DEGREE_LAT * 1000,
        (wobbled.longitude - assignedArea.lng) *
          KM_PER_DEGREE_LAT *
          1000 *
          Math.cos((assignedArea.lat * Math.PI) / 180),
      );
      const areaStatus =
        distanceFromArea <= branchRadiusMeters
          ? LocationAreaStatus.IN_AREA
          : LocationAreaStatus.OUT_OF_AREA;
      const latitude = wobbled.latitude;
      const longitude = wobbled.longitude;
      const clientId = `seed-${userIndex + 1}-${step + 1}`;
      await prisma.location.upsert({
        where: {
          userId_clientId: {
            userId: user.id,
            clientId,
          },
        },
        update: {
          latitude,
          longitude,
          speed: 8 + (step % 12),
          batteryLevel: Math.max(20, 98 - step * 2),
          recordedAt,
          areaStatus,
          metadata: {
            seed: true,
            routeId,
            sequence: step + 1,
            points: pointsPerRoute,
            origin: areaCenter,
          },
        },
        create: {
          organizationId: organization.id,
          userId: user.id,
          areaId: assignedArea.id,
          deviceId: device?.id,
          latitude,
          longitude,
          accuracy: 5 + (step % 6),
          speed: 8 + (step % 12),
          altitude: 310 + step,
          heading: Math.round((progress * 180 + userIndex * 13) % 360),
          batteryLevel: Math.max(20, 98 - step * 2),
          source: LocationSource.WEB,
          clientId,
          recordedAt,
          areaStatus,
          metadata: {
            seed: true,
            routeId,
            sequence: step + 1,
            points: pointsPerRoute,
            origin: areaCenter,
          },
        },
      });
    }
  }

  const latestLocations = await prisma.location.findMany({
    where: { organizationId: organization.id },
    distinct: ["userId"],
    orderBy: [{ userId: "asc" }, { recordedAt: "desc" }],
  });

  for (const [index, location] of latestLocations.slice(0, 10).entries()) {
    const geofence = geofences[index % geofences.length];
    if (geofence) {
      await prisma.geofenceEvent.upsert({
        where: { id: id("7000000", index + 1) },
        update: {
          geofenceId: geofence.id,
          userId: location.userId,
          locationId: location.id,
          type: index % 2 === 0 ? GeofenceEventType.ENTER : GeofenceEventType.EXIT,
        },
        create: {
          id: id("7000000", index + 1),
          organizationId: organization.id,
          geofenceId: geofence.id,
          userId: location.userId,
          locationId: location.id,
          type: index % 2 === 0 ? GeofenceEventType.ENTER : GeofenceEventType.EXIT,
          metadata: { seed: true },
        },
      });
    }
  }

  for (const [index, user] of users.entries()) {
    await prisma.auditLog.upsert({
      where: { id: id("8000000", index + 1) },
      update: {
        actorId: user.id,
        action: AuditAction.CREATE,
        entityType: "SeedUser",
        entityId: user.id,
      },
      create: {
        id: id("8000000", index + 1),
        organizationId: organization.id,
        actorId: user.id,
        action: AuditAction.CREATE,
        entityType: "SeedUser",
        entityId: user.id,
        metadata: { seed: true },
      },
    });
  }

  console.log("Seed completed");
  console.log(`Login: ${seedUsers[0].email}`);
  console.log(`Password: ${defaultPassword}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
