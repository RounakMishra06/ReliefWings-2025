import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Gauge, 
  Navigation, 
  Battery, 
  Thermometer, 
  Wind, 
  Signal,
  Satellite,
  Wifi,
  Activity,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import styles from './TelemetryPanel.module.css';

interface DroneData {
  altitude: number;
  groundSpeed: number;
  verticalSpeed: number;
  airSpeed: number;
  distanceToWaypoint: number;
  latitude: number;
  longitude: number;
  heading: number;
  homeDistance: number;
  gpsSignal: number;
  satelliteCount: number;
  batteryLevel: number;
  batteryVoltage: number;
  current: number;
  temperature: number;
  throttle: number;
  pitch: number;
  roll: number;
  yaw: number;
  windSpeed: number;
  windDirection: number;
  flightMode: string;
  armStatus: boolean;
  rssi: number;
  waypoints: Array<{lat: number, lng: number, alt: number}>;
  currentWaypoint: number;
  missionProgress: number;
  cameraStatus: boolean;
  gimbalPitch: number;
  gimbalYaw: number;
  recordingStatus: boolean;
}

interface TelemetryPanelProps {
  droneData: DroneData;
}

const TelemetryPanel: React.FC<TelemetryPanelProps> = ({ droneData }) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "Flight Data": true,
    "Position & Navigation": true,
    "Power & Systems": true,
    "Flight Control": false,
    "Environmental": false,
    // "Camera & Gimbal": false,
  });

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  const toggleAllSections = () => {
    const allExpanded = Object.values(expandedSections).every(Boolean);
    const newState = Object.keys(expandedSections).reduce((acc, key) => {
      acc[key] = !allExpanded;
      return acc;
    }, {} as Record<string, boolean>);
    setExpandedSections(newState);
  };

  const allExpanded = Object.values(expandedSections).every(Boolean);
  const telemetryItems = [
    {
      category: "Flight Data",
      items: [
        { label: "Altitude", value: `${droneData.altitude.toFixed(1)} m`, icon: <Gauge size={16} />, critical: droneData.altitude < 10 },
        { label: "Ground Speed", value: `${droneData.groundSpeed.toFixed(1)} m/s`, icon: <Navigation size={16} />, critical: false },
        { label: "Vertical Speed", value: `${droneData.verticalSpeed.toFixed(1)} m/s`, icon: <Activity size={16} />, critical: Math.abs(droneData.verticalSpeed) > 5 },
        { label: "Air Speed", value: `${droneData.airSpeed.toFixed(1)} m/s`, icon: <Wind size={16} />, critical: false },
        { label: "Distance to WP", value: `${droneData.distanceToWaypoint.toFixed(0)} m`, icon: <Navigation size={16} />, critical: false },
      ]
    },
    {
      category: "Position & Navigation",
      items: [
        { label: "Latitude", value: droneData.latitude.toFixed(6), icon: <Navigation size={16} />, critical: false },
        { label: "Longitude", value: droneData.longitude.toFixed(6), icon: <Navigation size={16} />, critical: false },
        { label: "Heading", value: `${droneData.heading.toFixed(0)}°`, icon: <Navigation size={16} />, critical: false },
        { label: "Home Distance", value: `${droneData.homeDistance.toFixed(0)} m`, icon: <Navigation size={16} />, critical: droneData.homeDistance > 5000 },
        { label: "GPS Signal", value: `${droneData.gpsSignal}%`, icon: <Satellite size={16} />, critical: droneData.gpsSignal < 70 },
        { label: "Satellites", value: droneData.satelliteCount.toString(), icon: <Satellite size={16} />, critical: droneData.satelliteCount < 8 },
      ]
    },
    {
      category: "Power & Systems",
      items: [
        { label: "Battery Level", value: `${droneData.batteryLevel.toFixed(0)}%`, icon: <Battery size={16} />, critical: droneData.batteryLevel < 20 },
        { label: "Voltage", value: `${droneData.batteryVoltage.toFixed(1)} V`, icon: <Battery size={16} />, critical: droneData.batteryVoltage < 20 },
        { label: "Current", value: `${droneData.current.toFixed(1)} A`, icon: <Activity size={16} />, critical: droneData.current > 15 },
        { label: "Temperature", value: `${droneData.temperature.toFixed(1)}°C`, icon: <Thermometer size={16} />, critical: droneData.temperature > 60 || droneData.temperature < -10 },
        { label: "RSSI", value: `${droneData.rssi} dBm`, icon: <Signal size={16} />, critical: droneData.rssi < -70 },
      ]
    },
    {
      category: "Flight Control",
      items: [
        { label: "Throttle", value: `${droneData.throttle}%`, icon: <Gauge size={16} />, critical: false },
        { label: "Pitch", value: `${droneData.pitch.toFixed(1)}°`, icon: <Navigation size={16} />, critical: Math.abs(droneData.pitch) > 30 },
        { label: "Roll", value: `${droneData.roll.toFixed(1)}°`, icon: <Navigation size={16} />, critical: Math.abs(droneData.roll) > 30 },
        { label: "Yaw", value: `${droneData.yaw.toFixed(0)}°`, icon: <Navigation size={16} />, critical: false },
      ]
    },
    {
      category: "Environmental",
      items: [
        { label: "Wind Speed", value: `${droneData.windSpeed.toFixed(1)} m/s`, icon: <Wind size={16} />, critical: droneData.windSpeed > 15 },
        { label: "Wind Direction", value: `${droneData.windDirection}°`, icon: <Wind size={16} />, critical: false },
      ]
    },
    // {
    //   category: "Camera & Gimbal",
    //   items: [
    //     { label: "Camera Status", value: droneData.cameraStatus ? "Active" : "Inactive", icon: <Activity size={16} />, critical: !droneData.cameraStatus },
    //     { label: "Recording", value: droneData.recordingStatus ? "REC" : "Standby", icon: <Activity size={16} />, critical: false },
    //     { label: "Gimbal Pitch", value: `${droneData.gimbalPitch}°`, icon: <Navigation size={16} />, critical: false },
    //     { label: "Gimbal Yaw", value: `${droneData.gimbalYaw}°`, icon: <Navigation size={16} />, critical: false },
    //   ]
    // }
  ];

  return (
    <div className={styles.telemetryPanel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Wifi className={styles.headerIcon} size={20} />
          <h3>Live Telemetry</h3>
        </div>
        <div className={styles.headerRight}>
          <motion.button
            className={styles.toggleButton}
            onClick={toggleAllSections}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {allExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
          </motion.button>
        </div>
      </div>
      
      <div className={styles.content}>
        {telemetryItems.map((category, categoryIndex) => {
          const isExpanded = expandedSections[category.category];
          return (
            <motion.div
              key={category.category}
              className={styles.category}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: categoryIndex * 0.1 }}
            >
              <div 
                className={styles.categoryHeader}
                onClick={() => toggleSection(category.category)}
              >
                <h4 className={styles.categoryTitle}>{category.category}</h4>
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className={styles.chevronIcon}
                >
                  <ChevronDown size={16} />
                </motion.div>
              </div>
              
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className={styles.itemsContainer}
                  >
                    <div className={styles.itemsGrid}>
                      {category.items.map((item) => (
                        <motion.div
                          key={item.label}
                          className={`${styles.telemetryItem} ${item.critical ? styles.critical : ''}`}
                          whileHover={{ scale: 1.02 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className={styles.itemHeader}>
                            <span className={styles.itemIcon}>{item.icon}</span>
                            <span className={styles.itemLabel}>{item.label}</span>
                          </div>
                          <div className={styles.itemValue}>{item.value}</div>
                          {item.critical && (
                            <div className={styles.criticalIndicator} />
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default TelemetryPanel;
