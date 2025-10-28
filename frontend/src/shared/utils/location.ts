/**
 * Location utilities for the DocUsign application
 * 
 * Provides functions for getting user location, checking permissions,
 * and handling geolocation-related operations.
 */

import { LocationData, GeoLocation } from '../types/location';

/**
 * Get the user's current location using the Geolocation API
 */
export async function getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by this browser');
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve, 
        reject, 
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // Cache for 5 minutes
        }
      );
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };
  } catch (error) {
    console.error('Error getting location:', error);
    return null;
  }
}

/**
 * Check if geolocation permission is granted
 */
export async function checkLocationPermission(): Promise<PermissionState> {
  if (!navigator.permissions) {
    return 'prompt'; // Assume prompt if permissions API is not available
  }

  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    return permission.state;
  } catch (error) {
    console.error('Error checking location permission:', error);
    return 'prompt';
  }
}

/**
 * Request location permission from the user
 */
export async function requestLocationPermission(): Promise<PermissionState> {
  try {
    // Try to get location to trigger permission prompt
    await getCurrentLocation();
    return await checkLocationPermission();
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return 'denied';
  }
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = Math.abs(latitude);
  const lng = Math.abs(longitude);
  const latDir = latitude >= 0 ? 'N' : 'S';
  const lngDir = longitude >= 0 ? 'E' : 'W';
  
  return `${lat.toFixed(6)}°${latDir}, ${lng.toFixed(6)}°${lngDir}`;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get location info from IP (fallback when GPS is not available)
 */
export async function getLocationFromIP(): Promise<GeoLocation | null> {
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) {
      throw new Error('Failed to get location from IP');
    }
    
    const data = await response.json();
    
    return {
      country: data.country_name,
      countryCode: data.country_code,
      region: data.region_code,
      regionName: data.region,
      city: data.city,
      zip: data.postal,
      lat: data.latitude,
      lon: data.longitude,
      timezone: data.timezone
    };
  } catch (error) {
    console.error('Error getting location from IP:', error);
    return null;
  }
}