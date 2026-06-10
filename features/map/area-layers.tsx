"use client";

import L from "leaflet";
import { Fragment } from "react";
import { Marker, Polygon, Popup } from "react-leaflet";
import {
  boundaryToLeafletPositions,
  colorForArea,
  isAreaBoundary,
  polygonCentroid,
  type MapArea,
} from "@/features/map/map-utils";

function createAreaDivIcon(code: string, name: string, color: string) {
  return L.divIcon({
    className: "area-marker-icon",
    html: `<div class="area-marker-label" style="background:${color}" title="${name}">${code}</div>`,
    iconSize: [80, 30],
    iconAnchor: [40, 15],
  });
}

export function AreaLayers({
  areas,
  selectedAreaId,
}: {
  areas: MapArea[];
  selectedAreaId?: string;
}) {
  return (
    <>
      {areas.map((area) => {
        if (!isAreaBoundary(area.boundary)) {
          return null;
        }

        const positions = boundaryToLeafletPositions(area.boundary);
        const centroid = polygonCentroid(area.boundary);
        const color = colorForArea(area.id);
        const isHighlighted = !selectedAreaId || selectedAreaId === area.id;

        if (selectedAreaId && selectedAreaId !== area.id) {
          return null;
        }

        return (
          <Fragment key={area.id}>
            <Polygon
              positions={positions}
              pathOptions={{
                color,
                weight: isHighlighted ? 3 : 2,
                dashArray: "10 8",
                fillColor: color,
                fillOpacity: isHighlighted ? 0.16 : 0.08,
                opacity: isHighlighted ? 0.95 : 0.45,
              }}
            />
            <Marker
              position={centroid}
              icon={createAreaDivIcon(area.code, area.name, color)}
              zIndexOffset={-200}
            >
              <Popup>
                <strong>Zone {area.code}</strong>
                <br />
                {area.name}
                <br />
                <span style={{ color: "#6b7280", fontSize: "12px" }}>
                  Périmètre opérationnel
                </span>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </>
  );
}
