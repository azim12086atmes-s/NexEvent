'use client';

import React, { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface EventLocationMapProps {
  latitude: number;
  longitude: number;
  radius: number;
  venueName?: string;
}

export function EventLocationMap({ latitude, longitude, radius, venueName }: EventLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    const loadMap = async () => {
      try {
        const L = (await import('leaflet')).default;

        if (cancelled || !mapContainerRef.current) return;

        // Add CSS if not already present
        if (!document.querySelector('link[rel="stylesheet"][href*="leaflet"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }

        await new Promise(r => setTimeout(r, 100));
        if (cancelled || !mapContainerRef.current) return;

        // Fix default icon paths
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        const map = L.map(mapContainerRef.current, {
          center: [latitude, longitude],
          zoom: 16,
          zoomControl: true,
          scrollWheelZoom: false,
          dragging: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        // Venue marker
        const marker = L.marker([latitude, longitude]).addTo(map);
        if (venueName) {
          marker.bindPopup(`<strong>${venueName}</strong><br/>Geo-fence: ${radius}m`).openPopup();
        }

        // Geo-fence circle
        L.circle([latitude, longitude], {
          radius,
          color: '#6366f1',
          fillColor: '#6366f1',
          fillOpacity: 0.12,
          weight: 2,
          dashArray: '6 4',
        }).addTo(map);

        // Fit to circle bounds
        const circleBounds = L.latLng(latitude, longitude).toBounds(radius * 2.2);
        map.fitBounds(circleBounds);

        mapInstanceRef.current = map;

        setTimeout(() => map.invalidateSize(), 200);
      } catch (err) {
        console.error('Failed to load event map:', err);
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
  }, [latitude, longitude, radius, venueName]);

  return (
    <Card className="overflow-hidden">
      <div
        ref={mapContainerRef}
        className="w-full h-[240px] bg-muted/30 rounded-lg"
        style={{ zIndex: 0 }}
      />
    </Card>
  );
}
