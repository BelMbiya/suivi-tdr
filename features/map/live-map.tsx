"use client";

import L from "leaflet";
import "leaflet.markercluster";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import {
  realtimePollInterval,
  realtimePollLabel,
  useAuthenticatedSocket,
} from "@/hooks/use-authenticated-socket";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { DatePeriodFilter } from "@/components/filters/date-period-filter";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { hasRole } from "@/lib/auth/permissions";
import { api } from "@/lib/http";
import type { CurrentUser } from "@/types/domain";
import {
  buildLocationSearchParams,
  defaultCustomRange,
  isWithinDateRange,
  resolveLocationPeriodRange,
  type LocationPeriod,
} from "@/utils/date-period";
import { distanceInMeters } from "@/utils/geo";
import { AreaLayers } from "@/features/map/area-layers";
import { MapLegend } from "@/features/map/map-legend";
import {
  boundaryToLeafletPositions,
  buildRouteDrawSegments,
  enrichMapLocations,
  mergeLocationFeed,
  filterMapLocations,
  locationMatchesAreaScope,
  appendRouteLocation,
  colorForArea,
  colorForUser,
  formatLocationTime,
  formatUserLabel,
  groupRoutesByUser,
  isAreaBoundary,
  latestLocationForUser,
  latestRoutePointPerUser,
  polygonCentroid,
  routeBounds,
  routesSignature,
  toLatLng,
  type MapArea,
  type MapLocation,
  type MapUserDirectory,
} from "@/features/map/map-utils";
type Paginated<T> = { items: T[]; total: number };

type MapDirectoryUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  areas?: { id: string; name: string; code: string }[];
};

const REALTIME_PERIOD: LocationPeriod = "today";

const defaultCenter: [number, number] = [-4.325, 15.312];

function buildUserDirectory(users: MapDirectoryUser[] | undefined): MapUserDirectory {
  return Object.fromEntries(
    (users ?? []).map((user) => [
      user.id,
      {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    ]),
  );
}

function applyLocationPayload(
  payload: Paginated<MapLocation>,
  directory: MapUserDirectory,
  setRouteLocations: Dispatch<SetStateAction<MapLocation[]>>,
  merge = false,
) {
  const enriched = enrichMapLocations(payload.items, directory);

  setRouteLocations((current) =>
    merge ? mergeLocationFeed(current, enriched, directory) : enriched,
  );
}

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export function LiveMap() {
  const searchParams = useSearchParams();
  const initialLocationId = searchParams.get("locationId");
  const initialUserId = searchParams.get("userId");
  const [routeLocations, setRouteLocations] = useState<MapLocation[]>([]);
  const [search, setSearch] = useState("");
  const [areaId, setAreaId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialUserId);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(initialLocationId);
  const [autoFollow, setAutoFollow] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const autoFollowRef = useRef(autoFollow);
  const selectedUserIdRef = useRef<string | null>(selectedUserId);
  const areaIdRef = useRef(areaId);
  const activeDateRangeRef = useRef<ReturnType<typeof resolveLocationPeriodRange>>(
    resolveLocationPeriodRange("today"),
  );
  const assignedUserIdsRef = useRef<ReadonlySet<string>>(new Set());
  const userDirectoryRef = useRef<MapUserDirectory>({});
  const selectedRouteQueryRef = useRef<string | null>(null);
  const defaultRange = defaultCustomRange();
  const [period, setPeriod] = useState<LocationPeriod>("today");
  const [customFrom, setCustomFrom] = useState(defaultRange.from);
  const [customTo, setCustomTo] = useState(defaultRange.to);
  const { data: currentUser, isLoading: authLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api<CurrentUser>("/api/auth/me"),
    retry: 1,
  });
  const canViewMap = Boolean(currentUser && hasRole(currentUser, "MANAGER"));
  const { data: areas } = useQuery({
    queryKey: ["areas", "map"],
    queryFn: () => api<Paginated<MapArea>>("/api/areas?pageSize=100"),
    enabled: canViewMap,
  });
  const { data: usersDirectoryData } = useQuery({
    queryKey: ["users", "map-directory"],
    queryFn: () => api<Paginated<MapDirectoryUser>>("/api/users?pageSize=200"),
    enabled: canViewMap,
  });
  const userDirectory = useMemo(
    () => buildUserDirectory(usersDirectoryData?.items),
    [usersDirectoryData?.items],
  );

  const routeQuery = useMemo(
    () =>
      buildLocationSearchParams({
        mode: "all",
        pageSize: 500,
        period,
        customFrom,
        customTo,
        areaId: areaId || undefined,
      }).toString(),
    [areaId, customFrom, customTo, period],
  );

  const selectedRouteQuery = useMemo(() => {
    if (!selectedUserId) {
      return null;
    }

    return buildLocationSearchParams({
      mode: "all",
      pageSize: 2000,
      userId: selectedUserId,
      period,
      customFrom,
      customTo,
    }).toString();
  }, [customFrom, customTo, period, selectedUserId]);

  const activeDateRange = useMemo(
    () => resolveLocationPeriodRange(period, customFrom, customTo),
    [customFrom, customTo, period],
  );

  const assignedUserIds = useMemo(() => {
    if (!areaId) {
      return new Set<string>();
    }

    return new Set(
      (usersDirectoryData?.items ?? [])
        .filter((user) => user.areas?.some((area) => area.id === areaId))
        .map((user) => user.id),
    );
  }, [areaId, usersDirectoryData?.items]);

  useEffect(() => {
    autoFollowRef.current = autoFollow;
  }, [autoFollow]);

  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  useEffect(() => {
    areaIdRef.current = areaId;
  }, [areaId]);

  useEffect(() => {
    activeDateRangeRef.current = activeDateRange;
  }, [activeDateRange]);

  useEffect(() => {
    assignedUserIdsRef.current = assignedUserIds;
  }, [assignedUserIds]);

  useEffect(() => {
    userDirectoryRef.current = userDirectory;
  }, [userDirectory]);

  useEffect(() => {
    selectedRouteQueryRef.current = selectedRouteQuery;
  }, [selectedRouteQuery]);

  const loadLocations = useMemo(
    () => () => api<Paginated<MapLocation>>(`/api/locations?${routeQuery}`),
    [routeQuery],
  );

  useEffect(() => {
    if (!canViewMap) {
      return;
    }

    const selectedQuery = selectedRouteQuery;

    Promise.all([
      loadLocations(),
      selectedQuery
        ? api<Paginated<MapLocation>>(`/api/locations?${selectedQuery}`)
        : Promise.resolve(null),
    ])
      .then(([payload, selectedPayload]) => {
        applyLocationPayload(payload, userDirectoryRef.current, setRouteLocations, true);
        if (selectedPayload) {
          applyLocationPayload(
            selectedPayload,
            userDirectoryRef.current,
            setRouteLocations,
            true,
          );
        }
        setLoadError(null);
      })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : "Chargement impossible");
      });
  }, [canViewMap, loadLocations, selectedRouteQuery]);

  useEffect(() => {
    if (!Object.keys(userDirectory).length) {
      return;
    }

    setRouteLocations((current) => enrichMapLocations(current, userDirectory));
  }, [userDirectory]);

  const { socket, isConnected } = useAuthenticatedSocket(period === REALTIME_PERIOD);

  const syncLocations = useMemo(
    () => async (merge = true) => {
      const selectedQuery = selectedRouteQueryRef.current;

      const [payload, selectedPayload] = await Promise.all([
        loadLocations(),
        selectedQuery
          ? api<Paginated<MapLocation>>(`/api/locations?${selectedQuery}`)
          : Promise.resolve(null),
      ]);

      applyLocationPayload(payload, userDirectoryRef.current, setRouteLocations, merge);

      if (selectedPayload) {
        applyLocationPayload(
          selectedPayload,
          userDirectoryRef.current,
          setRouteLocations,
          true,
        );
      }

      setLoadError(null);
    },
    [loadLocations],
  );

  useEffect(() => {
    if (!canViewMap || period !== REALTIME_PERIOD) {
      return;
    }

    void syncLocations(true).catch((error) => {
      setLoadError(error instanceof Error ? error.message : "Synchronisation impossible");
    });

    const pollMs = realtimePollInterval(isConnected);
    const timer = window.setInterval(() => {
      void syncLocations(true).catch((error) => {
        setLoadError(error instanceof Error ? error.message : "Synchronisation impossible");
      });
    }, pollMs);

    return () => window.clearInterval(timer);
  }, [canViewMap, isConnected, period, syncLocations]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const onLocationUpdate = (location: MapLocation) => {
      if (!isWithinDateRange(location.recordedAt, activeDateRangeRef.current)) {
        return;
      }

      if (
        !locationMatchesAreaScope(
          location,
          areaIdRef.current || undefined,
          assignedUserIdsRef.current,
        )
      ) {
        return;
      }

      setRouteLocations((current) =>
        appendRouteLocation(current, location, userDirectoryRef.current),
      );

      const trackedUserId = selectedUserIdRef.current;
      if (trackedUserId && location.userId === trackedUserId) {
        setSelectedLocationId(location.id);
      }
    };

    const onConnect = () => {
      void syncLocations(true).catch((error) => {
        setLoadError(error instanceof Error ? error.message : "Synchronisation impossible");
      });
    };

    socket.on("location:update", onLocationUpdate);
    socket.on("connect", onConnect);

    return () => {
      socket.off("location:update", onLocationUpdate);
      socket.off("connect", onConnect);
    };
  }, [socket, syncLocations]);

  const filteredRoutes = useMemo(
    () =>
      filterMapLocations(routeLocations, {
        search,
        areaId: areaId || undefined,
        assignedUserIds,
      }),
    [areaId, assignedUserIds, routeLocations, search],
  );
  const displayLocations = useMemo(
    () => latestRoutePointPerUser(filteredRoutes),
    [filteredRoutes],
  );

  const selectedLocation = useMemo(() => {
    if (!selectedUserId) {
      return null;
    }

    return latestLocationForUser(
      selectedUserId,
      displayLocations,
      filteredRoutes,
    );
  }, [displayLocations, filteredRoutes, selectedUserId]);

  const selectedArea = useMemo(
    () => areas?.items.find((area) => area.id === areaId),
    [areaId, areas?.items],
  );

  const center = useMemo<[number, number]>(() => {
    if (selectedLocation) {
      return [selectedLocation.latitude, selectedLocation.longitude];
    }

    if (selectedArea && isAreaBoundary(selectedArea.boundary)) {
      return polygonCentroid(selectedArea.boundary);
    }

    const bounds = routeBounds(displayLocations);
    if (bounds) {
      return [
        (bounds.minLat + bounds.maxLat) / 2,
        (bounds.minLng + bounds.maxLng) / 2,
      ];
    }

    return defaultCenter;
  }, [displayLocations, selectedArea, selectedLocation]);
  const selectedRoute = useMemo(
    () =>
      selectedUserId
        ? filteredRoutes.filter((location) => location.userId === selectedUserId)
        : [],
    [filteredRoutes, selectedUserId],
  );

  const selectedRouteRenderKey = useMemo(
    () => routesSignature(selectedRoute),
    [selectedRoute],
  );
  const routesRenderKey = useMemo(() => routesSignature(filteredRoutes), [filteredRoutes]);
  const debouncedRoutesRenderKey = useDebouncedValue(
    selectedUserId ? selectedRouteRenderKey : routesRenderKey,
    150,
  );

  const selectedUserAreaId = useMemo(() => {
    if (!selectedUserId) {
      return null;
    }

    return (
      usersDirectoryData?.items.find((user) => user.id === selectedUserId)?.areas?.[0]?.id ??
      selectedRoute[0]?.areaId ??
      null
    );
  }, [selectedRoute, selectedUserId, usersDirectoryData?.items]);

  useEffect(() => {
    if (!selectedLocation) {
      return;
    }

    if (selectedLocation.id !== selectedLocationId) {
      setSelectedLocationId(selectedLocation.id);
    }
  }, [selectedLocation, selectedLocationId]);

  if (authLoading) {
    return (
      <Card className="p-6 text-sm text-zinc-500">Chargement de la carte...</Card>
    );
  }

  if (!canViewMap) {
    return (
      <Card className="space-y-3 p-6">
        <h1 className="text-xl font-semibold">Live Map</h1>
        <p className="text-sm text-zinc-600">
          Cette page est réservée aux managers et administrateurs.
        </p>
        <p className="text-sm text-zinc-500">
          Si vous êtes agent terrain, utilisez <strong>Mon suivi</strong> pour envoyer votre position.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Live Map</h1>
        <p className="mt-2 text-zinc-500">
          Trajet A→B depuis la zone assignée, y compris hors périmètre, avec suivi temps réel.
        </p>
        {loadError ? (
          <p className="mt-2 text-sm text-red-600">{loadError}</p>
        ) : null}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(340px,400px)_1fr] xl:items-stretch">
        <Card className="flex h-[min(78vh,720px)] flex-col overflow-hidden xl:h-[640px]">
          <section className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-950">
                Utilisateurs ({displayLocations.length})
              </p>
              <span className="text-xs text-zinc-500">
                {filteredRoutes.length} pts
              </span>
            </div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
              {displayLocations.map((location) => (
                <button
                  key={location.userId}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left hover:bg-zinc-50 ${
                    selectedUserId === location.userId
                      ? "border-zinc-950 bg-zinc-50"
                      : "border-zinc-200"
                  }`}
                  onClick={() => {
                    setSelectedUserId(location.userId);
                    setSelectedLocationId(location.id);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {formatUserLabel(location)}
                      </div>
                      <div className="truncate text-xs text-zinc-500">{location.user?.email}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {location.area?.code ?? "No area"} · reçu{" "}
                        {formatLocationTime(location, {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </div>
                    </div>
                    <Badge
                      className={
                        location.areaStatus === "IN_AREA"
                          ? "shrink-0 bg-green-100 text-green-700"
                          : "shrink-0 bg-amber-100 text-amber-700"
                      }
                    >
                      {location.areaStatus === "IN_AREA" ? "IN" : "OUT"}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <details className="mt-2 shrink-0 rounded-xl border border-zinc-200 bg-white text-sm">
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-zinc-800">
              Filtres
            </summary>
            <div className="space-y-2 border-t border-zinc-100 px-3 py-2">
              <Input
                placeholder="Search user, email, area..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
                value={areaId}
                onChange={(event) => {
                  setAreaId(event.target.value);
                  setSelectedUserId(null);
                  setSelectedLocationId(null);
                }}
              >
                <option value="">All areas</option>
                {areas?.items.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.code} - {area.name}
                  </option>
                ))}
              </select>
              <DatePeriodFilter
                compact
                period={period}
                customFrom={customFrom}
                customTo={customTo}
                onPeriodChange={setPeriod}
                onCustomFromChange={setCustomFrom}
                onCustomToChange={setCustomTo}
              />
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={autoFollow}
                  onChange={(event) => setAutoFollow(event.target.checked)}
                />
                Auto-follow temps réel
              </label>
              {period === REALTIME_PERIOD ? (
                <p className="text-xs text-zinc-500">{realtimePollLabel(isConnected)}</p>
              ) : null}
              {areas?.items.length ? (
                <details className="rounded-lg bg-zinc-50 p-2 text-xs">
                  <summary className="cursor-pointer font-medium text-zinc-700">
                    Zones sur la carte ({areas.items.length})
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {areas.items.map((area) => (
                      <span
                        key={area.id}
                        className="inline-flex rounded-full border border-white px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                        style={{ backgroundColor: colorForArea(area.id) }}
                      >
                        {area.code}
                      </span>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </details>

          {selectedLocation ? (
            <details className="mt-2 shrink-0 rounded-xl border border-zinc-200 bg-zinc-50 text-sm">
              <summary className="cursor-pointer list-none px-3 py-2 font-semibold marker:content-none">
                <div className="flex items-center justify-between gap-2">
                  <span>Location sélectionnée</span>
                  <Badge
                    className={
                      selectedLocation.areaStatus === "IN_AREA"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }
                  >
                    {selectedLocation.areaStatus}
                  </Badge>
                </div>
              </summary>
              <dl className="grid grid-cols-2 gap-x-2 gap-y-1 border-t border-zinc-200 px-3 py-2 text-xs text-zinc-600">
                <div className="col-span-2 truncate">
                  <dt className="font-medium text-zinc-950">User</dt>
                  <dd>{selectedLocation.user?.email ?? "-"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-950">Area</dt>
                  <dd>{selectedLocation.area?.code ?? "-"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-950">Course</dt>
                  <dd>{selectedRoute.length} pts</dd>
                </div>
                <div className="col-span-2">
                  <dt className="font-medium text-zinc-950">Dernière réception</dt>
                  <dd>{formatLocationTime(selectedLocation)}</dd>
                </div>
              </dl>
            </details>
          ) : null}
        </Card>
        <Card className="relative overflow-hidden p-0">
          <MapLegend selectedUserId={selectedUserId} />
          <MapContainer center={defaultCenter} zoom={12} className="map-shell">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapViewport
              center={center}
              selectedRoute={selectedRoute}
              autoFollow={autoFollow}
              areaId={areaId}
              areas={areas?.items ?? []}
              fitLocations={displayLocations}
            />
            <AreaLayers areas={areas?.items ?? []} selectedAreaId={areaId || undefined} />
            <RoutePolylines
              locations={filteredRoutes}
              selectedRoute={selectedRoute}
              areas={areas?.items ?? []}
              selectedUserId={selectedUserId}
              selectedUserAreaId={selectedUserAreaId}
              renderKey={debouncedRoutesRenderKey}
            />
            <RouteEndpoints route={selectedRoute} />
            <SelectedLocationMarker location={selectedLocation} />
            <ClusteredMarkers
              locations={displayLocations}
              selectedLocationId={selectedLocationId}
              onSelect={(location) => {
                setSelectedUserId(location.userId);
                setSelectedLocationId(location.id);
              }}
            />
          </MapContainer>
        </Card>
      </div>
    </div>
  );
}

function ensureRoutePane(map: L.Map) {
  if (map.getPane("routePane")) {
    return;
  }

  map.createPane("routePane");
  const pane = map.getPane("routePane");
  if (pane) {
    pane.style.zIndex = "450";
  }
}

function drawRouteSegments(
  layer: L.LayerGroup,
  params: {
    route: MapLocation[];
    userId: string;
    areas: MapArea[];
    assignedAreaId?: string | null;
    isSelected: boolean;
    selectedUserId: string | null;
  },
) {
  const segments = buildRouteDrawSegments({
    route: params.route,
    userId: params.userId,
    areas: params.areas,
    assignedAreaId: params.assignedAreaId,
  });

  for (const segment of segments) {
    if (segment.positions.length < 2) {
      continue;
    }

    const polyline = L.polyline(segment.positions, {
      pane: "routePane",
      color: colorForUser(params.userId),
      weight: params.isSelected ? 7 : 4,
      opacity: params.selectedUserId && !params.isSelected ? 0.35 : 0.95,
      dashArray: segment.areaStatus === "OUT_OF_AREA" ? "10 8" : undefined,
      lineCap: "round",
      lineJoin: "round",
    });
    polyline.addTo(layer);
  }
}

function RoutePolylines({
  locations,
  selectedRoute,
  areas,
  selectedUserId,
  selectedUserAreaId,
  renderKey,
}: {
  locations: MapLocation[];
  selectedRoute: MapLocation[];
  areas: MapArea[];
  selectedUserId: string | null;
  selectedUserAreaId: string | null;
  renderKey: string;
}) {
  const map = useMap();
  const activeLayerRef = useRef<L.LayerGroup | null>(null);
  const drawStateRef = useRef({
    locations,
    selectedRoute,
    areas,
    selectedUserId,
    selectedUserAreaId,
  });

  drawStateRef.current = {
    locations,
    selectedRoute,
    areas,
    selectedUserId,
    selectedUserAreaId,
  };

  useEffect(() => {
    ensureRoutePane(map);

    const drawRoutes = () => {
      const state = drawStateRef.current;
      const nextLayer = L.layerGroup();

      if (state.selectedUserId && state.selectedRoute.length > 0) {
        drawRouteSegments(nextLayer, {
          route: state.selectedRoute,
          userId: state.selectedUserId,
          areas: state.areas,
          assignedAreaId: state.selectedUserAreaId,
          isSelected: true,
          selectedUserId: state.selectedUserId,
        });
      }

      const groups = groupRoutesByUser(state.locations);
      for (const [userId, route] of Object.entries(groups)) {
        if (userId === state.selectedUserId) {
          continue;
        }

        drawRouteSegments(nextLayer, {
          route,
          userId,
          areas: state.areas,
          assignedAreaId: route[0]?.areaId,
          isSelected: false,
          selectedUserId: state.selectedUserId,
        });
      }

      if (activeLayerRef.current) {
        map.removeLayer(activeLayerRef.current);
      }

      activeLayerRef.current = nextLayer;
      nextLayer.addTo(map);
    };

    if (map.getSize().x > 0) {
      drawRoutes();
    } else {
      map.whenReady(drawRoutes);
    }
  }, [map, renderKey]);

  useEffect(
    () => () => {
      if (activeLayerRef.current) {
        map.removeLayer(activeLayerRef.current);
        activeLayerRef.current = null;
      }
    },
    [map],
  );

  return null;
}

function RouteEndpoints({ route }: { route: MapLocation[] }) {
  const map = useMap();

  useEffect(() => {
    if (route.length < 1) {
      return;
    }

    const layers = L.layerGroup();
    const start = route[0];
    const end = route[route.length - 1];
    const userColor = colorForUser(start.userId);

    const startPosition = toLatLng(start);
    const endPosition = toLatLng(end);
    if (!startPosition || !endPosition) {
      return;
    }

    const origin = L.circleMarker(startPosition, {
      radius: 8,
      color: "#ffffff",
      fillColor: colorForArea(start.areaId ?? start.userId),
      fillOpacity: 1,
      weight: 3,
    });
    origin.bindTooltip("Départ (zone)", { permanent: false, direction: "top" });
    layers.addLayer(origin);

    const destination = L.circleMarker(endPosition, {
      radius: 10,
      color: "#111827",
      fillColor: userColor,
      fillOpacity: 1,
      weight: 3,
    });
    destination.bindTooltip("Position actuelle", { permanent: false, direction: "top" });
    layers.addLayer(destination);

    map.addLayer(layers);

    return () => {
      map.removeLayer(layers);
    };
  }, [map, route]);

  return null;
}

function SelectedLocationMarker({ location }: { location: MapLocation | null }) {
  const map = useMap();
  const markerRef = useRef<L.CircleMarker | null>(null);
  const popupOpenRef = useRef(false);

  useEffect(() => {
    if (!location) {
      markerRef.current?.removeFrom(map);
      markerRef.current = null;
      popupOpenRef.current = false;
      return;
    }

    const popupContent = `<strong>Location sélectionnée</strong><br/>
      ${location.user?.email ?? ""}<br/>
      ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}<br/>
      Reçu : ${formatLocationTime(location)}`;

    if (!markerRef.current) {
      const circle = L.circleMarker([location.latitude, location.longitude], {
        radius: 12,
        color: "#111827",
        fillColor: colorForUser(location.userId),
        fillOpacity: 0.95,
        weight: 3,
      });
      circle.bindPopup(popupContent);
      circle.on("popupopen", () => {
        popupOpenRef.current = true;
      });
      circle.on("popupclose", () => {
        popupOpenRef.current = false;
      });
      circle.addTo(map);
      circle.openPopup();
      popupOpenRef.current = true;
      markerRef.current = circle;
      return;
    }

    const previous = markerRef.current.getLatLng();
    const moved = distanceInMeters(
      { latitude: previous.lat, longitude: previous.lng },
      { latitude: location.latitude, longitude: location.longitude },
    );

    if (moved >= 1) {
      markerRef.current.setLatLng([location.latitude, location.longitude]);
    }

    markerRef.current.setPopupContent(popupContent);
  }, [location, map]);

  useEffect(
    () => () => {
      markerRef.current?.removeFrom(map);
      markerRef.current = null;
    },
    [map],
  );

  return null;
}

function MapViewport({
  center,
  selectedRoute,
  autoFollow,
  areaId,
  areas,
  fitLocations,
}: {
  center: [number, number];
  selectedRoute: MapLocation[];
  autoFollow: boolean;
  areaId: string;
  areas: MapArea[];
  fitLocations: MapLocation[];
}) {
  const map = useMap();
  const lastRouteSize = useRef(0);
  const lastUserId = useRef<string | null>(null);
  const lastAreaId = useRef<string | undefined>(undefined);
  const lastCenterKey = useRef<string | null>(null);
  const lastPanCoordinate = useRef<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (areaId === lastAreaId.current) {
      return;
    }

    lastAreaId.current = areaId;
    lastRouteSize.current = 0;
    lastUserId.current = null;
    lastCenterKey.current = null;

    if (areaId) {
      const area = areas.find((item) => item.id === areaId);
      if (isAreaBoundary(area?.boundary)) {
        const bounds = L.latLngBounds(boundaryToLeafletPositions(area.boundary));
        map.flyToBounds(bounds, {
          padding: [56, 56],
          maxZoom: 17,
          duration: 0.65,
        });
        return;
      }
    }

    if (fitLocations.length > 0) {
      const bounds = L.latLngBounds(
        fitLocations.map((location) => [location.latitude, location.longitude]),
      );
      map.flyToBounds(bounds, {
        padding: [56, 56],
        maxZoom: 15,
        duration: 0.65,
      });
      return;
    }

    map.flyTo(defaultCenter, 12, { duration: 0.5 });
  }, [areaId, areas, fitLocations, map]);

  useEffect(() => {
    if (!selectedRoute.length) {
      return;
    }

    const userId = selectedRoute[0]?.userId ?? null;
    const userChanged = userId !== lastUserId.current;
    const routeGrew = selectedRoute.length > lastRouteSize.current;
    const lastPoint = selectedRoute.at(-1);
    const centerKey = lastPoint
      ? `${lastPoint.id}:${lastPoint.latitude.toFixed(6)}:${lastPoint.longitude.toFixed(6)}`
      : null;
    const positionChanged = centerKey !== lastCenterKey.current;
    const movedMeters =
      autoFollow && lastPoint && lastPanCoordinate.current
        ? distanceInMeters(lastPanCoordinate.current, {
            latitude: lastPoint.latitude,
            longitude: lastPoint.longitude,
          })
        : Number.POSITIVE_INFINITY;

    if (selectedRoute.length >= 2 && (userChanged || routeGrew || lastRouteSize.current === 0)) {
      const bounds = L.latLngBounds(
        selectedRoute.map((location) => [location.latitude, location.longitude]),
      );

      map.flyToBounds(bounds, {
        padding: [56, 56],
        maxZoom: 17,
        duration: 0.65,
      });
      lastRouteSize.current = selectedRoute.length;
      lastUserId.current = userId;
      lastCenterKey.current = centerKey;
      return;
    }

    if (
      autoFollow &&
      selectedRoute.length >= 1 &&
      (userChanged || (positionChanged && movedMeters >= 3))
    ) {
      map.panTo(center, { animate: true, duration: 0.45 });
      lastRouteSize.current = selectedRoute.length;
      lastUserId.current = userId;
      lastCenterKey.current = centerKey;
      if (lastPoint) {
        lastPanCoordinate.current = {
          latitude: lastPoint.latitude,
          longitude: lastPoint.longitude,
        };
      }
      return;
    }

    if (selectedRoute.length === 1 && (userChanged || positionChanged)) {
      map.flyTo(center, 16, { duration: 0.5 });
      lastRouteSize.current = selectedRoute.length;
      lastUserId.current = userId;
      lastCenterKey.current = centerKey;
    }
  }, [autoFollow, center, map, selectedRoute]);

  return null;
}

function ClusteredMarkers({
  locations,
  selectedLocationId,
  onSelect,
}: {
  locations: MapLocation[];
  selectedLocationId: string | null;
  onSelect: (location: MapLocation) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const cluster = L.markerClusterGroup();

    locations.forEach((location) => {
      const marker = L.marker([location.latitude, location.longitude], {
        opacity: selectedLocationId && selectedLocationId !== location.id ? 0.7 : 1,
      });
      marker.bindPopup(
        `<strong>${formatUserLabel(location)}</strong><br/>
        ${location.user?.email ?? ""}<br/>
        Area: ${location.area?.code ?? "-"}<br/>
        Status: ${location.areaStatus}<br/>
        Speed: ${location.speed ?? "-"}<br/>
        Battery: ${location.batteryLevel ?? "-"}<br/>
        Recorded: ${new Date(location.recordedAt).toLocaleString()}`,
      );
      marker.on("click", () => onSelect(location));
      cluster.addLayer(marker);
    });

    map.addLayer(cluster);

    return () => {
      map.removeLayer(cluster);
    };
  }, [locations, map, onSelect, selectedLocationId]);

  return null;
}
