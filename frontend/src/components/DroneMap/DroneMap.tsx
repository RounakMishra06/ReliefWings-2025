import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import { motion } from 'framer-motion';
import { 
  Navigation, 
  Home, 
  Target, 
  Radio,
  Map as MapIcon
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import styles from './DroneMap.module.css';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface DroneMapProps {
  dronePosition: { lat: number; lng: number };
  waypoints: Array<{ lat: number; lng: number; alt: number }>;
  heading: number;
  homeDistance: number;
}

const DroneMap: React.FC<DroneMapProps> = ({ 
  dronePosition, 
  waypoints, 
  heading, 
  homeDistance 
}) => {
  const mapRef = useRef<L.Map>(null);

  // Create custom drone icon
  const droneIcon = L.divIcon({
    html: `
      <div style="
        width: 24px; 
        height: 24px; 
        background: #00ffff; 
        border-radius: 50%; 
        border: 2px solid #ffffff;
        box-shadow: 0 0 20px #00ffff;
        transform: rotate(${heading}deg);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      ">
        <div style="
          width: 0; 
          height: 0; 
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-bottom: 8px solid #ffffff;
          transform: translateY(-2px);
        "></div>
      </div>
    `,
    className: 'drone-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  // Create home icon
  const homeIcon = L.divIcon({
    html: `
      <div style="
        width: 20px; 
        height: 20px; 
        background: #00ff88; 
        border-radius: 4px; 
        border: 2px solid #ffffff;
        box-shadow: 0 0 15px #00ff88;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#ffffff">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
      </div>
    `,
    className: 'home-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  // Create waypoint icon
  const waypointIcon = (index: number, isActive: boolean) => L.divIcon({
    html: `
      <div style="
        width: 18px; 
        height: 18px; 
        background: ${isActive ? '#ffff00' : '#ff6600'}; 
        border-radius: 50%; 
        border: 2px solid #ffffff;
        box-shadow: 0 0 15px ${isActive ? '#ffff00' : '#ff6600'};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: bold;
        color: #000000;
      ">
        ${index + 1}
      </div>
    `,
    className: 'waypoint-marker',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

  // Update map center when drone moves
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView([dronePosition.lat, dronePosition.lng], mapRef.current.getZoom());
    }
  }, [dronePosition]);

  // Home position (first waypoint or default)
  const homePosition = waypoints.length > 0 ? waypoints[0] : dronePosition;

  // Flight path
  const flightPath = [
    [homePosition.lat, homePosition.lng],
    [dronePosition.lat, dronePosition.lng]
  ] as [number, number][];

  return (
    <div className={styles.mapContainer}>
      <motion.div 
        className={styles.mapHeader}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className={styles.mapTitle}>
          <MapIcon size={20} />
          <span>Live Flight Map</span>
        </div>
        
        <div className={styles.mapStats}>
          <div className={styles.stat}>
            <Home size={14} />
            <span>{homeDistance.toFixed(0)}m</span>
          </div>
          <div className={styles.stat}>
            <Navigation size={14} />
            <span>{heading.toFixed(0)}°</span>
          </div>
          <div className={styles.stat}>
            <Target size={14} />
            <span>{waypoints.length} WP</span>
          </div>
        </div>
      </motion.div>

      <div className={styles.mapWrapper}>
        <MapContainer
          ref={mapRef}
          center={[dronePosition.lat, dronePosition.lng]}
          zoom={16}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          className={styles.map}
        >
          {/* Satellite tile layer */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
          />
          
          {/* Alternative: OpenStreetMap */}
          {/* <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          /> */}

          {/* Drone marker */}
          <Marker position={[dronePosition.lat, dronePosition.lng]} icon={droneIcon}>
            <Popup>
              <div className={styles.dronePopup}>
                <h4>Relief Drone Alpha-1</h4>
                <p><strong>Position:</strong> {dronePosition.lat.toFixed(6)}, {dronePosition.lng.toFixed(6)}</p>
                <p><strong>Heading:</strong> {heading.toFixed(0)}°</p>
                <p><strong>Home Distance:</strong> {homeDistance.toFixed(0)}m</p>
              </div>
            </Popup>
          </Marker>

          {/* Home marker */}
          <Marker position={[homePosition.lat, homePosition.lng]} icon={homeIcon}>
            <Popup>
              <div className={styles.homePopup}>
                <h4>Home Base</h4>
                <p>Launch and recovery point</p>
              </div>
            </Popup>
          </Marker>

          {/* Waypoint markers */}
          {waypoints.map((waypoint, index) => (
            <Marker
              key={index}
              position={[waypoint.lat, waypoint.lng]}
              icon={waypointIcon(index, index === 1)} // Assuming current waypoint is index 1
            >
              <Popup>
                <div className={styles.waypointPopup}>
                  <h4>Waypoint {index + 1}</h4>
                  <p><strong>Position:</strong> {waypoint.lat.toFixed(6)}, {waypoint.lng.toFixed(6)}</p>
                  <p><strong>Altitude:</strong> {waypoint.alt}m</p>
                  {index === 1 && <p><strong>Status:</strong> Active Target</p>}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Flight path */}
          <Polyline
            positions={flightPath}
            color="#00ffff"
            weight={3}
            opacity={0.8}
            dashArray="5, 10"
          />

          {/* Waypoint connections */}
          {waypoints.length > 1 && (
            <Polyline
              positions={waypoints.map(wp => [wp.lat, wp.lng] as [number, number])}
              color="#ff6600"
              weight={2}
              opacity={0.6}
              dashArray="10, 5"
            />
          )}

          {/* Communication range circle */}
          <Circle
            center={[homePosition.lat, homePosition.lng]}
            radius={2000} // 2km range
            fillColor="#00ff88"
            fillOpacity={0.1}
            color="#00ff88"
            weight={2}
            opacity={0.3}
          />

          {/* Danger zone (if any) */}
          <Circle
            center={[dronePosition.lat + 0.001, dronePosition.lng + 0.001]}
            radius={500}
            fillColor="#ff0044"
            fillOpacity={0.15}
            color="#ff0044"
            weight={2}
            opacity={0.5}
          />
        </MapContainer>
      </div>

      {/* Map controls */}
      <div className={styles.mapControls}>
        <motion.button 
          className={styles.controlButton}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => mapRef.current?.setView([dronePosition.lat, dronePosition.lng], 16)}
        >
          <Radio size={16} />
          <span>Center on Drone</span>
        </motion.button>
        
        <motion.button 
          className={styles.controlButton}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => mapRef.current?.setView([homePosition.lat, homePosition.lng], 14)}
        >
          <Home size={16} />
          <span>Show Home</span>
        </motion.button>
      </div>

      {/* Legend */}
      <div className={styles.mapLegend}>
        <div className={styles.legendItem}>
          <div className={`${styles.legendIcon} ${styles.droneIcon}`}></div>
          <span>Drone</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendIcon} ${styles.homeIconLegend}`}></div>
          <span>Home</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendIcon} ${styles.waypointIconLegend}`}></div>
          <span>Waypoint</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendLine} ${styles.flightPath}`}></div>
          <span>Flight Path</span>
        </div>
      </div>
    </div>
  );
};

export default DroneMap;
