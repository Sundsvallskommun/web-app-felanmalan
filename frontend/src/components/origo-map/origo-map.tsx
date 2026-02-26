'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@sk-web-gui/react';
import LucideIcon from '@sk-web-gui/lucide-icon';
import { useTranslation } from 'react-i18next';
import { useWizardStore } from '@stores/wizard-store';
import { fetchActiveErrands } from '@services/errand-service';
import { ErrandMarker } from '@interfaces/errand-marker.types';

declare global {
  interface Window {
    Origo?: any;
  }
}

// Sundsvall centrum (Stora torget) in EPSG:3006
const SUNDSVALL_CENTER: [number, number] = [617144, 6921822];
const USER_ZOOM = 9;
const DUPLICATE_RADIUS_METERS = 20;

// Sundsvall kommun bounding box in EPSG:3006
const MUNICIPALITY_EXTENT = [565031, 6887804, 667486, 6981257];

const ORIGO_CONFIG = {
  projectionExtent: [487000, 6803000, 773720, 7376440],
  extent: MUNICIPALITY_EXTENT,
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

/** Bounding-box fallback check */
const isWithinExtent = (coord: [number, number]) => {
  const [minX, minY, maxX, maxY] = MUNICIPALITY_EXTENT;
  return coord[0] >= minX && coord[0] <= maxX && coord[1] >= minY && coord[1] <= maxY;
};

/** Euclidean distance in meters (EPSG:3006 is metric) */
const distanceMeters = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const findNearbyErrand = (
  coord: [number, number],
  errands: ErrandMarker[],
): ErrandMarker | null => {
  const point = { x: coord[0], y: coord[1] };
  let closest: ErrandMarker | null = null;
  let closestDist = Infinity;

  for (const errand of errands) {
    const dist = distanceMeters(point, errand.coordinates);
    if (dist < DUPLICATE_RADIUS_METERS && dist < closestDist) {
      closest = errand;
      closestDist = dist;
    }
  }

  return closest;
};

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('sv-SE');
  } catch {
    return dateStr;
  }
};

const MUNICIPALITY_WFS_URL =
  'https://karta.sundsvall.se/geoserver/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=SundsvallsKommun:SundsvallsKommun_yta&outputFormat=application/json&srsName=EPSG:3006';

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
  const errandLayerRef = useRef<any>(null);
  const popupOverlayRef = useRef<any>(null);
  const popupContainerRef = useRef<HTMLDivElement>(null);
  const municipalityGeomRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [hasUserPos, setHasUserPos] = useState(false);
  const [showErrands, setShowErrands] = useState(false);
  const [errands, setErrands] = useState<ErrandMarker[] | null>(null);
  const [errandsLoading, setErrandsLoading] = useState(false);
  const [selectedErrand, setSelectedErrand] = useState<ErrandMarker | null>(null);
  const [isDuplicateWarning, setIsDuplicateWarning] = useState(false);
  const [outsideError, setOutsideError] = useState(false);

  // Keep refs in sync for use in map click handlers
  const showErrandsRef = useRef(showErrands);
  showErrandsRef.current = showErrands;
  const errandsRef = useRef(errands);
  errandsRef.current = errands;

  /** Check if coordinate is within municipality polygon (falls back to bounding box) */
  const isWithinMunicipality = useCallback((coord: [number, number]) => {
    if (municipalityGeomRef.current) {
      return municipalityGeomRef.current.intersectsCoordinate(coord);
    }
    return isWithinExtent(coord);
  }, []);

  const saveLocation = useCallback((coord: [number, number]) => {
    setMapLocation({ x: coord[0], y: coord[1] });
  }, [setMapLocation]);

  const showPopup = useCallback((errand: ErrandMarker, isDuplicate: boolean) => {
    setSelectedErrand(errand);
    setIsDuplicateWarning(isDuplicate);

    const overlay = popupOverlayRef.current;
    if (overlay) {
      overlay.setPosition([errand.coordinates.x, errand.coordinates.y]);
    }
  }, []);

  const hidePopup = useCallback(() => {
    setSelectedErrand(null);
    setIsDuplicateWarning(false);
    const overlay = popupOverlayRef.current;
    if (overlay) {
      overlay.setPosition(undefined);
    }
  }, []);

  const placeMarker = useCallback((coord: [number, number]) => {
    const map = mapRef.current;
    if (!map || !window.Origo || !isWithinMunicipality(coord)) return;

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
  }, [saveLocation, isWithinMunicipality]);

  const handleMapClick = useCallback((coord: [number, number]) => {
    if (!isWithinMunicipality(coord)) {
      setOutsideError(true);
      return;
    }

    setOutsideError(false);

    // Check for duplicate if errands are visible
    if (showErrandsRef.current && errandsRef.current) {
      const nearby = findNearbyErrand(coord, errandsRef.current);
      if (nearby) {
        showPopup(nearby, true);
        return;
      }
    }

    hidePopup();
    placeMarker(coord);
  }, [placeMarker, showPopup, hidePopup, isWithinMunicipality]);

  const handleUseMyPosition = useCallback(() => {
    const pos = userPosRef.current;
    if (!pos || !mapRef.current) return;

    if (!isWithinMunicipality(pos)) {
      setOutsideError(true);
      return;
    }

    setOutsideError(false);

    // Check for duplicate if errands are visible
    if (showErrandsRef.current && errandsRef.current) {
      const nearby = findNearbyErrand(pos, errandsRef.current);
      if (nearby) {
        showPopup(nearby, true);
        mapRef.current.getView().animate({ center: pos, zoom: USER_ZOOM });
        return;
      }
    }

    hidePopup();
    placeMarker(pos);
    mapRef.current.getView().animate({ center: pos, zoom: USER_ZOOM });
  }, [placeMarker, showPopup, hidePopup, isWithinMunicipality]);

  // Toggle errands layer
  const handleToggleErrands = useCallback(async () => {
    if (!showErrands) {
      // Turning on
      if (!errands) {
        setErrandsLoading(true);
        try {
          const data = await fetchActiveErrands();
          setErrands(data);
        } catch (err) {
          console.error('Failed to fetch errands:', err);
          setErrandsLoading(false);
          return;
        }
        setErrandsLoading(false);
      }
      setShowErrands(true);
    } else {
      // Turning off
      setShowErrands(false);
      hidePopup();
    }
  }, [showErrands, errands, hidePopup]);

  // Add/remove errand markers layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.Origo) return;

    const ol = window.Origo.ol;

    // Remove existing errand layer
    if (errandLayerRef.current) {
      map.removeLayer(errandLayerRef.current);
      errandLayerRef.current = null;
    }

    if (!showErrands || !errands || errands.length === 0) return;

    const features = errands.map((errand) => {
      const feature = new ol.Feature({
        geometry: new ol.geom.Point([errand.coordinates.x, errand.coordinates.y]),
      });

      feature.set('errandData', errand);

      feature.setStyle(
        new ol.style.Style({
          image: new ol.style.RegularShape({
            points: 3,
            radius: 12,
            fill: new ol.style.Fill({ color: '#f59e0b' }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 }),
            rotation: 0,
          }),
        })
      );

      return feature;
    });

    const layer = new ol.layer.Vector({
      source: new ol.source.Vector({ features }),
    });

    map.addLayer(layer);
    errandLayerRef.current = layer;
  }, [showErrands, errands]);

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

          // Add municipality mask layer (dims area outside Sundsvall)
          fetch(MUNICIPALITY_WFS_URL)
            .then(res => res.json())
            .then(geojson => {
              // Collect rings (flat) for the mask and full polygons for validation
              const municipalityCoords: number[][][] = [];
              const polygonCoords: number[][][][] = [];

              for (const feature of geojson.features) {
                const geom = feature.geometry;
                if (geom.type === 'Polygon') {
                  municipalityCoords.push(...geom.coordinates);
                  polygonCoords.push(geom.coordinates);
                } else if (geom.type === 'MultiPolygon') {
                  for (const poly of geom.coordinates) {
                    municipalityCoords.push(...poly);
                    polygonCoords.push(poly);
                  }
                }
              }

              // Save municipality geometry for point-in-polygon validation
              municipalityGeomRef.current = new ol.geom.MultiPolygon(polygonCoords);

              // Large outer box covering the full projection extent
              const [minX, minY, maxX, maxY] = ORIGO_CONFIG.projectionExtent;
              const outerRing = [
                [minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY],
              ];

              // Inverted polygon: outer box with municipality as holes
              const maskPolygon = new ol.geom.Polygon([outerRing, ...municipalityCoords]);
              const maskFeature = new ol.Feature({ geometry: maskPolygon });

              maskFeature.setStyle(
                new ol.style.Style({
                  fill: new ol.style.Fill({ color: 'rgba(150, 150, 150, 0.55)' }),
                })
              );

              const maskLayer = new ol.layer.Vector({
                source: new ol.source.Vector({ features: [maskFeature] }),
                zIndex: 1,
              });

              map.addLayer(maskLayer);

              // Add municipality border line layer
              const borderFeature = new ol.Feature({
                geometry: new ol.geom.MultiPolygon(polygonCoords),
              });

              borderFeature.setStyle(
                new ol.style.Style({
                  stroke: new ol.style.Stroke({ color: '#005595', width: 2 }),
                  fill: undefined,
                })
              );

              const borderLayer = new ol.layer.Vector({
                source: new ol.source.Vector({ features: [borderFeature] }),
                zIndex: 2,
              });

              map.addLayer(borderLayer);
            })
            .catch(() => {
              // Mask is non-critical, fail silently
            });

          // Initialize popup overlay
          if (popupContainerRef.current) {
            const overlay = new ol.Overlay({
              element: popupContainerRef.current,
              positioning: 'bottom-center',
              offset: [0, -16],
              stopEvent: true,
            });
            map.addOverlay(overlay);
            popupOverlayRef.current = overlay;
          }

          // Use OpenLayers Geolocation to get position in map projection
          const geolocation = new ol.Geolocation({
            tracking: true,
            projection: map.getView().getProjection(),
          });

          geolocation.on('change:position', () => {
            const pos = geolocation.getPosition();
            if (!pos) return;

            const coord: [number, number] = [pos[0], pos[1]];

            if (isWithinMunicipality(coord)) {
              userPosRef.current = coord;
              setHasUserPos(true);
              addUserPositionDot(map, coord);
              map.getView().animate({ center: coord, zoom: USER_ZOOM });
            }

            geolocation.setTracking(false);
          });

          geolocation.on('error', () => {
            // Geolocation denied or unavailable - keep default center
          });

          // Click on map
          map.on('click', (e: any) => {
            // Check if an errand marker was clicked
            let clickedErrand: ErrandMarker | null = null;

            map.forEachFeatureAtPixel(e.pixel, (feature: any) => {
              const data = feature.get('errandData');
              if (data) {
                clickedErrand = data as ErrandMarker;
              }
            });

            if (clickedErrand) {
              showPopup(clickedErrand, false);
              return;
            }

            handleMapClick(e.coordinate);
          });
        });
      } catch (err) {
        console.error('Failed to load Origo map:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [placeMarker, handleMapClick, showPopup, isWithinMunicipality]);

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

        {/* Popup overlay element — positioned by OpenLayers */}
        <div ref={popupContainerRef} className="errand-popup" style={{ display: selectedErrand ? 'block' : 'none' }}>
          {selectedErrand && (
            <div className="errand-popup-content">
              <button
                className="errand-popup-close"
                onClick={hidePopup}
                aria-label={t('close')}
              >
                &times;
              </button>

              <p className="errand-popup-title">
                {selectedErrand.title || selectedErrand.errandNumber || t('errand_untitled')}
              </p>

              {selectedErrand.description && (
                <p className="errand-popup-description">{selectedErrand.description}</p>
              )}

              <div className="errand-popup-meta">
                <span className={`errand-status-badge${selectedErrand.status === 'ONGOING' ? ' errand-status-badge--ongoing' : ''}`}>
                  {selectedErrand.status}
                </span>
                <span>{formatDate(selectedErrand.created)}</span>
              </div>

              {isDuplicateWarning && (
                <div className="errand-popup-warning">
                  {t('nearby_errand_warning')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div aria-live="polite">
        {outsideError && (
          <div role="alert" className="flex items-center gap-8 rounded-lg border border-error bg-error-background-200 text-error dark:bg-error-background-300 px-12 py-8 text-small">
            <LucideIcon name="triangle-alert" size={16} />
            <p>{t('error_outside_municipality')}</p>
          </div>
        )}
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

        <Button
          variant="tertiary"
          size="sm"
          onClick={handleToggleErrands}
          disabled={errandsLoading}
          leftIcon={<LucideIcon name="layers" size={16} />}
        >
          {errandsLoading ? '...' : t(showErrands ? 'map_hide_errands' : 'map_show_errands')}
        </Button>
      </div>
    </div>
  );
};
