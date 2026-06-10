export type Coordinate = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceInMeters(from: Coordinate, to: Coordinate) {
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLongitude / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function totalDistanceInMeters(points: Coordinate[]) {
  return points.reduce((total, point, index) => {
    const previous = points[index - 1];
    return previous ? total + distanceInMeters(previous, point) : total;
  }, 0);
}

const KM_PER_DEGREE_LAT = 111.32;

export function offsetFromCenter(
  latitude: number,
  longitude: number,
  bearingDegrees: number,
  distanceMeters: number,
): Coordinate {
  const bearing = (bearingDegrees * Math.PI) / 180;
  const distanceKm = distanceMeters / 1000;
  const deltaLat = (distanceKm / KM_PER_DEGREE_LAT) * Math.cos(bearing);
  const deltaLng =
    (distanceKm / (KM_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180))) *
    Math.sin(bearing);

  return {
    latitude: latitude + deltaLat,
    longitude: longitude + deltaLng,
  };
}

export function distanceFromCenter(
  center: Coordinate,
  point: Coordinate,
) {
  return distanceInMeters(center, point);
}
