import { useState, useEffect } from 'react';

export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown';
}

export function useLocation(): LocationState {
  const [state, setState] = useState<LocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: true,
    permissionStatus: 'unknown'
  });

  useEffect(() => {
    async function checkAndRequestLocation() {
      try {
        // First check if geolocation is available
        if (!navigator.geolocation) {
          setState(prev => ({
            ...prev,
            error: 'Geolocation is not supported by your browser',
            loading: false
          }));
          return;
        }

        // Check permission status
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        setState(prev => ({
          ...prev,
          permissionStatus: permission.state as 'granted' | 'denied' | 'prompt'
        }));

        if (permission.state === 'denied') {
          setState(prev => ({
            ...prev,
            error: 'Location permission was denied',
            loading: false
          }));
          return;
        }

        // Get location
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setState(prev => ({
              ...prev,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              loading: false,
              error: null
            }));
          },
          (error) => {
            setState(prev => ({
              ...prev,
              error: error.message,
              loading: false
            }));
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          }
        );
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          loading: false
        }));
      }
    }

    checkAndRequestLocation();
  }, []);

  return state;
}