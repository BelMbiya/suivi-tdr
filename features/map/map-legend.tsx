"use client";

import { colorForUser } from "@/features/map/map-utils";

type MapLegendProps = {
  selectedUserId?: string | null;
};

function LegendLine({
  color,
  dashed = false,
  thick = false,
}: {
  color: string;
  dashed?: boolean;
  thick?: boolean;
}) {
  return (
    <span
      className="inline-block h-0 w-8 shrink-0 border-t-[3px] rounded-full"
      style={{
        borderColor: color,
        borderTopStyle: dashed ? "dashed" : "solid",
        opacity: thick ? 1 : 0.9,
      }}
      aria-hidden="true"
    />
  );
}

function LegendDot({
  fill,
  stroke = "#ffffff",
  size = 10,
}: {
  fill: string;
  stroke?: string;
  size?: number;
}) {
  return (
    <span
      className="inline-block shrink-0 rounded-full border-2"
      style={{
        width: size,
        height: size,
        backgroundColor: fill,
        borderColor: stroke,
      }}
      aria-hidden="true"
    />
  );
}

export function MapLegend({ selectedUserId }: MapLegendProps) {
  const routeColor = colorForUser(selectedUserId ?? "legend-user");

  return (
    <div
      className="pointer-events-none absolute bottom-3 left-3 z-[1000] max-w-[min(100%-1.5rem,280px)] rounded-xl border border-zinc-200/90 bg-white/95 p-3 text-xs text-zinc-700 shadow-md backdrop-blur-sm"
      aria-label="Légende de la carte"
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        Légende
      </p>
      <ul className="space-y-1.5">
        <li className="flex items-center gap-2">
          <span
            className="h-3 w-5 shrink-0 rounded-sm border-2 border-dashed border-sky-700/70 bg-sky-500/20"
            aria-hidden="true"
          />
          <span>Zone opérationnelle</span>
        </li>
        <li className="flex items-center gap-2">
          <LegendLine color={routeColor} thick />
          <span>Trajet dans la zone</span>
        </li>
        <li className="flex items-center gap-2">
          <LegendLine color={routeColor} dashed />
          <span>Trajet hors zone</span>
        </li>
        <li className="flex items-center gap-2">
          <LegendDot fill="#0ea5e9" stroke="#ffffff" size={10} />
          <span>Départ (zone)</span>
        </li>
        <li className="flex items-center gap-2">
          <LegendDot fill={routeColor} stroke="#111827" size={12} />
          <span>Position actuelle</span>
        </li>
        <li className="flex items-center gap-2">
          <LegendDot fill={routeColor} stroke="#111827" size={14} />
          <span>Utilisateur sélectionné</span>
        </li>
        <li className="flex items-center gap-2 pt-1">
          <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
            IN
          </span>
          <span className="text-zinc-500">Dans la zone</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
            OUT
          </span>
          <span className="text-zinc-500">Hors zone</span>
        </li>
      </ul>
    </div>
  );
}
