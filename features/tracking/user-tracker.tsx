"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/http";
import { distanceInMeters } from "@/utils/geo";
import type { CurrentUser } from "@/types/domain";

const SEND_INTERVAL_MS = 5_000;
const MIN_MOVE_METERS = 2;

type TrackingState = "idle" | "requesting" | "active" | "error";

export function UserTracker() {
  const { data: user, isLoading: authLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api<CurrentUser>("/api/auth/me"),
    retry: 1,
  });

  const [state, setState] = useState<TrackingState>("idle");
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const [position, setPosition] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastSentTimeRef = useRef(0);
  const sendingRef = useRef(false);
  const latestCoordsRef = useRef<GeolocationCoordinates | null>(null);
  const lastSentCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const userRef = useRef<CurrentUser | null>(null);

  useEffect(() => {
    userRef.current = user ?? null;
  }, [user]);

  const sendPosition = useCallback(async (coords: GeolocationCoordinates, force = false) => {
    const currentUser = userRef.current;
    if (!currentUser || sendingRef.current) {
      return;
    }

    const now = Date.now();
    const movedMeters = lastSentCoordsRef.current
      ? distanceInMeters(lastSentCoordsRef.current, {
          latitude: coords.latitude,
          longitude: coords.longitude,
        })
      : Number.POSITIVE_INFINITY;
    const intervalElapsed = now - lastSentTimeRef.current >= SEND_INTERVAL_MS;
    const movedEnough = movedMeters >= MIN_MOVE_METERS;

    if (!force && !intervalElapsed && !movedEnough) {
      return;
    }

    sendingRef.current = true;

    try {
      await api("/api/locations", {
        method: "POST",
        body: JSON.stringify({
          userId: currentUser.id,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          speed: Number.isFinite(coords.speed) ? coords.speed : undefined,
          altitude: Number.isFinite(coords.altitude) ? coords.altitude : undefined,
          heading: Number.isFinite(coords.heading) ? coords.heading : undefined,
          source: "WEB",
          recordedAt: new Date().toISOString(),
        }),
      });
      lastSentTimeRef.current = now;
      lastSentCoordsRef.current = {
        latitude: coords.latitude,
        longitude: coords.longitude,
      };
      setLastSentAt(new Date());
      setSendError(null);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Envoi de position impossible");
    } finally {
      sendingRef.current = false;
    }
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState("idle");
  }, []);

  const startTracking = useCallback(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setState("error");
      setGpsError("Session expirée. Reconnectez-vous pour envoyer votre position.");
      return;
    }

    if (!navigator.geolocation) {
      setState("error");
      setGpsError("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }

    setState("requesting");
    setGpsError(null);
    setSendError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (nextPosition) => {
        setState("active");
        latestCoordsRef.current = nextPosition.coords;
        setPosition({
          latitude: nextPosition.coords.latitude,
          longitude: nextPosition.coords.longitude,
          accuracy: nextPosition.coords.accuracy,
        });
        void sendPosition(nextPosition.coords);
      },
      (geoError) => {
        setState("error");
        setGpsError(geoError.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 30_000,
      },
    );
  }, [authLoading, sendPosition, user]);

  useEffect(() => () => stopTracking(), [stopTracking]);

  useEffect(() => {
    if (state !== "active") {
      return;
    }

    const timer = window.setInterval(() => {
      if (latestCoordsRef.current) {
        void sendPosition(latestCoordsRef.current);
      }
    }, SEND_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [sendPosition, state]);

  useEffect(() => {
    if (state === "active" && latestCoordsRef.current) {
      void sendPosition(latestCoordsRef.current, true);
    }
  }, [sendPosition, state, user]);

  const statusLabel =
    state === "active"
      ? sendError
        ? "Suivi actif (envoi en erreur)"
        : "Suivi actif"
      : state === "requesting"
        ? "Demande d'accès GPS..."
        : state === "error"
          ? "Erreur GPS"
          : authLoading
            ? "Chargement session..."
            : "Inactif";

  const statusClassName =
    state === "active"
      ? sendError
        ? "bg-amber-100 text-amber-800"
        : "bg-emerald-100 text-emerald-800"
      : state === "error"
        ? "bg-red-100 text-red-700"
        : "bg-zinc-100 text-zinc-700";

  return (
    <Card className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Mon suivi GPS</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Activez le suivi pour envoyer votre position en temps réel aux managers.
          </p>
        </div>
        <Badge className={statusClassName}>{statusLabel}</Badge>
      </div>

      {user ? (
        <p className="text-sm text-zinc-600">
          Connecté en tant que <span className="font-medium">{user.email}</span>
        </p>
      ) : authLoading ? (
        <p className="text-sm text-zinc-500">Vérification de la session...</p>
      ) : (
        <p className="text-sm text-red-600">Session non disponible. Reconnectez-vous.</p>
      )}

      {position ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
          <p>
            Position : {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
          </p>
          <p className="mt-1 text-zinc-500">Précision : ±{Math.round(position.accuracy)} m</p>
        </div>
      ) : null}

      {lastSentAt ? (
        <p className="text-sm text-zinc-500">
          Dernier envoi : {lastSentAt.toLocaleTimeString("fr-FR")}
        </p>
      ) : null}

      {gpsError ? <p className="text-sm text-red-600">{gpsError}</p> : null}
      {sendError ? <p className="text-sm text-amber-700">{sendError}</p> : null}

      <div className="flex flex-wrap gap-3">
        {state === "idle" || state === "error" ? (
          <Button onClick={startTracking} disabled={authLoading}>
            Démarrer le suivi
          </Button>
        ) : (
          <Button variant="secondary" onClick={stopTracking}>
            Arrêter le suivi
          </Button>
        )}
      </div>

      <p className="text-xs text-zinc-500">
        Envoi automatique toutes les 5 secondes ou dès 2 m de déplacement.
        Gardez cet onglet ouvert et autorisez la géolocalisation du navigateur.
      </p>
    </Card>
  );
}
