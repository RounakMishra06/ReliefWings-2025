import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import DroneMap from '../DroneMap/DroneMap';
import TelemetryPanel from '../TelemetryPanel/TelemetryPanel';
import FlightData from '../FlightData/FlightData';
import styles from './DroneDashboard.module.css';

interface DroneData {
  // Flight Data
  altitude: number;
  groundSpeed: number;
  verticalSpeed: number;
  airSpeed: number;
  distanceToWaypoint: number;
  
  // Position & Navigation
  latitude: number;
  longitude: number;
  heading: number;
  homeDistance: number;
  gpsSignal: number;
  satelliteCount: number;
  
  // Power & Systems
  batteryLevel: number;
  batteryVoltage: number;
  current: number;
  temperature: number;
  
  // Flight Control
  throttle: number;
  pitch: number;
  roll: number;
  yaw: number;
  
  // Environmental
  windSpeed: number;
  windDirection: number;
  
  // System Status
  flightMode: string;
  armStatus: boolean;
  rssi: number;
  
  // Mission Data
  waypoints: Array<{lat: number, lng: number, alt: number}>;
  currentWaypoint: number;
  missionProgress: number;
  
  // Camera & Sensors
  cameraStatus: boolean;
  gimbalPitch: number;
  gimbalYaw: number;
  recordingStatus: boolean;
}

const DroneDashboard: React.FC = () => {
  const [droneData, setDroneData] = useState<DroneData>({
    // Initialize with mock data - replace with real telemetry
    altitude: 125.5,
    groundSpeed: 12.3,
    verticalSpeed: 0.5,
    airSpeed: 13.1,
    distanceToWaypoint: 245.7,
    latitude: 40.7128,
    longitude: -74.0060,
    heading: 145,
    homeDistance: 1250.3,
    gpsSignal: 98,
    satelliteCount: 12,
    batteryLevel: 78,
    batteryVoltage: 22.4,
    current: 8.5,
    temperature: 32,
    throttle: 65,
    pitch: -2.1,
    roll: 1.3,
    yaw: 145,
    windSpeed: 8.5,
    windDirection: 230,
    flightMode: "AUTO",
    armStatus: true,
    rssi: -45,
    waypoints: [
      {lat: 40.7128, lng: -74.0060, alt: 100},
      {lat: 40.7138, lng: -74.0070, alt: 120},
      {lat: 40.7148, lng: -74.0080, alt: 150},
    ],
    currentWaypoint: 1,
    missionProgress: 35,
    cameraStatus: true,
    gimbalPitch: -15,
    gimbalYaw: 0,
    recordingStatus: true
  });

  const [isConnected] = useState(true);
  const [alerts, setAlerts] = useState<string[]>([]);

  // Simulate real-time data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setDroneData(prev => ({
        ...prev,
        altitude: prev.altitude + (Math.random() - 0.5) * 2,
        groundSpeed: Math.max(0, prev.groundSpeed + (Math.random() - 0.5) * 3),
        verticalSpeed: (Math.random() - 0.5) * 2,
        batteryLevel: Math.max(0, prev.batteryLevel - 0.01),
        heading: (prev.heading + (Math.random() - 0.5) * 5) % 360,
        distanceToWaypoint: Math.max(0, prev.distanceToWaypoint - prev.groundSpeed * 0.1),
        rssi: -40 + Math.random() * 20,
        temperature: 30 + Math.random() * 10,
        windSpeed: Math.max(0, 8 + (Math.random() - 0.5) * 4),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Monitor for alerts
  useEffect(() => {
    const newAlerts: string[] = [];
    
    if (droneData.batteryLevel < 20) newAlerts.push("Low Battery Warning");
    if (droneData.gpsSignal < 70) newAlerts.push("Weak GPS Signal");
    if (droneData.windSpeed > 15) newAlerts.push("High Wind Warning");
    if (droneData.rssi < -70) newAlerts.push("Weak Radio Signal");
    
    setAlerts(newAlerts);
  }, [droneData]);

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <motion.div 
        className={styles.header}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className={styles.headerLeft}>
          <div className={styles.droneStatus}>
            <div className={`${styles.statusIndicator} ${isConnected ? styles.connected : styles.disconnected}`} />
            <span className={styles.droneName}>RELIEF DRONE Alpha-1</span>
          </div>
          <div className={styles.flightMode}>
            <span>{droneData.flightMode}</span>
          </div>
        </div>
        
        <div className={styles.headerCenter}>
          <div className={styles.missionProgress}>
            <span>Mission Progress: {droneData.missionProgress}%</span>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill}
                style={{ width: `${droneData.missionProgress}%` }}
              />
            </div>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.alerts}>
            {alerts.length > 0 && (
              <motion.div 
                className={styles.alertsContainer}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <AlertTriangle className={styles.alertIcon} />
                <span>{alerts.length} Alert{alerts.length > 1 ? 's' : ''}</span>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Left Panel - Telemetry */}
        <motion.div 
          className={styles.leftPanel}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <TelemetryPanel droneData={droneData} />
        </motion.div>

        {/* Center Panel - Map */}
        <motion.div 
          className={styles.centerPanel}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <DroneMap 
            dronePosition={{ lat: droneData.latitude, lng: droneData.longitude }}
            waypoints={droneData.waypoints}
            heading={droneData.heading}
            homeDistance={droneData.homeDistance}
          />
        </motion.div>

        {/* Right Panel - Flight Data */}
        <motion.div 
          className={styles.rightPanel}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <FlightData droneData={droneData} />
        </motion.div>
      </div>

      {/* Alerts Panel */}
      {alerts.length > 0 && (
        <motion.div 
          className={styles.alertsPanel}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {alerts.map((alert, index) => (
            <div key={index} className={styles.alert}>
              <AlertTriangle size={16} />
              <span>{alert}</span>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
};

export default DroneDashboard;
