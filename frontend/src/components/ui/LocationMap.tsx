/**
 * LocationMap component for the DocUsign application
 * 
 * Displays a map with a marker at the specified coordinates.
 */

import React from 'react';
import { Map, Marker } from 'pigeon-maps';
import { formatCoordinates } from '../../shared/utils/location';

interface LocationMapProps {
  latitude: number;
  longitude: number;
  cityName?: string;
  width?: number;
  height?: number;
  showCoordinates?: boolean;
  className?: string;
}

export const LocationMap: React.FC<LocationMapProps> = ({
  latitude,
  longitude,
  cityName,
  width = 400,
  height = 300,
  showCoordinates = false,
  className = '',
}) => {
  return (
    <div className={`relative rounded-lg overflow-hidden shadow-md ${className}`}>
      <Map
        center={[latitude, longitude]}
        zoom={12}
        width={width}
        height={height}
        dprs={[1, 2]} // Support high-DPI displays
      >
        <Marker
          width={50}
          anchor={[latitude, longitude]}
          color="#1E88E5"
          onClick={() => {
            // Optional: Handle marker click
          }}
        />
      </Map>
      
      {/* Location info overlay */}
      {(cityName || showCoordinates) && (
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-3">
          {cityName && (
            <div className="text-center font-medium">
              {cityName}
            </div>
          )}
          {showCoordinates && (
            <div className="text-center text-sm opacity-90">
              {formatCoordinates(latitude, longitude)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationMap;