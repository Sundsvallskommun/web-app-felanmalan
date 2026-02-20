'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@sk-web-gui/react';
import LucideIcon from '@sk-web-gui/lucide-icon';
import { useTranslation } from 'react-i18next';
import { useWizardStore } from '@stores/wizard-store';

declare global {
  interface Window {
    Origo?: any;
  }
}

// Sundsvall centrum (Stora torget) in EPSG:3006
const SUNDSVALL_CENTER: [number, number] = [617144, 6921822];
const USER_ZOOM = 9;

const ORIGO_CONFIG = {
  projectionExtent: [487000, 6803000, 773720, 7376440],
  extent: [487000, 6803000, 773720, 7376440],
  center: SUNDSVALL_CENTER,
  resolutions: [280, 140, 70, 28, 14, 7, 4.2, 2.8, 1.4, 0.56, 0.28, 0.14, 0.112, 0.056],
  zoom: 5,
  projectionCode: 'EPSG:3006',
  proj4Defs: [
    {
      code: 'EPSG:3006',
      alias: 'urn:ogc:def:crs:EPSG::3006',
      projection: '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
    },
    {
      code: 'EPSG:3014',
      alias: 'urn:ogc:def:crs:EPSG::3014',
      projection:
        '+proj=tmerc +lat_0=0 +lon_0=17.25 +k=1 +x_0=150000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
    },
  ],
  layers: [
    {
      name: 'Lantmateriet:topowebbkartan_nedtonad',
      title: 'Karta, grå',
      format: 'image/png',
      queryable: false,
      visible: true,
      type: 'WMS',
      group: 'root',
      attribution:
        'Kartan har ingen rättsverkan och du kan alltså INTE se exakta gränser i denna karttjänst &copy Lantmäteriet Geodatasamverkan',
      source: 'sundsvall-wms',
      tiled: true,
    },
  ],
  source: {
    'sundsvall-wms': {
      url: 'https://karta.sundsvall.se/geoserver/wms',
      version: '1.1.1',
      service: 'WMS',
    },
  },
  controls: [],
};

/** Check if coordinate is within the map extent */
const isWithinExtent = (coord: [number, number]) => {
  const [minX, minY, maxX, maxY] = ORIGO_CONFIG.extent;
  return coord[0] >= minX && coord[0] <= maxX && coord[1] >= minY && coord[1] <= maxY;
};

const ORIGO_CSS = 'https://karta.sundsvall.se/origo2client/css/style.css';
const ORIGO_JS = 'https://karta.sundsvall.se/origo2client/dist/origo.min.js';

export const OrigoMap = () => {
  const { t } = useTranslation('report');
  const setMapLocation = useWizardStore((s) => s.setMapLocation);
  const mapLocation = useWizardStore((s) => s.mapLocation);

  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const mapRef = useRef<any>(null);
  const userPosRef = useRef<[number, number] | null>(null);
  const markerLayerRef = useRef<any>(null);
  const userDotLayerRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [hasUserPos, setHasUserPos] = useState(false);
  const saveLocation = useCallback((coord: [number, number]) => {
    // EPSG:3006: coord is [easting, northing] i.e. [x, y]
    setMapLocation({ x: coord[0], y: coord[1] });
  }, [setMapLocation]);

  const placeMarker = useCallback((coord: [number, number]) => {
    const map = mapRef.current;
    if (!map || !window.Origo || !isWithinExtent(coord)) return;

    const ol = window.Origo.ol;

    if (markerLayerRef.current) {
      map.removeLayer(markerLayerRef.current);
    }

    const feature = new ol.Feature({
      geometry: new ol.geom.Point(coord),
    });

    feature.setStyle(
      new ol.style.Style({
        image: new ol.style.Circle({
          radius: 10,
          fill: new ol.style.Fill({ color: '#e74c3c' }),
          stroke: new ol.style.Stroke({ color: '#ffffff', width: 2.5 }),
        }),
      })
    );

    const layer = new ol.layer.Vector({
      source: new ol.source.Vector({ features: [feature] }),
    });

    map.addLayer(layer);
    markerLayerRef.current = layer;
    saveLocation(coord);
  }, [saveLocation]);

  const handleUseMyPosition = useCallback(() => {
    const pos = userPosRef.current;
    if (!pos || !mapRef.current) return;

    placeMarker(pos);
    mapRef.current.getView().animate({ center: pos, zoom: USER_ZOOM });
  }, [placeMarker]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const loadScript = (src: string): Promise<void> =>
      new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = 'anonymous';
        script.onload = () => resolve();
        script.onerror = reject;
        document.head.appendChild(script);
      });

    const loadCSS = (href: string) => {
      if (document.querySelector(`link[href="${href}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    };

    const addUserPositionDot = (map: any, coord: [number, number]) => {
      const ol = window.Origo.ol;

      if (userDotLayerRef.current) {
        map.removeLayer(userDotLayerRef.current);
      }

      const feature = new ol.Feature({
        geometry: new ol.geom.Point(coord),
      });

      feature.setStyle(
        new ol.style.Style({
          image: new ol.style.Circle({
            radius: 7,
            fill: new ol.style.Fill({ color: '#005595' }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 }),
          }),
        })
      );

      const layer = new ol.layer.Vector({
        source: new ol.source.Vector({ features: [feature] }),
      });

      map.addLayer(layer);
      userDotLayerRef.current = layer;
    };

    const init = async () => {
      try {
        loadCSS(ORIGO_CSS);
        await loadScript(ORIGO_JS);

        if (!window.Origo || !containerRef.current) return;

        const origo = window.Origo(
          { ...ORIGO_CONFIG, target: `#${containerRef.current.id}` },
          { svgSpritePath: 'https://karta.sundsvall.se/origo2client/css/svg/' }
        );

        origo.on('load', (viewer: any) => {
          const map = viewer.getMap();
          mapRef.current = map;

          const ol = window.Origo.ol;

          // Remove all OL controls except zoom (+/-)
          map.getControls().getArray().slice().forEach((ctrl: any) => {
            const el = ctrl.element as HTMLElement | undefined;
            if (el?.classList?.contains('ol-zoom')) return;
            map.removeControl(ctrl);
          });

          // Remove Origo's fullscreen button
          containerRef.current?.querySelector('.o-fullscreen')?.remove();

          // Use OpenLayers Geolocation to get position in map projection
          const geolocation = new ol.Geolocation({
            tracking: true,
            projection: map.getView().getProjection(),
          });

          geolocation.on('change:position', () => {
            const pos = geolocation.getPosition();
            if (!pos) return;

            const coord: [number, number] = [pos[0], pos[1]];

            if (isWithinExtent(coord)) {
              // Position is within map bounds - show dot and center
              userPosRef.current = coord;
              setHasUserPos(true);
              addUserPositionDot(map, coord);
              map.getView().animate({ center: coord, zoom: USER_ZOOM });
            }
            // Otherwise keep default center (Sundsvall centrum)

            geolocation.setTracking(false);
          });

          geolocation.on('error', () => {
            // Geolocation denied or unavailable - keep default center
          });

          // Click on map to place report marker
          map.on('click', (e: any) => {
            placeMarker(e.coordinate);
          });
        });
      } catch (err) {
        console.error('Failed to load Origo map:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [placeMarker]);

  return (
    <div className="flex flex-col gap-12">
      <p className="text-small text-dark-secondary">{t('map_click_hint')}</p>

      <div className="relative w-full overflow-hidden rounded-lg h-[50rem]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background-200">
            <p className="text-dark-secondary">Laddar karta...</p>
          </div>
        )}
        <div
          ref={containerRef}
          id="origo-map"
          className="h-full w-full"
        />
      </div>

      <div className="flex items-center gap-12">
        {hasUserPos && (
          <Button
            variant="tertiary"
            size="sm"
            onClick={handleUseMyPosition}
            leftIcon={<LucideIcon name="locate" size={16} />}
          >
            {t('map_use_my_position')}
          </Button>
        )}

      </div>
    </div>
  );
};
