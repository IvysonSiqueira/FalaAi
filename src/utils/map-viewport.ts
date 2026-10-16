import type { Coordinates } from '../types';

// MapLibre utiliza [longitude, latitude], nesta ordem.
export type MapPosition = [longitude: number, latitude: number];
export type MapViewport =
  | { center: MapPosition; zoom: number }
  | { bounds: [west: number, south: number, east: number, north: number]; padding: { top: number; right: number; bottom: number; left: number } };

export function toMapPosition(coordinates: Coordinates): MapPosition {
  return [coordinates.longitude, coordinates.latitude];
}

export function getMapViewport(coordinates: Coordinates[]): MapViewport | null {
  const first = coordinates[0];
  if (!first) return null;

  let west = first.longitude;
  let east = first.longitude;
  let south = first.latitude;
  let north = first.latitude;
  for (const point of coordinates) {
    west = Math.min(west, point.longitude);
    east = Math.max(east, point.longitude);
    south = Math.min(south, point.latitude);
    north = Math.max(north, point.latitude);
  }

  // Pontos coincidentes também precisam de zoom definido, sem bounds vazios.
  if (west === east && south === north) return { center: toMapPosition(first), zoom: 14 };
  return { bounds: [west, south, east, north], padding: { top: 50, right: 50, bottom: 50, left: 50 } };
}
