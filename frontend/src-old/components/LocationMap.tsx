import React from 'react';
import { Map, Marker } from 'pigeon-maps';

interface LocationMapProps {
  latitude: number;
  longitude: number;
  cityName?: string;
  width?: number;
  height?: number;
}

export const LocationMap: React.FC<LocationMapProps> = ({
  latitude,
  longitude,
  cityName,
  width = 400,
  height = 300,
}) => {
  return (
    <div className="relative rounded-lg overflow-hidden shadow-md">
      <Map
        center={[latitude, longitude]}
        zoom={12}
        width={width}
        height={height}
      >
        <Marker
          width={50}
          anchor={[latitude, longitude]}
          color="#1E88E5"
          onClick={() => {}}
        />
      </Map>
      {cityName && (
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 text-center">
          {cityName}
        </div>
      )}
    </div>
  );
};