/**
 * Location-related types for the DocUsign application
 */

export interface GeoLocation {
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  geoLocation?: GeoLocation;
}

export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  loading: boolean;
  error: string | null;
}

export interface LocationPermissionState {
  permission: PermissionState | null;
  loading: boolean;
  error: string | null;
  requestPermission: () => Promise<void>;
}