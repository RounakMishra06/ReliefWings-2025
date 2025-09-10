import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Power, 
  PowerOff, 
  ArrowUp, 
  Home, 
  RotateCcw, 
  Pause, 
  Play, 
  AlertTriangle,
  Settings 
} from 'lucide-react';
import styles from './ControlBar.module.css';

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

interface ControlBarProps {
  droneData: DroneData;
  isConnected: boolean;
  onCommand: (command: string, args?: any, droneId?: string) => void;
}

const ControlBar: React.FC<ControlBarProps> = ({ 
  droneData, 
  isConnected, 
  onCommand 
}) => {
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [takeoffAltitude, setTakeoffAltitude] = useState<number>(10);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleCommand = (command: string, args?: any) => {
    if (['ARM', 'TAKEOFF', 'RTL', 'LAND'].includes(command)) {
      // Critical commands require confirmation
      if (confirmAction === command) {
        onCommand(command, args);
        setConfirmAction(null);
      } else {
        setConfirmAction(command);
        // Auto-clear confirmation after 5 seconds
        setTimeout(() => setConfirmAction(null), 5000);
      }
    } else {
      onCommand(command, args);
    }
  };

  const getButtonStyle = (command: string, baseStyle: string) => {
    if (!isConnected) {
      return `${baseStyle} ${styles.disabled}`;
    }
    if (confirmAction === command) {
      return `${baseStyle} ${styles.confirm}`;
    }
    return baseStyle;
  };

  const getButtonText = (command: string, defaultText: string) => {
    if (confirmAction === command) {
      return `Confirm ${defaultText}?`;
    }
    return defaultText;
  };

  const canArm = () => {
    return isConnected && 
           !droneData.armStatus && 
           droneData.gpsSignal > 50 && 
           droneData.batteryLevel > 15;
  };

  const canTakeoff = () => {
    return isConnected && 
           droneData.armStatus && 
           droneData.altitude < 2 && 
           droneData.gpsSignal > 70;
  };

  const canLand = () => {
    return isConnected && 
           droneData.armStatus && 
           droneData.altitude > 2;
  };

  return (
    <div className={styles.controlBar}>
      {/* Primary Controls */}
      <div className={styles.primaryControls}>
        {/* ARM/DISARM */}
        <motion.button
          className={getButtonStyle('ARM', 
            droneData.armStatus ? styles.disarmButton : styles.armButton
          )}
          disabled={!isConnected || (!canArm() && !droneData.armStatus)}
          onClick={() => handleCommand(droneData.armStatus ? 'DISARM' : 'ARM')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {droneData.armStatus ? <PowerOff size={18} /> : <Power size={18} />}
          <span>
            {getButtonText(
              droneData.armStatus ? 'DISARM' : 'ARM',
              droneData.armStatus ? 'DISARM' : 'ARM'
            )}
          </span>
        </motion.button>

        {/* TAKEOFF */}
        <div className={styles.takeoffControl}>
          <motion.button
            className={getButtonStyle('TAKEOFF', styles.takeoffButton)}
            disabled={!canTakeoff()}
            onClick={() => handleCommand('TAKEOFF', { altitude: takeoffAltitude })}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowUp size={18} />
            <span>{getButtonText('TAKEOFF', 'TAKEOFF')}</span>
          </motion.button>
          
          <input
            type="number"
            className={styles.altitudeInput}
            value={takeoffAltitude}
            onChange={(e) => setTakeoffAltitude(Number(e.target.value))}
            min="5"
            max="100"
            step="5"
            disabled={!isConnected}
          />
          <span className={styles.altitudeLabel}>m</span>
        </div>

        {/* RTL (Return to Launch) */}
        <motion.button
          className={getButtonStyle('RTL', styles.rtlButton)}
          disabled={!isConnected || !droneData.armStatus}
          onClick={() => handleCommand('RTL')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Home size={18} />
          <span>{getButtonText('RTL', 'RTL')}</span>
        </motion.button>

        {/* LAND */}
        <motion.button
          className={getButtonStyle('LAND', styles.landButton)}
          disabled={!canLand()}
          onClick={() => handleCommand('LAND')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowUp size={18} style={{ transform: 'rotate(180deg)' }} />
          <span>{getButtonText('LAND', 'LAND')}</span>
        </motion.button>
      </div>

      {/* Flight Mode Controls */}
      <div className={styles.flightModeControls}>
        <span className={styles.sectionLabel}>Flight Mode:</span>
        
        {['MANUAL', 'STABILIZE', 'ALT_HOLD', 'LOITER', 'AUTO', 'GUIDED'].map(mode => (
          <motion.button
            key={mode}
            className={`${styles.modeButton} ${
              droneData.flightMode === mode ? styles.activeMode : ''
            }`}
            disabled={!isConnected || !droneData.armStatus}
            onClick={() => handleCommand('SET_MODE', { mode })}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {mode.replace('_', ' ')}
          </motion.button>
        ))}
      </div>

      {/* Status Indicators */}
      <div className={styles.statusIndicators}>
        <div className={styles.statusGroup}>
          <div className={`${styles.statusIndicator} ${
            isConnected ? styles.statusGood : styles.statusBad
          }`}>
            <div className={styles.statusDot} />
            <span>COMM</span>
          </div>
          
          <div className={`${styles.statusIndicator} ${
            droneData.gpsSignal > 70 ? styles.statusGood : 
            droneData.gpsSignal > 40 ? styles.statusWarning : styles.statusBad
          }`}>
            <div className={styles.statusDot} />
            <span>GPS</span>
          </div>
          
          <div className={`${styles.statusIndicator} ${
            droneData.batteryLevel > 30 ? styles.statusGood : 
            droneData.batteryLevel > 15 ? styles.statusWarning : styles.statusBad
          }`}>
            <div className={styles.statusDot} />
            <span>BAT</span>
          </div>
          
          <div className={`${styles.statusIndicator} ${
            droneData.armStatus ? styles.statusArmed : styles.statusDisarmed
          }`}>
            <div className={styles.statusDot} />
            <span>ARM</span>
          </div>
        </div>
      </div>

      {/* Advanced Controls Toggle */}
      <div className={styles.advancedToggle}>
        <motion.button
          className={styles.advancedButton}
          onClick={() => setShowAdvanced(!showAdvanced)}
          whileHover={{ scale: 1.05 }}
        >
          <Settings size={18} />
          <span>Advanced</span>
        </motion.button>
      </div>

      {/* Advanced Controls Panel */}
      {showAdvanced && (
        <motion.div
          className={styles.advancedControls}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className={styles.advancedSection}>
            <span className={styles.sectionLabel}>Emergency:</span>
            
            <motion.button
              className={styles.emergencyButton}
              onClick={() => handleCommand('EMERGENCY_STOP')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <AlertTriangle size={16} />
              <span>E-STOP</span>
            </motion.button>
            
            <motion.button
              className={styles.emergencyButton}
              onClick={() => handleCommand('KILL_MOTORS')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <PowerOff size={16} />
              <span>KILL</span>
            </motion.button>
          </div>

          <div className={styles.advancedSection}>
            <span className={styles.sectionLabel}>Calibration:</span>
            
            <motion.button
              className={styles.calibrationButton}
              onClick={() => handleCommand('CALIBRATE_COMPASS')}
              disabled={!isConnected || droneData.armStatus}
              whileHover={{ scale: 1.05 }}
            >
              <RotateCcw size={16} />
              <span>Compass</span>
            </motion.button>
            
            <motion.button
              className={styles.calibrationButton}
              onClick={() => handleCommand('CALIBRATE_ACCEL')}
              disabled={!isConnected || droneData.armStatus}
              whileHover={{ scale: 1.05 }}
            >
              <Settings size={16} />
              <span>Accel</span>
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Confirmation Banner */}
      {confirmAction && (
        <motion.div
          className={styles.confirmationBanner}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          <AlertTriangle size={18} />
          <span>Click {confirmAction} again to confirm</span>
          <button 
            className={styles.cancelButton}
            onClick={() => setConfirmAction(null)}
          >
            Cancel
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default ControlBar;