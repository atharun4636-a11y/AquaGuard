import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  Compass,
  Droplets,
  Filter,
  Info,
  Layers,
  MapPin,
  Navigation,
  RotateCcw,
  Search,
  Waves,
  Wrench,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useAquaGuard } from '../context/AquaGuardContext';
import {
  DRAIN_GEO_POINTS,
  DrilldownLevel,
  findNearestWardId,
  GEO_DRILLDOWN_LEVELS,
  resolveIncidentGeoPoint,
  WARD_GEO_POINTS,
  WATERWAY_LANDMARKS,
} from '../data/vijayawadaGeo';
import {
  PublicCitizenIncidentView,
  sanitizeIncidentForCitizenMap,
} from '../utils/permissions';
import {
  DrainCondition,
  IncidentReport,
  RiskLevel,
  ScenarioType,
  UserRole,
} from '../types/aquaguard';
import { getScenarioModifiers } from '../utils/riskEngine';
import {
  getRiskHexColor,
  IncidentStatusBadge,
  RiskLabel,
  SectionHeader,
} from './UiPrimitives';

type BasemapMode = 'osm' | 'dark';

interface SearchEntry {
  id: string;
  label: string;
  sublabel: string;
  category: 'Region' | 'Locality' | 'Incident' | 'Drain' | 'Waterway';
  lat: number;
  lng: number;
  zoom: number;
  wardId?: string;
  incidentId?: string;
}

function buildPopupElement(fields: {
  badge: string;
  title: string;
  locality: string;
  riskCategory: RiskLevel;
  riskScore: number;
  rainfallMmHr: number;
  historicalCount: number;
  drainageCondition: string;
  reason: string;
}): HTMLElement {
  const root = document.createElement('div');
  root.className = 'min-w-[235px] max-w-[280px] space-y-2 text-xs leading-snug';

  const topRow = document.createElement('div');
  topRow.className = 'flex items-center justify-between gap-2';

  const badgeEl = document.createElement('span');
  badgeEl.className = 'font-mono text-[10px] font-semibold uppercase tracking-wide text-teal-400';
  badgeEl.textContent = fields.badge;

  const riskEl = document.createElement('span');
  riskEl.className = 'font-mono text-[11px] font-semibold';
  riskEl.style.color = getRiskHexColor(fields.riskCategory);
  riskEl.textContent = `${fields.riskCategory} (${fields.riskScore}/100)`;

  topRow.appendChild(badgeEl);
  topRow.appendChild(riskEl);
  root.appendChild(topRow);

  const titleEl = document.createElement('div');
  titleEl.className = 'text-sm font-semibold text-slate-50';
  titleEl.textContent = fields.title;
  root.appendChild(titleEl);

  const locEl = document.createElement('div');
  locEl.className = 'text-[11px] text-slate-400';
  locEl.textContent = fields.locality;
  root.appendChild(locEl);

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-2 gap-1.5 border-t border-slate-700/70 pt-2 text-[11px]';

  const addCell = (k: string, v: string) => {
    const cell = document.createElement('div');
    const kEl = document.createElement('div');
    kEl.className = 'text-slate-400';
    kEl.textContent = k;
    const vEl = document.createElement('div');
    vEl.className = 'font-mono font-medium text-slate-100';
    vEl.textContent = v;
    cell.appendChild(kEl);
    cell.appendChild(vEl);
    grid.appendChild(cell);
  };

  addCell('Rainfall Intensity', `${fields.rainfallMmHr} mm/hr`);
  addCell('Historical Logs', `${fields.historicalCount} events (Demo)`);
  addCell('Drainage Condition', fields.drainageCondition);
  addCell('Risk Score', `${fields.riskScore}/100`);

  root.appendChild(grid);

  const reasonWrap = document.createElement('div');
  reasonWrap.className = 'border-t border-slate-700/70 pt-2 text-[11px] text-slate-300';
  const reasonLabel = document.createElement('span');
  reasonLabel.className = 'font-semibold text-slate-200';
  reasonLabel.textContent = 'Reason: ';
  const reasonText = document.createElement('span');
  reasonText.textContent = fields.reason;
  reasonWrap.appendChild(reasonLabel);
  reasonWrap.appendChild(reasonText);
  root.appendChild(reasonWrap);

  return root;
}

function getDrainSummaryForWard(
  wardDrains: { condition: DrainCondition; blockedReported: boolean }[]
): string {
  if (wardDrains.length === 0) return 'No verified drain asset in demo data';
  const hasBlocked = wardDrains.some(
    (d) => d.blockedReported || d.condition === DrainCondition.BLOCKED
  );
  if (hasBlocked) return 'Blocked / Obstruction Reported';
  const hasPoor = wardDrains.some((d) => d.condition === DrainCondition.POOR);
  if (hasPoor) return 'Heavily Silted';
  const hasMod = wardDrains.some((d) => d.condition === DrainCondition.MODERATE);
  if (hasMod) return 'Moderate Siltation';
  return 'Good Conveyance';
}

export const VijayawadaGisMap: React.FC<{ compact?: boolean }> = ({
  compact = false,
}) => {
  const {
    currentUser,
    zones,
    zoneAssessments,
    assignedWardIdsForCurrentOfficer,
    incidents,
    drains,
    scenario,
    setScenario,
    customRainfallMmHr,
    citizenMapDraft,
    setCitizenMapDraft,
    setActiveNav,
  } = useAquaGuard();

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isOfficer = currentUser?.role === UserRole.OFFICER;
  const isCitizen = currentUser?.role === UserRole.CITIZEN;

  // Role-scoped datasets (strictly preserving visual map design)
  const scopedZones = useMemo(() => {
    if (isOfficer) {
      const wardSet = new Set(assignedWardIdsForCurrentOfficer);
      return zones.filter((z) => wardSet.has(z.id));
    }
    return zones;
  }, [zones, isOfficer, assignedWardIdsForCurrentOfficer]);

  const scopedDrains = useMemo(() => {
    if (isCitizen) return []; // Do not expose internal drainage infrastructure to citizens
    if (isOfficer) {
      const wardSet = new Set(assignedWardIdsForCurrentOfficer);
      return drains.filter((d) => wardSet.has(d.wardId));
    }
    return drains;
  }, [drains, isCitizen, isOfficer, assignedWardIdsForCurrentOfficer]);

  const scopedIncidents = useMemo(() => {
    if (isOfficer) {
      const wardSet = new Set(assignedWardIdsForCurrentOfficer);
      return incidents.filter((inc) => wardSet.has(inc.wardId));
    }
    return incidents;
  }, [incidents, isOfficer, assignedWardIdsForCurrentOfficer]);

  const citizenPublicIncidents = useMemo<PublicCitizenIncidentView[]>(() => {
    if (!isCitizen) return [];
    return scopedIncidents.map(sanitizeIncidentForCitizenMap);
  }, [isCitizen, scopedIncidents]);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayLayerRef = useRef<L.LayerGroup | null>(null);
  const markerByKeyRef = useRef<Record<string, L.Layer>>({});

  const [basemap, setBasemap] = useState<BasemapMode>('osm');
  const [activeDrilldown, setActiveDrilldown] =
    useState<DrilldownLevel['id']>('vijayawada');
  const [currentZoom, setCurrentZoom] = useState<number>(12);

  const [selectedZoneId, setSelectedZoneId] = useState<string>(
    scopedZones[0]?.id ?? 'ward-benz-circle'
  );
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedDrainId, setSelectedDrainId] = useState<string | null>(null);

  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'ALL'>('ALL');
  const [showRiskZones, setShowRiskZones] = useState<boolean>(true);
  const [showIncidents, setShowIncidents] = useState<boolean>(true);
  const [showDrains, setShowDrains] = useState<boolean>(true);
  const [showWaterways, setShowWaterways] = useState<boolean>(true);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchFocused, setSearchFocused] = useState<boolean>(false);

  // Keep selectedZoneId inside officer's assigned wards when officer switches or assignments change
  useEffect(() => {
    if (scopedZones.length > 0 && !scopedZones.some((z) => z.id === selectedZoneId)) {
      setSelectedZoneId(scopedZones[0].id);
      setSelectedIncidentId(null);
      setSelectedDrainId(null);
    }
  }, [scopedZones, selectedZoneId]);

  const mod = getScenarioModifiers(scenario, customRainfallMmHr);

  const selectedZone =
    scopedZones.find((z) => z.id === selectedZoneId) ??
    scopedZones[0] ??
    zones[0];
  const selectedAssessment = zoneAssessments[selectedZone.id];

  const zoneIncidents = useMemo(
    () => scopedIncidents.filter((inc) => inc.wardId === selectedZone.id),
    [scopedIncidents, selectedZone.id]
  );

  const zoneDrains = useMemo(
    () => scopedDrains.filter((d) => d.wardId === selectedZone.id),
    [scopedDrains, selectedZone.id]
  );

  const visibleIncidents = useMemo(() => {
    if (!showIncidents) return [];
    if (riskFilter === 'ALL') return scopedIncidents;
    return scopedIncidents.filter((inc) => inc.severity === riskFilter);
  }, [scopedIncidents, showIncidents, riskFilter]);

  const visiblePublicIncidents = useMemo(() => {
    if (!showIncidents) return [];
    if (riskFilter === 'ALL') return citizenPublicIncidents;
    return citizenPublicIncidents.filter((inc) => inc.severity === riskFilter);
  }, [citizenPublicIncidents, showIncidents, riskFilter]);

  const selectedIncident: IncidentReport | undefined = !isCitizen
    ? scopedIncidents.find((i) => i.id === selectedIncidentId)
    : undefined;

  const selectedPublicIncident: PublicCitizenIncidentView | undefined = isCitizen
    ? citizenPublicIncidents.find((i) => i.id === selectedIncidentId)
    : undefined;

  const selectedDrain = !isCitizen
    ? scopedDrains.find((d) => d.id === selectedDrainId)
    : undefined;

  // Build searchable catalog scoped strictly by role
  const searchCatalog = useMemo<SearchEntry[]>(() => {
    const incidentEntries: SearchEntry[] = isCitizen
      ? citizenPublicIncidents.map((inc, idx) => {
          const pt = resolveIncidentGeoPoint(inc.id, inc.wardId, idx, {
            lat: inc.lat,
            lng: inc.lng,
          });
          return {
            id: `inc-${inc.id}`,
            label: inc.title,
            sublabel: `${inc.location} · ${inc.publicStatusLabel}`,
            category: 'Incident' as const,
            lat: pt.lat,
            lng: pt.lng,
            zoom: 16,
            wardId: inc.wardId,
            incidentId: inc.id,
          };
        })
      : scopedIncidents.map((inc, idx) => {
          const pt = resolveIncidentGeoPoint(inc.id, inc.wardId, idx, {
            lat: inc.lat,
            lng: inc.lng,
          });
          return {
            id: `inc-${inc.id}`,
            label: inc.title,
            sublabel: `${inc.id} · ${inc.location}`,
            category: 'Incident' as const,
            lat: pt.lat,
            lng: pt.lng,
            zoom: 16,
            wardId: inc.wardId,
            incidentId: inc.id,
          };
        });

    const drainEntries: SearchEntry[] = isCitizen
      ? []
      : scopedDrains.map((d) => {
          const pt = DRAIN_GEO_POINTS[d.id] ?? { lat: 16.5062, lng: 80.648 };
          return {
            id: `drain-${d.id}`,
            label: d.name,
            sublabel: `${d.assetCode} · ${d.condition}`,
            category: 'Drain' as const,
            lat: pt.lat,
            lng: pt.lng,
            zoom: 16,
            wardId: d.wardId,
          };
        });

    const entries: SearchEntry[] = [
      ...GEO_DRILLDOWN_LEVELS.slice(0, 3).map((lvl) => ({
        id: `region-${lvl.id}`,
        label: lvl.label,
        sublabel: lvl.description,
        category: 'Region' as const,
        lat: lvl.center.lat,
        lng: lvl.center.lng,
        zoom: lvl.zoom,
      })),
      ...scopedZones.map((z) => {
        const pt = WARD_GEO_POINTS[z.id] ?? { lat: 16.5062, lng: 80.648 };
        return {
          id: `ward-${z.id}`,
          label: z.name,
          sublabel: `Ward ${z.wardNumber} · ${z.landmark} (Demo)`,
          category: 'Locality' as const,
          lat: pt.lat,
          lng: pt.lng,
          zoom: 14,
          wardId: z.id,
        };
      }),
      ...incidentEntries,
      ...drainEntries,
      ...WATERWAY_LANDMARKS.map((w) => ({
        id: w.id,
        label: w.name,
        sublabel: `${w.waterwayType} · Vijayawada`,
        category: 'Waterway' as const,
        lat: w.lat,
        lng: w.lng,
        zoom: 14,
      })),
    ];
    return entries;
  }, [
    isCitizen,
    scopedZones,
    scopedIncidents,
    citizenPublicIncidents,
    scopedDrains,
  ]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return searchCatalog.slice(0, 8);
    return searchCatalog
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.sublabel.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [searchQuery, searchCatalog]);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [16.5062, 80.648],
      zoom: 12,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    const overlayGroup = L.layerGroup().addTo(map);
    overlayLayerRef.current = overlayGroup;
    mapRef.current = map;

    const syncZoomTier = () => {
      const z = map.getZoom();
      setCurrentZoom(z);
      if (z <= 5) setActiveDrilldown('india');
      else if (z <= 9) setActiveDrilldown('andhra-pradesh');
      else if (z <= 12) setActiveDrilldown('vijayawada');
      else if (z <= 14) setActiveDrilldown('wards');
      else setActiveDrilldown('site');
    };

    const handleMapClick = (ev: L.LeafletMouseEvent) => {
      if (!isCitizen) return;
      const lat = Number(ev.latlng.lat.toFixed(5));
      const lng = Number(ev.latlng.lng.toFixed(5));
      const nearestWardId = findNearestWardId(lat, lng);
      const nearestZone = zones.find((z) => z.id === nearestWardId);
      setSelectedZoneId(nearestWardId);
      setSelectedIncidentId(null);
      setSelectedDrainId(null);
      setCitizenMapDraft({
        wardId: nearestWardId,
        lat,
        lng,
        suggestedLocation: nearestZone
          ? `Near ${nearestZone.landmark} (${lat}°N, ${lng}°E)`
          : `Map Pin (${lat}°N, ${lng}°E)`,
      });
    };

    map.on('zoomend', syncZoomTier);
    map.on('click', handleMapClick);

    return () => {
      map.off('zoomend', syncZoomTier);
      map.off('click', handleMapClick);
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      overlayLayerRef.current = null;
    };
  }, [isCitizen, zones, setCitizenMapDraft]);

  // Sync Basemap Tile Layer (verified OpenStreetMap tiles; Dark GIS uses CSS tile-pane filter)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!tileLayerRef.current) {
      const layer = L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
          crossOrigin: true,
        }
      );
      layer.addTo(map);
      tileLayerRef.current = layer;
    }

    const container = mapContainerRef.current;
    if (container) {
      if (basemap === 'dark') {
        container.classList.add('aquaguard-dark-tiles');
      } else {
        container.classList.remove('aquaguard-dark-tiles');
      }
    }
  }, [basemap]);

  // Render GIS Data Overlays whenever filters, scenario, incidents, drains, or layers change
  useEffect(() => {
    const map = mapRef.current;
    const group = overlayLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();
    markerByKeyRef.current = {};

    // 1. Illustrative Risk Locations (DEMO DATA circles + center point markers)
    if (showRiskZones) {
      scopedZones.forEach((zone) => {
        const assessment = zoneAssessments[zone.id];
        if (riskFilter !== 'ALL' && assessment.category !== riskFilter) {
          return;
        }

        const geo = WARD_GEO_POINTS[zone.id] ?? {
          lat: 16.5062,
          lng: 80.648,
          historicalCount: 10,
          radiusMeters: 550,
        };
        const hex = getRiskHexColor(assessment.category);
        const wardDrains = scopedDrains.filter((d) => d.wardId === zone.id);
        const isSelected =
          zone.id === selectedZoneId && !selectedIncidentId && !selectedDrainId;

        const circle = L.circle([geo.lat, geo.lng], {
          radius: geo.radiusMeters,
          color: isSelected ? '#2DD4BF' : hex,
          weight: isSelected ? 2.5 : 1.5,
          opacity: 0.9,
          fillColor: hex,
          fillOpacity: isSelected ? 0.28 : 0.18,
          dashArray: '4 4',
        });

        const centerMarker = L.circleMarker([geo.lat, geo.lng], {
          radius: isSelected ? 9 : 7,
          color: '#08101E',
          weight: 2,
          fillColor: hex,
          fillOpacity: 0.95,
        });

        const popupDom = buildPopupElement({
          badge: `DEMO DATA · Ward ${zone.wardNumber}`,
          title: zone.name,
          locality: zone.landmark,
          riskCategory: assessment.category,
          riskScore: assessment.score,
          rainfallMmHr: mod.rainfallMmHr,
          historicalCount: geo.historicalCount,
          drainageCondition: isCitizen
            ? 'Public Risk Advisory Only'
            : getDrainSummaryForWard(wardDrains),
          reason:
            assessment.reasons[0] ??
            `${zone.terrainNote}. ${isCitizen ? '' : zone.drainageNote}`.trim(),
        });

        centerMarker.bindPopup(popupDom, {
          className: 'aquaguard-leaflet-popup',
          maxWidth: 300,
        });

        const handleZoneClick = () => {
          setSelectedZoneId(zone.id);
          setSelectedIncidentId(null);
          setSelectedDrainId(null);
          if (isCitizen) {
            setCitizenMapDraft({
              wardId: zone.id,
              lat: geo.lat,
              lng: geo.lng,
              suggestedLocation: `${zone.landmark} (${geo.lat}°N, ${geo.lng}°E)`,
            });
          }
        };

        circle.on('click', () => {
          handleZoneClick();
          centerMarker.openPopup();
        });
        centerMarker.on('click', handleZoneClick);

        circle.addTo(group);
        centerMarker.addTo(group);
        markerByKeyRef.current[`ward-${zone.id}`] = centerMarker;
      });
    }

    // 2. Waterways Reference Markers
    if (showWaterways) {
      WATERWAY_LANDMARKS.forEach((ww) => {
        const icon = L.divIcon({
          className: 'aquaguard-waterway-pin',
          html: `<div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:9999px;background:#0C4A6E;border:2px solid #38BDF8;color:#E0F2FE;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.45);">~</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([ww.lat, ww.lng], { icon });
        const popupDom = buildPopupElement({
          badge: 'Waterway Reference',
          title: ww.name,
          locality: ww.waterwayType,
          riskCategory: RiskLevel.MEDIUM,
          riskScore: 48,
          rainfallMmHr: mod.rainfallMmHr,
          historicalCount: 12,
          drainageCondition: 'Canal / River Corridor',
          reason: ww.note,
        });
        marker.bindPopup(popupDom, {
          className: 'aquaguard-leaflet-popup',
          maxWidth: 300,
        });
        marker.addTo(group);
        markerByKeyRef.current[ww.id] = marker;
      });
    }

    // 3. Drainage Assets & Blocked Drains (Admin & Assigned Officer Only)
    if (showDrains && !isCitizen) {
      scopedDrains.forEach((drain) => {
        const geo = DRAIN_GEO_POINTS[drain.id] ?? { lat: 16.5062, lng: 80.648 };
        const zoneAssessment = zoneAssessments[drain.wardId];
        const isBlocked =
          drain.blockedReported || drain.condition === DrainCondition.BLOCKED;
        const drainRisk = isBlocked
          ? RiskLevel.CRITICAL
          : drain.condition === DrainCondition.POOR
          ? RiskLevel.HIGH
          : drain.condition === DrainCondition.MODERATE
          ? RiskLevel.MEDIUM
          : RiskLevel.LOW;

        if (riskFilter !== 'ALL' && drainRisk !== riskFilter) {
          return;
        }

        const bg = isBlocked ? '#991B1B' : '#0F172A';
        const border = isBlocked ? '#EF4444' : '#38BDF8';
        const icon = L.divIcon({
          className: 'aquaguard-drain-pin',
          html: `<div title="${drain.assetCode}" style="width:16px;height:16px;border-radius:3px;background:${bg};border:2px solid ${border};box-shadow:0 2px 6px rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;"><div style="width:5px;height:5px;background:${border};border-radius:1px;"></div></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        const marker = L.marker([geo.lat, geo.lng], { icon });
        const wardGeo = WARD_GEO_POINTS[drain.wardId];
        const popupDom = buildPopupElement({
          badge: isBlocked
            ? `DEMO DATA · Blocked Drain (${drain.assetCode})`
            : `DEMO DATA · Drainage Asset (${drain.assetCode})`,
          title: drain.name,
          locality: `${drain.wardName} · ${drain.corridorType}`,
          riskCategory: drainRisk,
          riskScore: zoneAssessment?.score ?? 60,
          rainfallMmHr: mod.rainfallMmHr,
          historicalCount: wardGeo?.historicalCount ?? 10,
          drainageCondition: `${drain.condition} (${drain.siltationPct}% siltation)`,
          reason: `${drain.capacityStatus}. Last maintained ${drain.lastMaintained}.`,
        });

        marker.bindPopup(popupDom, {
          className: 'aquaguard-leaflet-popup',
          maxWidth: 300,
        });
        marker.on('click', () => {
          setSelectedZoneId(drain.wardId);
          setSelectedDrainId(drain.id);
          setSelectedIncidentId(null);
        });

        marker.addTo(group);
        markerByKeyRef.current[`drain-${drain.id}`] = marker;
      });
    }

    // 4. Reported Waterlogging Incidents (Sanitized for Citizen, Full for Admin/Officer)
    if (isCitizen) {
      visiblePublicIncidents.forEach((inc, idx) => {
        const geo = resolveIncidentGeoPoint(inc.id, inc.wardId, idx, {
          lat: inc.lat,
          lng: inc.lng,
        });
        const hex = getRiskHexColor(inc.severity);
        const zoneAssessment = zoneAssessments[inc.wardId];
        const wardGeo = WARD_GEO_POINTS[inc.wardId];

        const icon = L.divIcon({
          className: 'aquaguard-incident-pin',
          html: `<div style="width:22px;height:22px;border-radius:9999px;background:${hex};border:2.5px solid #FFFFFF;box-shadow:0 3px 10px rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-size:11px;font-weight:700;">!</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const marker = L.marker([geo.lat, geo.lng], { icon });
        const popupDom = buildPopupElement({
          badge: `DEMO DATA · Public Incident (${inc.publicStatusLabel})`,
          title: inc.title,
          locality: `${inc.location} (${inc.wardName})`,
          riskCategory: inc.severity,
          riskScore: zoneAssessment?.score ?? 70,
          rainfallMmHr: mod.rainfallMmHr,
          historicalCount: wardGeo?.historicalCount ?? 12,
          drainageCondition: 'Public Safety Advisory Active',
          reason: `${inc.publicStatusLabel} — Reported near ${inc.location}.`,
        });

        marker.bindPopup(popupDom, {
          className: 'aquaguard-leaflet-popup',
          maxWidth: 300,
        });
        marker.on('click', () => {
          setSelectedZoneId(inc.wardId);
          setSelectedIncidentId(inc.id);
          setSelectedDrainId(null);
        });

        marker.addTo(group);
        markerByKeyRef.current[`inc-${inc.id}`] = marker;
      });

      // Show citizen's selected pin if they clicked a custom location on the map
      if (citizenMapDraft) {
        const pinIcon = L.divIcon({
          className: 'aquaguard-citizen-draft-pin',
          html: `<div style="width:22px;height:22px;border-radius:9999px;background:#0D9488;border:2.5px solid #F0FDFA;box-shadow:0 3px 10px rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-size:11px;font-weight:700;">+</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        L.marker([citizenMapDraft.lat, citizenMapDraft.lng], { icon: pinIcon }).addTo(
          group
        );
      }
    } else {
      visibleIncidents.forEach((inc, idx) => {
        const geo = resolveIncidentGeoPoint(inc.id, inc.wardId, idx, {
          lat: inc.lat,
          lng: inc.lng,
        });
        const hex = getRiskHexColor(inc.severity);
        const zoneAssessment = zoneAssessments[inc.wardId];
        const wardGeo = WARD_GEO_POINTS[inc.wardId];
        const wardDrains = scopedDrains.filter((d) => d.wardId === inc.wardId);

        const icon = L.divIcon({
          className: 'aquaguard-incident-pin',
          html: `<div style="width:22px;height:22px;border-radius:9999px;background:${hex};border:2.5px solid #FFFFFF;box-shadow:0 3px 10px rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-size:11px;font-weight:700;">!</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const marker = L.marker([geo.lat, geo.lng], { icon });
        const popupDom = buildPopupElement({
          badge: `DEMO DATA · Incident ${inc.id} (${inc.status})`,
          title: inc.title,
          locality: `${inc.location} (${inc.wardName})`,
          riskCategory: inc.severity,
          riskScore: zoneAssessment?.score ?? 70,
          rainfallMmHr: mod.rainfallMmHr,
          historicalCount: wardGeo?.historicalCount ?? 12,
          drainageCondition: getDrainSummaryForWard(wardDrains),
          reason: inc.description,
        });

        marker.bindPopup(popupDom, {
          className: 'aquaguard-leaflet-popup',
          maxWidth: 300,
        });
        marker.on('click', () => {
          setSelectedZoneId(inc.wardId);
          setSelectedIncidentId(inc.id);
          setSelectedDrainId(null);
        });

        marker.addTo(group);
        markerByKeyRef.current[`inc-${inc.id}`] = marker;
      });
    }
  }, [
    isCitizen,
    scopedZones,
    zoneAssessments,
    scopedDrains,
    visibleIncidents,
    visiblePublicIncidents,
    citizenMapDraft,
    riskFilter,
    showRiskZones,
    showDrains,
    showWaterways,
    selectedZoneId,
    selectedIncidentId,
    selectedDrainId,
    mod.rainfallMmHr,
    setCitizenMapDraft,
  ]);

  const handleDrilldownClick = (lvl: DrilldownLevel) => {
    setActiveDrilldown(lvl.id);
    const map = mapRef.current;
    if (!map) return;

    if (lvl.id === 'site' && selectedZone) {
      const geo = WARD_GEO_POINTS[selectedZone.id] ?? lvl.center;
      map.flyTo([geo.lat, geo.lng], lvl.zoom, { duration: 0.7 });
      return;
    }
    map.flyTo([lvl.center.lat, lvl.center.lng], lvl.zoom, { duration: 0.7 });
  };

  const handleSelectZoneFromDropdown = (wardId: string) => {
    setSelectedZoneId(wardId);
    setSelectedIncidentId(null);
    setSelectedDrainId(null);
    const geo = WARD_GEO_POINTS[wardId];
    const map = mapRef.current;
    if (map && geo) {
      map.flyTo([geo.lat, geo.lng], 14, { duration: 0.7 });
      const marker = markerByKeyRef.current[`ward-${wardId}`];
      if (marker && 'openPopup' in marker) {
        (marker as L.CircleMarker).openPopup();
      }
    }
  };

  const handleSearchPick = (entry: SearchEntry) => {
    setSearchQuery(entry.label);
    setSearchFocused(false);
    if (entry.wardId) setSelectedZoneId(entry.wardId);
    setSelectedIncidentId(entry.incidentId ?? null);
    setSelectedDrainId(entry.category === 'Drain' ? entry.id.replace('drain-', '') : null);

    const map = mapRef.current;
    if (map) {
      map.flyTo([entry.lat, entry.lng], entry.zoom, { duration: 0.75 });
      setTimeout(() => {
        const marker = markerByKeyRef.current[entry.id];
        if (marker && 'openPopup' in marker) {
          (marker as L.Marker).openPopup();
        }
      }, 350);
    }
  };

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleResetView = () => {
    setActiveDrilldown('vijayawada');
    mapRef.current?.flyTo([16.5062, 80.648], 12, { duration: 0.6 });
  };

  return (
    <div className="space-y-4">
      {!compact && (
        <SectionHeader
          title="Vijayawada Geographic Waterlogging Risk Map"
          subtitle={
            isOfficer
              ? `Assigned Ward GIS View (${scopedZones.length} assigned wards) with real OpenStreetMap drill-down, location search, and operational overlays.`
              : isCitizen
              ? 'Public Vijayawada waterlogging risk map with street-level drill-down. Click any location on the map to report waterlogging.'
              : 'Real-world OpenStreetMap / GIS basemap with country-to-street drill-down, location search, and illustrative waterlogging & drainage overlays.'
          }
          dataTag={
            isOfficer
              ? `Officer Scope: ${currentUser?.wardScope ?? 'Assigned Wards'} · DEMO DATA`
              : isCitizen
              ? 'Public Map Layers · Click Map to Pin Report · DEMO DATA'
              : 'Real Basemap Tiles · Overlays & Incidents Labeled as DEMO DATA'
          }
          action={
            <div className="flex items-center gap-1 rounded-md border border-[#1E2F4D] bg-[#0F192D] p-1">
              {[ScenarioType.NORMAL, ScenarioType.HEAVY, ScenarioType.EXTREME].map(
                (sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => setScenario(sc)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      scenario === sc
                        ? 'bg-teal-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {sc}
                  </button>
                )
              )}
            </div>
          }
        />
      )}

      {/* Geographic Drill-Down Bar + Search + Basemap Switcher */}
      <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-3.5 space-y-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {/* 5-Level Geographic Drill-Down */}
          <div className="flex flex-wrap items-center gap-1" role="navigation" aria-label="Geographic map drill-down">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 mr-1">
              <Navigation className="h-3.5 w-3.5 text-teal-400" aria-hidden="true" />
              <span>Drill-Down:</span>
            </span>
            {GEO_DRILLDOWN_LEVELS.map((lvl, idx) => {
              const active = activeDrilldown === lvl.id;
              return (
                <React.Fragment key={lvl.id}>
                  <button
                    type="button"
                    onClick={() => handleDrilldownClick(lvl)}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-teal-600 text-white'
                        : 'bg-[#08101E] text-slate-300 border border-[#1E2F4D] hover:border-slate-500'
                    }`}
                  >
                    {lvl.label}
                  </button>
                  {idx < GEO_DRILLDOWN_LEVELS.length - 1 && (
                    <span className="text-slate-600 text-xs" aria-hidden="true">
                      /
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Search Box & Basemap Toggle */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="relative min-w-[220px] flex-1 sm:flex-initial">
              <Search
                className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchFocused(true);
                }}
                placeholder="Search Vijayawada locality, incident..."
                aria-label="Search locations on GIS map"
                className="w-full rounded-md border border-[#243758] bg-[#08101E] pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none"
              />
              {searchFocused && searchResults.length > 0 && (
                <div
                  role="listbox"
                  aria-label="Map location search results"
                  className="absolute left-0 right-0 z-[1000] mt-1 max-h-64 overflow-y-auto rounded-md border border-[#243758] bg-[#0F192D] py-1 shadow-xl"
                >
                  {searchResults.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onMouseDown={() => handleSearchPick(entry)}
                      className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-[#16233B]"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-100">
                          {entry.label}
                        </div>
                        <div className="truncate text-[11px] text-slate-400">
                          {entry.sublabel}
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-teal-400 shrink-0">
                        {entry.category}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              className="flex items-center gap-1 rounded-md border border-[#1E2F4D] bg-[#08101E] p-1"
              role="group"
              aria-label="Basemap style"
            >
              <button
                type="button"
                onClick={() => setBasemap('osm')}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  basemap === 'osm'
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                OpenStreetMap
              </button>
              <button
                type="button"
                onClick={() => setBasemap('dark')}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  basemap === 'dark'
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Dark GIS
              </button>
            </div>
          </div>
        </div>

        {/* Risk Filter & Layer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1E2F4D] pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 mr-1">
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Risk Filter:</span>
            </span>
            {(
              [
                'ALL',
                RiskLevel.CRITICAL,
                RiskLevel.HIGH,
                RiskLevel.MEDIUM,
                RiskLevel.LOW,
              ] as const
            ).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setRiskFilter(lvl)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  riskFilter === lvl
                    ? 'bg-teal-600 text-white'
                    : 'bg-[#08101E] text-slate-300 border border-[#1E2F4D] hover:border-slate-500'
                }`}
              >
                {lvl === 'ALL' ? 'All Levels' : lvl}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 mr-1">
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Layers:</span>
            </span>
            <button
              type="button"
              onClick={() => setShowRiskZones((v) => !v)}
              aria-pressed={showRiskZones}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                showRiskZones
                  ? 'border-teal-500/50 bg-teal-500/15 text-teal-300'
                  : 'border-[#1E2F4D] bg-[#08101E] text-slate-400'
              }`}
            >
              Risk Locations ({scopedZones.length})
            </button>
            <button
              type="button"
              onClick={() => setShowIncidents((v) => !v)}
              aria-pressed={showIncidents}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                showIncidents
                  ? 'border-teal-500/50 bg-teal-500/15 text-teal-300'
                  : 'border-[#1E2F4D] bg-[#08101E] text-slate-400'
              }`}
            >
              {isCitizen
                ? `Nearby Incidents (${visiblePublicIncidents.length})`
                : `Incidents (${visibleIncidents.length})`}
            </button>
            {!isCitizen && (
              <button
                type="button"
                onClick={() => setShowDrains((v) => !v)}
                aria-pressed={showDrains}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  showDrains
                    ? 'border-teal-500/50 bg-teal-500/15 text-teal-300'
                    : 'border-[#1E2F4D] bg-[#08101E] text-slate-400'
                }`}
              >
                Drainage Assets ({scopedDrains.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowWaterways((v) => !v)}
              aria-pressed={showWaterways}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                showWaterways
                  ? 'border-teal-500/50 bg-teal-500/15 text-teal-300'
                  : 'border-[#1E2F4D] bg-[#08101E] text-slate-400'
              }`}
            >
              Waterways ({WATERWAY_LANDMARKS.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Map + Inspector Grid */}
      <div className="grid gap-4 lg:grid-cols-12 items-stretch">
        {/* Real Leaflet Geographic Map Viewport */}
        <div className="lg:col-span-8 flex flex-col rounded-lg border border-[#1E2F4D] bg-[#0A1324] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#1E2F4D] bg-[#0F192D] px-4 py-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300 min-w-0">
              <Compass className="h-4 w-4 text-teal-400 shrink-0" aria-hidden="true" />
              <span className="truncate font-medium">
                {basemap === 'osm' ? 'OpenStreetMap Streets' : 'OpenStreetMap Dark GIS'} · Zoom {currentZoom} · Scenario: {scenario} ({mod.rainfallMmHr} mm/hr)
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleZoomOut}
                className="rounded border border-[#1E2F4D] bg-[#08101E] p-1 text-slate-300 hover:text-white"
                aria-label="Zoom out map"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                className="rounded border border-[#1E2F4D] bg-[#08101E] p-1 text-slate-300 hover:text-white"
                aria-label="Zoom in map"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetView}
                className="rounded border border-[#1E2F4D] bg-[#08101E] px-2 py-1 text-[11px] text-slate-300 hover:text-white inline-flex items-center gap-1"
                aria-label="Reset map to Vijayawada city view"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Vijayawada</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <div
              ref={mapContainerRef}
              data-testid="vijayawada-gis-canvas"
              className={`w-full ${compact ? 'h-[460px]' : 'h-[560px]'}`}
            />
          </div>

          {/* Legend & Demo Data Transparency Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1E2F4D] bg-[#0F192D] px-4 py-2.5 text-xs text-slate-300">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" aria-hidden="true" />
                Low (0–33)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#EAB308]" aria-hidden="true" />
                Medium (34–55)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#F97316]" aria-hidden="true" />
                High (56–75)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" aria-hidden="true" />
                Critical (76–100)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-orange-500 text-[9px] font-bold text-white" aria-hidden="true">
                  !
                </span>
                Incident
              </span>
              {!isCitizen && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm border border-rose-400 bg-rose-900" aria-hidden="true" />
                  Blocked Drain
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-amber-300">
                <Info className="h-3 w-3" aria-hidden="true" />
                DEMO DATA Overlays (Not Official Ward Boundaries)
              </span>
            </div>
          </div>
        </div>

        {/* Right Zone & Selected Marker Inspector */}
        <div className="lg:col-span-4 flex flex-col justify-between rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-5">
          {isOfficer && scopedZones.length === 0 ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-200 space-y-2">
              <div className="font-semibold">No Wards Currently Assigned</div>
              <p className="text-slate-300 leading-relaxed">
                No Vijayawada wards are currently assigned to your officer profile. Please contact the Municipal Admin to assign ward coverage.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="gis-ward-jump"
                  className="block text-[11px] font-medium text-slate-400 mb-1"
                >
                  {isOfficer
                    ? `Fly to Assigned Ward (${scopedZones.length} Wards · DEMO DATA)`
                    : 'Fly to Vijayawada Locality (DEMO DATA)'}
                </label>
                <select
                  id="gis-ward-jump"
                  value={selectedZone.id}
                  onChange={(e) => handleSelectZoneFromDropdown(e.target.value)}
                  className="w-full rounded-md border border-[#243758] bg-[#0B1424] px-2.5 py-1.5 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
                >
                  {scopedZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      Ward {z.wardNumber} — {z.name} ({zoneAssessments[z.id].category} · {zoneAssessments[z.id].score})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-400">
                    DEMO DATA · Ward {selectedZone.wardNumber}
                  </div>
                  <h3 className="mt-0.5 text-lg font-semibold text-slate-50">
                    {selectedZone.name}
                  </h3>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {selectedZone.landmark}
                  </div>
                </div>
                <RiskLabel
                  level={selectedAssessment.category}
                  score={selectedAssessment.score}
                />
              </div>

              {isCitizen && citizenMapDraft && (
                <div className="rounded-md border border-teal-500/40 bg-teal-500/10 p-3 space-y-1 text-xs">
                  <div className="font-semibold text-teal-300">
                    Selected Map Location for Reporting
                  </div>
                  <div className="font-mono text-[11px] text-slate-200">
                    {citizenMapDraft.lat}°N, {citizenMapDraft.lng}°E
                  </div>
                  <div className="text-[11px] text-slate-300">
                    {citizenMapDraft.suggestedLocation}
                  </div>
                </div>
              )}

              {selectedPublicIncident && (
                <div className="rounded-md border border-teal-500/40 bg-[#0A1324] p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-teal-400">
                      PUBLIC REPORT
                    </span>
                    <span className="rounded border border-teal-500/30 bg-teal-500/15 px-2 py-0.5 text-[11px] font-medium text-teal-300">
                      {selectedPublicIncident.publicStatusLabel}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-100">
                    {selectedPublicIncident.title}
                  </div>
                  <div className="text-slate-400">
                    {selectedPublicIncident.location}
                  </div>
                </div>
              )}

              {selectedIncident && !isCitizen && (
                <div className="rounded-md border border-teal-500/40 bg-[#0A1324] p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-teal-400">
                      DEMO · {selectedIncident.id}
                    </span>
                    <IncidentStatusBadge status={selectedIncident.status} />
                  </div>
                  <div className="text-xs font-semibold text-slate-100">
                    {selectedIncident.title}
                  </div>
                  <div className="text-xs text-slate-400">
                    {selectedIncident.location}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedIncident.description}
                  </p>
                </div>
              )}

              {selectedDrain && !isCitizen && (
                <div className="rounded-md border border-sky-500/40 bg-[#0A1324] p-3 space-y-1.5 text-xs">
                  <div className="font-mono text-sky-400">
                    DEMO · {selectedDrain.assetCode}
                  </div>
                  <div className="font-semibold text-slate-100">
                    {selectedDrain.name}
                  </div>
                  <div className="text-slate-300">
                    Condition: {selectedDrain.condition} ({selectedDrain.siltationPct}% siltation)
                  </div>
                  <div className="text-slate-400">{selectedDrain.capacityStatus}</div>
                </div>
              )}

              {/* 5-Factor Mini Breakdown (Public safety summary for Citizen, Full breakdown for Admin/Officer) */}
              {isCitizen ? (
                <div className="space-y-2 border-t border-[#1E2F4D] pt-4 text-xs">
                  <div className="text-slate-300 font-medium">
                    Public Safety &amp; Risk Summary ({scenario} · {mod.rainfallMmHr} mm/hr)
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {selectedAssessment.recommendedAction}
                  </p>
                  <div className="text-slate-400">
                    <span className="font-medium text-slate-200">Historical Logs: </span>
                    <span className="font-mono text-slate-200">
                      {WARD_GEO_POINTS[selectedZone.id]?.historicalCount ?? 10} events (Demo)
                    </span>
                  </div>
                  <div className="text-slate-400">
                    <span className="font-medium text-slate-200">Key Factor: </span>
                    {selectedAssessment.reasons[0] ?? selectedZone.terrainNote}
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5 border-t border-[#1E2F4D] pt-4">
                    <div className="text-xs font-medium text-slate-300">
                      Demo Risk Scoring Breakdown ({scenario} · {mod.rainfallMmHr} mm/hr)
                    </div>
                    {selectedAssessment.factorBreakdown.map((factor) => (
                      <div key={factor.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">{factor.label}</span>
                          <span className="font-mono text-slate-200 tabular-nums">
                            {factor.rawValue}/100 ({factor.weightPct}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[#08101E] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-teal-500 transition-all"
                            style={{ width: `${factor.rawValue}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 border-t border-[#1E2F4D] pt-4 text-xs">
                    <div className="text-slate-400">
                      <span className="font-medium text-slate-200">Historical Logs: </span>
                      <span className="font-mono text-slate-200">
                        {WARD_GEO_POINTS[selectedZone.id]?.historicalCount ?? 10} events (Demo)
                      </span>
                    </div>
                    <div className="text-slate-400">
                      <span className="font-medium text-slate-200">Drainage Condition: </span>
                      {getDrainSummaryForWard(zoneDrains)}
                    </div>
                    <div className="text-slate-400">
                      <span className="font-medium text-slate-200">Risk Reason: </span>
                      {selectedAssessment.reasons[0] ?? selectedZone.terrainNote}
                    </div>
                  </div>
                </>
              )}

              <div className={`grid ${isCitizen ? 'grid-cols-2' : 'grid-cols-3'} gap-2 border-t border-[#1E2F4D] pt-4`}>
                <div className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-2.5">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <AlertTriangle className="h-3 w-3 text-amber-400" aria-hidden="true" />
                    <span>{isCitizen ? 'Nearby Reports' : 'Incidents'}</span>
                  </div>
                  <div className="mt-1 font-mono text-base font-semibold text-slate-100 tabular-nums">
                    {zoneIncidents.length}
                  </div>
                </div>
                {!isCitizen && (
                  <div className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-2.5">
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Wrench className="h-3 w-3 text-teal-400" aria-hidden="true" />
                      <span>Drains</span>
                    </div>
                    <div className="mt-1 font-mono text-base font-semibold text-slate-100 tabular-nums">
                      {zoneDrains.length}
                    </div>
                  </div>
                )}
                <div className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-2.5">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Waves className="h-3 w-3 text-sky-400" aria-hidden="true" />
                    <span>Rain</span>
                  </div>
                  <div className="mt-1 font-mono text-base font-semibold text-slate-100 tabular-nums">
                    {mod.rainfallMmHr}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-[#1E2F4D] pt-4">
            {isCitizen ? (
              <button
                type="button"
                onClick={() => {
                  if (!citizenMapDraft) {
                    const geo = WARD_GEO_POINTS[selectedZone.id];
                    if (geo) {
                      setCitizenMapDraft({
                        wardId: selectedZone.id,
                        lat: geo.lat,
                        lng: geo.lng,
                        suggestedLocation: `${selectedZone.landmark} (${geo.lat}°N, ${geo.lng}°E)`,
                      });
                    }
                  }
                  setActiveNav('report-incident');
                }}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500 transition-colors"
              >
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {citizenMapDraft
                    ? `Report Waterlogging at Selected Pin`
                    : `Report Waterlogging in ${selectedZone.name}`}
                </span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActiveNav('incidents')}
                  className="flex-1 rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs font-medium text-slate-200 hover:border-teal-500/60 transition-colors whitespace-nowrap"
                >
                  Review Incidents
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNav('drainage')}
                  className="flex-1 rounded-md bg-teal-600 px-3 py-2 text-xs font-medium text-white hover:bg-teal-500 transition-colors whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Drainage Status</span>
                  </span>
                </button>
              </>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveNav('officers')}
                className="w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-1.5 text-xs font-medium text-teal-300 hover:border-teal-500/60 transition-colors"
              >
                Manage Officer Ward Assignments
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
