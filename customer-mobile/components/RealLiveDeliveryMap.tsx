import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS, SHADOWS } from '../constants/theme';

const { width: SW } = Dimensions.get('window');

// Real Geographic Coordinates around SRM University AP, Mangalagiri & Neerukonda
export const REAL_WAYPOINTS = [
  { id: 'kitchen', name: 'Kitchen (Paradise Handi)', lat: 16.4365, lng: 80.5582, icon: '🍳' },
  { id: 'mangalagiri', name: 'Mangalagiri Jn Bypass', lat: 16.4430, lng: 80.5480, icon: '📍' },
  { id: 'neerukonda', name: 'Neerukonda Main Road', lat: 16.4510, lng: 80.5310, icon: '📍' },
  { id: 'maingate', name: 'SRM AP University Main Gate', lat: 16.4618, lng: 80.5090, icon: '🛡️' },
  { id: 'academic', name: 'Academic Block Quad', lat: 16.4635, lng: 80.5075, icon: '🏫' },
  { id: 'hostel', name: 'Hostel Block Tower C', lat: 16.4652, lng: 80.5060, icon: '🏠' },
];

interface RealLiveDeliveryMapProps {
  status: number; // 1: Accepted, 2: Preparing, 3: Rider Assigned, 4: On The Way, 5: Arrived, 6: Delivered
  currentCheckpoint?: string;
  isDark?: boolean;
  restaurantName?: string;
  hostelAddress?: string;
  orderId?: string;
}

export default function RealLiveDeliveryMap({
  status = 4,
  currentCheckpoint = 'Neerukonda Main Road',
  isDark = true,
  restaurantName = 'Paradise Kitchen',
  hostelAddress = 'Hostel Block C',
  orderId = 'ZV-8821',
}: RealLiveDeliveryMapProps) {
  const [mapType, setMapType] = useState<'streets' | 'satellite'>('streets');
  const [speed, setSpeed] = useState<number>(36);
  const [riderProgressIndex, setRiderProgressIndex] = useState<number>(2);

  // Determine rider waypoint index based on order status and checkpoint
  useEffect(() => {
    if (status <= 2) {
      setRiderProgressIndex(0); // At Kitchen
      setSpeed(0);
    } else if (status === 3) {
      setRiderProgressIndex(1); // Heading to restaurant
      setSpeed(28);
    } else if (status === 4) {
      const idx = REAL_WAYPOINTS.findIndex((w) =>
        w.name.toLowerCase().includes((currentCheckpoint || '').toLowerCase())
      );
      setRiderProgressIndex(idx !== -1 ? idx : 2);
      setSpeed(38);
    } else if (status === 5) {
      setRiderProgressIndex(REAL_WAYPOINTS.length - 2); // At SRM Main Gate
      setSpeed(12);
    } else {
      setRiderProgressIndex(REAL_WAYPOINTS.length - 1); // Delivered at Hostel
      setSpeed(0);
    }
  }, [status, currentCheckpoint]);

  // Minor telemetry jitter for realistic live GPS simulation
  useEffect(() => {
    if (status === 4) {
      const interval = setInterval(() => {
        setSpeed((prev) => Math.min(48, Math.max(24, prev + Math.floor(Math.random() * 7) - 3)));
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [status]);

  const activeWaypoint = REAL_WAYPOINTS[riderProgressIndex] || REAL_WAYPOINTS[0];
  const originWaypoint = REAL_WAYPOINTS[0];
  const destinationWaypoint = REAL_WAYPOINTS[REAL_WAYPOINTS.length - 1];

  // Tile layer URLs
  const streetTile = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  const satTile = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

  const selectedTile = mapType === 'satellite' ? satTile : streetTile;

  // Generate Leaflet interactive HTML payload
  const leafletHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: ${isDark ? '#0F172A' : '#F8FAFC'};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .leaflet-control-attribution { display: none !important; }
    .custom-div-icon {
      background: transparent;
      border: none;
    }
    .pulse-rider {
      position: relative;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pulse-ring {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: rgba(212, 175, 55, 0.4);
      animation: pulseAnim 1.8s infinite ease-out;
    }
    .pulse-core {
      position: relative;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #D4AF37;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 4px 12px rgba(0,0,0,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    .destination-pin {
      background: #EF4444;
      color: #FFF;
      border: 2px solid #FFF;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      box-shadow: 0 4px 10px rgba(239,68,68,0.5);
    }
    .kitchen-pin {
      background: #10B981;
      color: #FFF;
      border: 2px solid #FFF;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      box-shadow: 0 4px 10px rgba(16,185,129,0.5);
    }
    .checkpoint-dot {
      background: rgba(212, 175, 55, 0.85);
      border: 1.5px solid #FFF;
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    @keyframes pulseAnim {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([${activeWaypoint.lat}, ${activeWaypoint.lng}], 14);

    L.tileLayer('${selectedTile}', {
      maxZoom: 19,
      subdomains: ['a','b','c','d']
    }).addTo(map);

    var coordinates = [
      ${REAL_WAYPOINTS.map((w) => `[${w.lat}, ${w.lng}]`).join(',\n      ')}
    ];

    // Full Route Polyline
    L.polyline(coordinates, {
      color: '${isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'}',
      weight: 5,
      dashArray: '6, 8',
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    // Active Traveled Polyline (Glowing Gold)
    var traveledCoords = coordinates.slice(0, ${riderProgressIndex + 1});
    if (traveledCoords.length > 1) {
      L.polyline(traveledCoords, {
        color: '#D4AF37',
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    }

    // Kitchen Marker
    var kitchenIcon = L.divIcon({
      className: 'custom-div-icon',
      html: '<div class="kitchen-pin">🍳</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    L.marker([${originWaypoint.lat}, ${originWaypoint.lng}], { icon: kitchenIcon })
      .bindPopup('<b>${restaurantName}</b><br/>Campus Kitchen Hub')
      .addTo(map);

    // Destination Hostel Marker
    var hostelIcon = L.divIcon({
      className: 'custom-div-icon',
      html: '<div class="destination-pin">🏠</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    L.marker([${destinationWaypoint.lat}, ${destinationWaypoint.lng}], { icon: hostelIcon })
      .bindPopup('<b>${hostelAddress}</b><br/>Your Delivery Drop Point')
      .addTo(map);

    // Waypoint dots
    ${REAL_WAYPOINTS.slice(1, -1)
      .map(
        (w) => `
      L.marker([${w.lat}, ${w.lng}], {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: '<div class="checkpoint-dot"></div>',
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
      }).bindPopup('<b>${w.name}</b>').addTo(map);
    `
      )
      .join('\n')}

    // Animated Rider Marker
    var riderIcon = L.divIcon({
      className: 'custom-div-icon',
      html: '<div class="pulse-rider"><div class="pulse-ring"></div><div class="pulse-core">🛵</div></div>',
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });
    var riderMarker = L.marker([${activeWaypoint.lat}, ${activeWaypoint.lng}], { icon: riderIcon, zIndexOffset: 1000 }).addTo(map);

    // Fit bounds gracefully around active path
    var bounds = L.latLngBounds(coordinates);
    map.fitBounds(bounds, { padding: [35, 35] });
  </script>
</body>
</html>
  `;

  return (
    <View style={[styles.cardContainer, { backgroundColor: isDark ? '#141416' : '#FFFFFF', borderColor: isDark ? 'rgba(212,175,55,0.3)' : 'rgba(0,0,0,0.08)' }]}>
      {/* ── TOP HUD HEADER ── */}
      <View style={styles.topHud}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={styles.liveBeacon} />
            <Text style={styles.hudBadge}>LIVE GPS RADAR TELEMETRY</Text>
          </View>
          <Text style={[styles.hudLocationTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            {activeWaypoint.name}
          </Text>
        </View>

        {/* Satellite / Street Mode Toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.mapToggleBtn, mapType === 'streets' && styles.mapToggleActive]}
            onPress={() => setMapType('streets')}
          >
            <Text style={[styles.mapToggleText, mapType === 'streets' && styles.mapToggleTextActive]}>🗺️ Roads</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mapToggleBtn, mapType === 'satellite' && styles.mapToggleActive]}
            onPress={() => setMapType('satellite')}
          >
            <Text style={[styles.mapToggleText, mapType === 'satellite' && styles.mapToggleTextActive]}>🛰️ Satellite</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── INTERACTIVE LEAFLET / OPENSTREETMAP CANVAS ── */}
      <View style={styles.mapCanvasWrapper}>
        {Platform.OS === 'web' ? (
          <iframe
            srcDoc={leafletHtml}
            style={{ width: '100%', height: '100%', border: 'none', borderRadius: 16 }}
            title="Real-time GPS Delivery Tracking"
          />
        ) : (
          <WebView
            originWhitelist={['*']}
            source={{ html: leafletHtml }}
            style={styles.webView}
            scrollEnabled={false}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        )}

        {/* Floating Telemetry Metric Overlays */}
        <View style={styles.telemetryOverlay}>
          <View style={[styles.telemetryBadge, { backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.9)' }]}>
            <Text style={styles.telemetryLabel}>SPEED</Text>
            <Text style={[styles.telemetryValue, { color: COLORS.gold }]}>{speed} km/h</Text>
          </View>

          <View style={[styles.telemetryBadge, { backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.9)' }]}>
            <Text style={styles.telemetryLabel}>GPS ACCURACY</Text>
            <Text style={[styles.telemetryValue, { color: '#10B981' }]}>± 2.4 m (4G)</Text>
          </View>

          <View style={[styles.telemetryBadge, { backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.9)' }]}>
            <Text style={styles.telemetryLabel}>CORRIDOR</Text>
            <Text style={[styles.telemetryValue, { color: isDark ? '#FFF' : '#111' }]}>SRM–Amaravathi</Text>
          </View>
        </View>
      </View>

      {/* ── BOTTOM LIVE WAYPOINTS TRACKER ── */}
      <View style={styles.waypointsProgressRow}>
        {REAL_WAYPOINTS.map((w, idx) => {
          const isPassed = idx <= riderProgressIndex;
          const isCurrent = idx === riderProgressIndex;
          return (
            <View key={w.id} style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  isPassed && { backgroundColor: COLORS.gold, borderColor: '#FFF' },
                  isCurrent && { transform: [{ scale: 1.25 }], borderWidth: 2, borderColor: '#FFF' },
                ]}
              >
                <Text style={{ fontSize: 9 }}>{w.icon}</Text>
              </View>
              <Text
                style={[
                  styles.stepName,
                  { color: isCurrent ? COLORS.gold : isPassed ? (isDark ? '#FFF' : '#333') : (isDark ? '#666' : '#999') },
                  isCurrent && { fontWeight: '900' },
                ]}
                numberOfLines={1}
              >
                {w.name.split(' ')[0]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 16,
    overflow: 'hidden',
    ...SHADOWS.goldGlow,
  },
  topHud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveBeacon: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  hudBadge: {
    fontSize: 8,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 1.5,
  },
  hudLocationTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
    maxWidth: SW * 0.55,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  mapToggleBtn: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  mapToggleActive: {
    backgroundColor: COLORS.gold,
  },
  mapToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888',
  },
  mapToggleTextActive: {
    color: '#000',
    fontWeight: '900',
  },
  mapCanvasWrapper: {
    height: 240,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  telemetryOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'none',
  },
  telemetryBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  telemetryLabel: {
    fontSize: 7,
    fontWeight: '800',
    color: '#888',
    letterSpacing: 0.5,
  },
  telemetryValue: {
    fontSize: 9,
    fontWeight: '900',
    marginTop: 1,
  },
  waypointsProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepName: {
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
  },
});
