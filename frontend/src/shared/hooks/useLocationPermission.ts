/**
 * useLocationPermission hook for the DocUsign application
 * 
 * Provides location permission management and request functionality.
 */

import { useState, useEffect, useCallback } from 'react';
import { LocationPermissionState } from '../types/location';
import { checkLocationPermission, requestLocationPermission } from '../utils/location';

export function useLocationPermission(): LocationPermissionState {
  const [state, setState] = useState<Omit<LocationPermissionState, 'requestPermission'>>({
    permission: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    async function initializePermission() {
      try {
        if (!navigator.geolocation) {
          setState({
            permission: null,
            loading: false,
            error: 'Geolocation is not supported by your browser'
          });
          return;
        }

        const permission = await checkLocationPermission();
        setState({
          permission,
          loading: false,
          error: null
        });
      } catch (error) {
        setState({
          permission: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to check location permission'
        });
      }
    }

    initializePermission();
  }, []);

  const requestPermission = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const permission = await requestLocationPermission();
      setState({
        permission,
        loading: false,
        error: permission === 'denied' ? 'Location permission was denied' : null
      });
    } catch (error) {
      setState({
        permission: 'denied',
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to request location permission'
      });
    }
  }, []);

  return {
    ...state,
    requestPermission
  };
}