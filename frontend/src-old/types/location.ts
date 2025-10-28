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