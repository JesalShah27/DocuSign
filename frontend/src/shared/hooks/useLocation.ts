/**
 * useLocation hook for the DocUsign application
 * 
 * Provides location state and functions for getting user location.
 */

import { useState, useEffect } from 'react';
import { LocationState } from '../types/location';
import { getCurrentLocation, checkLocationPermission } from '../utils/location';

export function useLocation(): LocationState {
  const [state, setState] = useState<LocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    async function initializeLocation() {
      try {
        // Check if geolocation is available
        if (!navigator.geolocation) {
          setState(prev => ({
            ...prev,
            error: 'Geolocation is not supported by your browser',
            loading: false
          }));
          return;
        }

        // Check permission status first
        const permissionState = await checkLocationPermission();
        
        if (permissionState === 'denied') {
          setState(prev => ({
            ...prev,
            error: 'Location permission was denied. Please enable location access in your browser settings.',
            loading: false
          }));
          return;
        }

        // Try to get location
        const location = await getCurrentLocation();
        
        if (location) {
          setState({
            latitude: location.latitude,
            longitude: location.longitude,
            error: null,
            loading: false
          });
        } else {
          setState(prev => ({
            ...prev,
            error: 'Could not retrieve your location. Please ensure location services are enabled.',
            loading: false
          }));
        }
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'An unknown error occurred while getting location',
          loading: false
        }));
      }
    }

    initializeLocation();
  }, []);

  return state;
}