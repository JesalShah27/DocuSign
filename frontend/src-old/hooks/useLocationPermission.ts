import React, { useState, useEffect } from 'react';
import { getCurrentLocation } from '../utils/location';

export function useLocationPermission() {
  const [locationStatus, setLocationStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = async () => {
    try {
      const loc = await getCurrentLocation();
      if (loc) {
        setLocation(loc);
        setLocationStatus('granted');
        setError(null);
      } else {
        setLocationStatus('denied');
        setError('Could not get location');
      }
    } catch (err) {
      setLocationStatus('denied');
      setError(err instanceof Error ? err.message : 'Failed to get location');
    }
  };

  useEffect(() => {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    // Check permission status
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((permissionStatus) => {
        setLocationStatus(permissionStatus.state as 'prompt' | 'granted' | 'denied');
        permissionStatus.onchange = () => {
          setLocationStatus(permissionStatus.state as 'prompt' | 'granted' | 'denied');
        };
      });
  }, []);

  return {
    locationStatus,
    location,
    error,
    requestLocation
  };
}