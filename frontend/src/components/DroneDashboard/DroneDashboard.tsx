import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Wifi, WifiOff, Activity } from 'lucide-react';
import DroneMap from '../DroneMap/DroneMap';
import TelemetryPanel from '../TelemetryPanel/TelemetryPanel';
import FlightData from '../FlightData/FlightData';
import ControlBar from '../ControlBar/ControlBar';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { TelemetryData } from '../../hooks/useWebSocket';
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
  const { 
    isConnected, 
    connectionStatus, 
    latestTelemetry, 
    telemetryHistory, 
    commandAcks,
    sendCommand 
  } = useWebSocket();

  const [alerts, setAlerts] = useState<string[]>([]);
  const [lastDataUpdate, setLastDataUpdate] = useState<Date | null>(null);

  // Convert real telemetry to DroneData format
  const droneData: DroneData = useMemo(() => {
    if (!latestTelemetry) {
      // Default/fallback data when no telemetry is available
      return {
        altitude: 0,
        groundSpeed: 0,
        verticalSpeed: 0,
        airSpeed: 0,
        distanceToWaypoint: 0,
        latitude: 40.7128,
        longitude: -74.0060,
        heading: 0,
        homeDistance: 0,
        gpsSignal: 0,
        satelliteCount: 0,
        batteryLevel: 0,
        batteryVoltage: 0,
        current: 0,
        temperature: 0,
        throttle: 0,
        pitch: 0,
        roll: 0,
        yaw: 0,
        windSpeed: 0,
        windDirection: 0,
        flightMode: "UNKNOWN",
        armStatus: false,
        rssi: -100,
        waypoints: [],
        currentWaypoint: 0,
        missionProgress: 0,
        cameraStatus: false,
        gimbalPitch: 0,
        gimbalYaw: 0,
        recordingStatus: false
      };
    }

    // Calculate additional values from telemetry
    const velocity = Math.sqrt(
      Math.pow(latestTelemetry.vel[0], 2) + 
      Math.pow(latestTelemetry.vel[1], 2)
    );

    const homeDistance = latestTelemetry.home_location ? 
      calculateDistance(
        latestTelemetry.gps.lat, 
        latestTelemetry.gps.lon,
        latestTelemetry.home_location.lat, 
        latestTelemetry.home_location.lon
      ) : 0;

    return {
      // Flight Data
      altitude: latestTelemetry.alt_rel,
      groundSpeed: velocity,
      verticalSpeed: -latestTelemetry.vel[2], // NED frame, so negative Z is up
      airSpeed: velocity, // Approximation
      distanceToWaypoint: 0, // Would need waypoint data
      
      // Position & Navigation
      latitude: latestTelemetry.gps.lat,
      longitude: latestTelemetry.gps.lon,
      heading: (latestTelemetry.attitude.yaw * 180 / Math.PI + 360) % 360, // Convert to degrees
      homeDistance: homeDistance,
      gpsSignal: getGpsSignalStrength(latestTelemetry.gps.fix_type),
      satelliteCount: latestTelemetry.gps.fix_type >= 3 ? 8 : 0, // Estimate
      
      // Power & Systems
      batteryLevel: latestTelemetry.battery.remaining,
      batteryVoltage: latestTelemetry.battery.voltage,
      current: latestTelemetry.battery.current,
      temperature: 25, // Default value - would need temperature sensor
      
      // Flight Control (convert from radians to degrees)
      throttle: 0, // Would need throttle data
      pitch: latestTelemetry.attitude.pitch * 180 / Math.PI,
      roll: latestTelemetry.attitude.roll * 180 / Math.PI,
      yaw: latestTelemetry.attitude.yaw * 180 / Math.PI,
      
      // Environmental
      windSpeed: 0, // Would need wind sensor
      windDirection: 0,
      
      // System Status
      flightMode: latestTelemetry.mode,
      armStatus: latestTelemetry.armed,
      rssi: -50, // Would need radio signal strength
      
      // Mission Data
      waypoints: [
        {lat: latestTelemetry.home_location.lat, lng: latestTelemetry.home_location.lon, alt: 100}
      ],
      currentWaypoint: 0,
      missionProgress: 0,
      
      // Camera & Sensors
      cameraStatus: false,
      gimbalPitch: 0,
      gimbalYaw: 0,
      recordingStatus: false
    };
  }, [latestTelemetry]);

  // Helper functions
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000; // Return in meters
  }

  function getGpsSignalStrength(fixType: number): number {
    switch (fixType) {
      case 0: return 0;   // No GPS
      case 1: return 25;  // No fix
      case 2: return 50;  // 2D fix
      case 3: return 75;  // 3D fix
      case 4: return 90;  // DGPS
      case 5: return 100; // RTK
      default: return 0;
    }
  }

  // Update last data timestamp when new telemetry arrives
  useEffect(() => {
    if (latestTelemetry) {
      setLastDataUpdate(new Date(latestTelemetry.ts));
    }
  }, [latestTelemetry]);

  // Monitor for alerts based on real telemetry
  useEffect(() => {
    const newAlerts: string[] = [];
    
    if (!isConnected) {
      newAlerts.push("Communication Lost");
    } else if (latestTelemetry) {
      // Battery alerts
      if (droneData.batteryLevel < 20) {
        newAlerts.push("Critical Battery Level");
      } else if (droneData.batteryLevel < 30) {
        newAlerts.push("Low Battery Warning");
      }
      
      // GPS alerts
      if (droneData.gpsSignal < 50) {
        newAlerts.push("Poor GPS Signal");
      }
      
      // Altitude alerts
      if (droneData.altitude > 400) { // FAA limit
        newAlerts.push("Maximum Altitude Exceeded");
      }
      
      // Speed alerts
      if (droneData.groundSpeed > 25) { // m/s
        newAlerts.push("High Speed Warning");
      }
      
      // Flight mode alerts
      if (latestTelemetry.mode === "LAND" || latestTelemetry.mode === "RTL") {
        newAlerts.push(`Drone in ${latestTelemetry.mode} Mode`);
      }

      // System status
      if (!latestTelemetry.armed && latestTelemetry.mode !== "MANUAL") {
        newAlerts.push("Drone Disarmed");
      }
    } else {
      newAlerts.push("No Telemetry Data");
    }
    
    setAlerts(newAlerts);
  }, [isConnected, latestTelemetry, droneData]);

  // Connection status indicator
  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className={styles.statusIcon} />;
      case 'connecting': return <Activity className={`${styles.statusIcon} ${styles.pulse}`} />;
      case 'disconnected':
      case 'error': 
      default: return <WifiOff className={styles.statusIcon} />;
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return isConnected && latestTelemetry ? 'ONLINE' : 'CONNECTED';
      case 'connecting': return 'CONNECTING';
      case 'disconnected': return 'DISCONNECTED';
      case 'error': return 'CONNECTION ERROR';
      default: return 'UNKNOWN';
    }
  };

  const getDataFreshness = () => {
    if (!lastDataUpdate) return 'No Data';
    const now = new Date();
    const diff = now.getTime() - lastDataUpdate.getTime();
    if (diff < 5000) return 'Live';
    if (diff < 30000) return `${Math.floor(diff/1000)}s ago`;
    return 'Stale';
  };

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
            <div className={`${styles.statusIndicator} ${isConnected && latestTelemetry ? styles.connected : styles.disconnected}`} />
            <span className={styles.droneName}>
              ReliefWings {latestTelemetry?.drone_id || 'Alpha-1'}
            </span>
            {getConnectionStatusIcon()}
            <span className={styles.connectionStatus}>{getConnectionStatusText()}</span>
          </div>
          <div className={styles.flightMode}>
            <span>{droneData.flightMode}</span>
            <span className={styles.dataFreshness}>{getDataFreshness()}</span>
          </div>
        </div>
        
        <div className={styles.headerCenter}>
          <div className={styles.telemetryInfo}>
            <span>Seq: {latestTelemetry?.seq || 0}</span>
            <span>|</span>
            <span>Alt: {droneData.altitude.toFixed(1)}m</span>
            <span>|</span>
            <span>Speed: {droneData.groundSpeed.toFixed(1)}m/s</span>
            <span>|</span>
            <span>Battery: {droneData.batteryLevel}%</span>
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

      {/* Control Bar */}
      <motion.div 
        className={styles.controlBar}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <ControlBar 
          droneData={droneData}
          isConnected={isConnected}
          onCommand={sendCommand}
        />
      </motion.div>

      {/* Alerts Panel */}
      {alerts.length > 0 && (
        <motion.div 
          className={styles.alertsPanel}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {alerts.map((alert, index) => (
            <div key={index} className={`${styles.alert} ${alert.includes('Critical') ? styles.critical : ''}`}>
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
