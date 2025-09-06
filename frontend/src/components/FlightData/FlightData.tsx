import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { 
  TrendingUp, 
  BarChart3, 
  Activity,
  Zap,
  Thermometer,
  Wind,
  Battery,
  Gauge,
  Eye,
  EyeOff
} from 'lucide-react';
import styles from './FlightData.module.css';

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

interface FlightDataProps {
  droneData: DroneData;
}

const FlightData: React.FC<FlightDataProps> = ({ droneData }) => {
  const [compactView, setCompactView] = useState(true);
  // Generate historical data for charts (in real implementation, this would come from your data store)
  const generateHistoricalData = (currentValue: number, points: number = 20) => {
    const data = [];
    for (let i = points; i >= 0; i--) {
      data.push({
        time: Date.now() - i * 5000, // 5 seconds intervals
        value: currentValue + (Math.random() - 0.5) * (currentValue * 0.1),
        timestamp: new Date(Date.now() - i * 5000).toLocaleTimeString()
      });
    }
    return data;
  };

  const altitudeData = generateHistoricalData(droneData.altitude);
  const speedData = generateHistoricalData(droneData.groundSpeed);
  const batteryData = generateHistoricalData(droneData.batteryLevel);

  const chartTheme = {
    grid: '#2a2a3e',
    text: '#ffffff',
    primary: '#00ffff',
    secondary: '#00ff88',
    warning: '#ffaa00',
    danger: '#ff0044'
  };

  const performanceMetrics = [
    {
      label: 'Flight Efficiency',
      value: Math.min(100, Math.max(0, 100 - (droneData.current / 15) * 100)),
      icon: <Zap size={16} />,
      color: '#00ff88'
    },
    {
      label: 'System Health',
      value: Math.min(100, (droneData.batteryLevel + droneData.gpsSignal + (droneData.rssi + 100)) / 3),
      icon: <Activity size={16} />,
      color: '#00ffff'
    },
    {
      label: 'Mission Progress',
      value: droneData.missionProgress,
      icon: <TrendingUp size={16} />,
      color: '#ffaa00'
    }
  ];

  return (
    <div className={styles.flightDataPanel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <BarChart3 className={styles.headerIcon} size={20} />
          <h3>Flight Analytics</h3>
        </div>
        <div className={styles.headerRight}>
          <motion.button
            className={styles.toggleButton}
            onClick={() => setCompactView(!compactView)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {compactView ? <Eye size={16} /> : <EyeOff size={16} />}
            <span>{compactView ? 'Expand' : 'Compact'}</span>
          </motion.button>
        </div>
      </div>

      <div className={styles.content}>
        {/* Performance Metrics */}
        <motion.div 
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h4 className={styles.sectionTitle}>Performance Metrics</h4>
          <div className={styles.metricsGrid}>
            {performanceMetrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                className={styles.metricCard}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <div className={styles.metricHeader}>
                  <span className={styles.metricIcon} style={{ color: metric.color }}>
                    {metric.icon}
                  </span>
                  <span className={styles.metricLabel}>{metric.label}</span>
                </div>
                <div className={styles.metricValue} style={{ color: metric.color }}>
                  {metric.value.toFixed(0)}%
                </div>
                <div className={styles.progressBar}>
                  <motion.div 
                    className={styles.progressFill}
                    style={{ backgroundColor: metric.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.value}%` }}
                    transition={{ duration: 1, delay: index * 0.2 }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Altitude Chart */}
        <motion.div 
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h4 className={styles.sectionTitle}>
            <Gauge size={16} />
            Altitude History
          </h4>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={compactView ? 80 : 120}>
              <AreaChart data={altitudeData}>
                <defs>
                  <linearGradient id="altitudeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartTheme.primary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={chartTheme.primary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis hide />
                <YAxis hide />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke={chartTheme.primary} 
                  strokeWidth={2}
                  fill="url(#altitudeGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className={styles.chartValue}>
              {droneData.altitude.toFixed(1)} m
            </div>
          </div>
        </motion.div>

        {/* Speed Chart */}
        <motion.div 
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h4 className={styles.sectionTitle}>
            <Activity size={16} />
            Ground Speed
          </h4>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={compactView ? 80 : 120}>
              <LineChart data={speedData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis hide />
                <YAxis hide />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke={chartTheme.secondary} 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className={styles.chartValue}>
              {droneData.groundSpeed.toFixed(1)} m/s
            </div>
          </div>
        </motion.div>

        {/* Battery Chart */}
        <motion.div 
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h4 className={styles.sectionTitle}>
            <Battery size={16} />
            Battery Level
          </h4>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={compactView ? 80 : 120}>
              <AreaChart data={batteryData}>
                <defs>
                  <linearGradient id="batteryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={droneData.batteryLevel > 30 ? chartTheme.secondary : chartTheme.danger} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={droneData.batteryLevel > 30 ? chartTheme.secondary : chartTheme.danger} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis hide />
                <YAxis hide />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke={droneData.batteryLevel > 30 ? chartTheme.secondary : chartTheme.danger} 
                  strokeWidth={2}
                  fill="url(#batteryGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className={styles.chartValue} style={{ 
              color: droneData.batteryLevel > 30 ? chartTheme.secondary : chartTheme.danger 
            }}>
              {droneData.batteryLevel.toFixed(0)}%
            </div>
          </div>
        </motion.div>

        {/* Additional sections that show only in expanded view */}
        <AnimatePresence>
          {!compactView && (
            <>
              {/* System Status */}
              <motion.div 
                className={styles.section}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <h4 className={styles.sectionTitle}>System Status</h4>
                <div className={styles.statusGrid}>
                  <div className={styles.statusItem}>
                    <Thermometer size={14} />
                    <span className={styles.statusLabel}>Temperature</span>
                    <span className={`${styles.statusValue} ${droneData.temperature > 50 ? styles.warning : ''}`}>
                      {droneData.temperature.toFixed(1)}°C
                    </span>
                  </div>
                  
                  <div className={styles.statusItem}>
                    <Wind size={14} />
                    <span className={styles.statusLabel}>Wind Speed</span>
                    <span className={`${styles.statusValue} ${droneData.windSpeed > 15 ? styles.warning : ''}`}>
                      {droneData.windSpeed.toFixed(1)} m/s
                    </span>
                  </div>
                  
                  <div className={styles.statusItem}>
                    <Activity size={14} />
                    <span className={styles.statusLabel}>Current Draw</span>
                    <span className={`${styles.statusValue} ${droneData.current > 12 ? styles.warning : ''}`}>
                      {droneData.current.toFixed(1)} A
                    </span>
                  </div>
                  
                  <div className={styles.statusItem}>
                    <Gauge size={14} />
                    <span className={styles.statusLabel}>Throttle</span>
                    <span className={styles.statusValue}>
                      {droneData.throttle}%
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Flight Time Estimation */}
              <motion.div 
                className={styles.section}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, delay: 0.6 }}
              >
                <h4 className={styles.sectionTitle}>Flight Time Estimation</h4>
                <div className={styles.flightTimeContainer}>
                  <div className={styles.timeEstimate}>
                    <span className={styles.timeLabel}>Remaining</span>
                    <span className={styles.timeValue}>
                      {Math.floor((droneData.batteryLevel / 100) * 25)} min
                    </span>
                  </div>
                  <div className={styles.timeEstimate}>
                    <span className={styles.timeLabel}>To Home</span>
                    <span className={styles.timeValue}>
                      {Math.floor(droneData.homeDistance / (droneData.groundSpeed * 60))} min
                    </span>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FlightData;
