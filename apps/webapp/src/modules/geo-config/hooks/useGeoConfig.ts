import { useContext } from 'react';
import { GeoConfigContext } from '../context/GeoConfigContext';
import { GeoConfigContextValue } from '../types';

export function useGeoConfig(): GeoConfigContextValue {
  const context = useContext(GeoConfigContext);
  if (!context) {
    throw new Error('useGeoConfig must be used within a GeoConfigProvider');
  }
  return context;
}
