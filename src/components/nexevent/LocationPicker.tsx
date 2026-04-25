'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Crosshair, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

// VVCE College approximate location (Mysuru, Karnataka)
const DEFAULT_CENTER: [number, number] = [12.3376, 76.6549];
const DEFAULT_ZOOM = 15;

interface LocationPickerProps {
  latitude: string;
  longitude: string;
  radius: string;
  onLocationChange: (lat: string, lng: string) => void;
  onRadiusChange: (radius: string) => void;
}

export function LocationPicker({ latitude, longitude, radius, onLocationChange, onRadiusChange }: LocationPickerProps) {
  const [showMap, setShowMap] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);

  const hasLocation = latitude && longitude;
  const lat = latitude ? parseFloat(latitude) : DEFAULT_CENTER[0];
  const lng = longitude ? parseFloat(longitude) : DEFAULT_CENTER[1];
  const radiusM = radius ? parseFloat(radius) : 200;

  // Load leaflet dynamically
  useEffect(() => {
    if (!showMap) return;

    let cancelled = false;

    const loadMap = async () => {
      try {
        const L = (await import('leaflet')).default;

        if (cancelled) return;

        // Add CSS if not already present
        if (!document.querySelector('link[rel="stylesheet"][href*="leaflet"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }

        // Wait a tick for CSS to load
        await new Promise(r => setTimeout(r, 100));
        if (cancelled || !mapContainerRef.current) return;

        // Fix default icon paths
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        // Create map
        const map = L.map(mapContainerRef.current, {
          center: [lat, lng],
          zoom: DEFAULT_ZOOM,
          zoomControl: true,
          scrollWheelZoom: true,
        });

        // Add tile layer (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        // Add marker
        const marker = L.marker([lat, lng], {
          draggable: true,
        }).addTo(map);

        // Add geo-fence circle
        const circle = L.circle([lat, lng], {
          radius: radiusM,
          color: '#6366f1',
          fillColor: '#6366f1',
          fillOpacity: 0.15,
          weight: 2,
          dashArray: '6 4',
        }).addTo(map);

        // Handle marker drag
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          circle.setLatLng(pos);
          onLocationChange(pos.lat.toFixed(6), pos.lng.toFixed(6));
        });

        // Handle map click to move marker
        map.on('click', (e: any) => {
          marker.setLatLng(e.latlng);
          circle.setLatLng(e.latlng);
          onLocationChange(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6));
        });

        // If location already set, fit to that
        if (hasLocation) {
          map.setView([lat, lng], DEFAULT_ZOOM);
        }

        mapInstanceRef.current = map;
        markerRef.current = marker;
        circleRef.current = circle;
        setMapReady(true);

        // Force a resize after mount
        setTimeout(() => {
          map.invalidateSize();
        }, 200);
      } catch (err) {
        console.error('Failed to load map:', err);
        toast.error('Failed to load map. Using manual input.');
      }
    };

    loadMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [showMap]);

  // Update circle radius when radius input changes
  useEffect(() => {
    if (circleRef.current && radiusM > 0) {
      circleRef.current.setRadius(radiusM);
    }
  }, [radiusM]);

  // Update marker and circle position when lat/lng change externally
  useEffect(() => {
    if (markerRef.current && circleRef.current && latitude && longitude) {
      const pos = [parseFloat(latitude), parseFloat(longitude)];
      markerRef.current.setLatLng(pos);
      circleRef.current.setLatLng(pos);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView(pos, DEFAULT_ZOOM);
      }
    }
  }, [latitude, longitude]);

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: myLat, longitude: myLng } = position.coords;
        onLocationChange(myLat.toFixed(6), myLng.toFixed(6));
        toast.success('Location detected!');
      },
      (error) => {
        toast.error('Could not detect your location. Please pick on the map.');
        console.error('Geolocation error:', error);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [onLocationChange]);

  const handleSetToVVCE = useCallback(() => {
    onLocationChange(DEFAULT_CENTER[0].toFixed(6), DEFAULT_CENTER[1].toFixed(6));
    toast.success('Location set to VVCE Campus');
  }, [onLocationChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          Geo-fence Location
        </Label>
        <div className="flex items-center gap-2">
          {hasLocation && (
            <Badge variant="outline" className="text-[9px] h-5 border-emerald-300 text-emerald-600 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/30">
              <Check className="w-2.5 h-2.5 mr-0.5" /> Set
            </Badge>
          )}
          <Button
            type="button"
            variant={showMap ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowMap(!showMap)}
          >
            <MapPin className="w-3 h-3 mr-1" />
            {showMap ? 'Hide Map' : 'Pick on Map'}
          </Button>
        </div>
      </div>

      {/* Map container */}
      {showMap && (
        <Card className="overflow-hidden border-2 border-primary/20">
          <div
            ref={mapContainerRef}
            className="w-full h-[320px] sm:h-[380px] bg-muted/30"
            style={{ zIndex: 0 }}
          />
          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="text-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Loading map...</p>
              </div>
            </div>
          )}
          {/* Map controls overlay */}
          <div className="flex items-center gap-2 p-2 bg-muted/30 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              onClick={handleUseMyLocation}
            >
              <Navigation className="w-3 h-3 mr-1" /> My Location
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              onClick={handleSetToVVCE}
            >
              <Crosshair className="w-3 h-3 mr-1" /> VVCE Campus
            </Button>
            <span className="text-[9px] text-muted-foreground ml-auto">
              Click map or drag marker to set location
            </span>
          </div>
        </Card>
      )}

      {/* Coordinate inputs + radius */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Latitude</Label>
          <Input
            type="number"
            step="any"
            placeholder="12.3376"
            value={latitude}
            onChange={(e) => onLocationChange(e.target.value, longitude)}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Longitude</Label>
          <Input
            type="number"
            step="any"
            placeholder="76.6549"
            value={longitude}
            onChange={(e) => onLocationChange(latitude, e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Radius (m)</Label>
          <Input
            type="number"
            placeholder="200"
            value={radius}
            onChange={(e) => onRadiusChange(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {hasLocation && (
        <p className="text-[10px] text-muted-foreground">
          📍 {lat.toFixed(4)}°N, {lng.toFixed(4)}°E — Geo-fence radius: {radiusM}m
          {radiusM < 50 && ' (very tight — may be hard to check in)'}
          {radiusM > 1000 && ' (very wide — less location accuracy)'}
        </p>
      )}
    </div>
  );
}
