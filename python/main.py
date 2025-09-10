#!/usr/bin/env python3
"""
ReliefWings Drone Telemetry System
Raspberry Pi Component - Fetches telemetry from Pixhawk via MAVLink using DroneKit
Streams telemetry in real-time to Node.js server over Wi-Fi using WebSockets
"""

import dronekit
import websocket
import json
import threading
import time
import sqlite3
import os
import logging
from datetime import datetime
from typing import Dict, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/drone_telemetry.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class DroneKitTelemetryClient:
    def __init__(self, 
                 connection_string: str = "/dev/ttyUSB0",
                 websocket_url: str = "ws://localhost:8081",
                 drone_id: str = "drone-01"):
        self.connection_string = connection_string
        self.websocket_url = websocket_url
        self.drone_id = drone_id
        self.vehicle: Optional[dronekit.Vehicle] = None
        self.ws: Optional[websocket.WebSocketApp] = None
        self.running = False
        self.sequence_number = 0
        self.last_heartbeat = time.time()
        
        # Initialize SQLite buffer for offline storage
        self.init_database()
        
    def init_database(self):
        """Initialize SQLite database for offline telemetry buffering"""
        self.db_path = "/tmp/drone_telemetry.db"
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                drone_id TEXT NOT NULL,
                seq INTEGER NOT NULL,
                data TEXT NOT NULL,
                sent BOOLEAN DEFAULT FALSE
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS commands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                command TEXT NOT NULL,
                args TEXT,
                executed BOOLEAN DEFAULT FALSE,
                result TEXT
            )
        ''')
        
        conn.commit()
        conn.close()
        logger.info("Database initialized successfully")
    
    def connect_to_drone(self):
        """Connect to Pixhawk via DroneKit/pymavlink"""
        try:
            logger.info(f"Connecting to drone on {self.connection_string}")
            self.vehicle = dronekit.connect(self.connection_string, wait_ready=True, timeout=60)
            logger.info("Successfully connected to drone!")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to drone: {e}")
            return False
    
    def get_telemetry_data(self) -> Dict[str, Any]:
        """Fetch current telemetry data from drone"""
        if not self.vehicle:
            return {}
        
        try:
            # Get GPS data
            gps_data = {}
            if self.vehicle.gps_0:
                gps_data = {
                    "lat": float(self.vehicle.location.global_relative_frame.lat or 0),
                    "lon": float(self.vehicle.location.global_relative_frame.lon or 0),
                    "fix_type": int(self.vehicle.gps_0.fix_type or 0)
                }
            
            # Get attitude data
            attitude_data = {}
            if self.vehicle.attitude:
                attitude_data = {
                    "roll": float(self.vehicle.attitude.roll or 0),
                    "pitch": float(self.vehicle.attitude.pitch or 0), 
                    "yaw": float(self.vehicle.attitude.yaw or 0)
                }
            
            # Get velocity data
            velocity_data = [0.0, 0.0, 0.0]
            if self.vehicle.velocity:
                velocity_data = [
                    float(self.vehicle.velocity[0] or 0),
                    float(self.vehicle.velocity[1] or 0),
                    float(self.vehicle.velocity[2] or 0)
                ]
            
            # Get battery data
            battery_data = {}
            if self.vehicle.battery:
                battery_data = {
                    "voltage": float(self.vehicle.battery.voltage or 0),
                    "current": float(self.vehicle.battery.current or 0),
                    "remaining": int(self.vehicle.battery.level or 0)
                }
            
            # Get altitude
            altitude = float(self.vehicle.location.global_relative_frame.alt or 0)
            
            telemetry = {
                "type": "telemetry",
                "version": 1,
                "drone_id": self.drone_id,
                "seq": self.sequence_number,
                "ts": int(time.time() * 1000),  # milliseconds
                "gps": gps_data,
                "alt_rel": altitude,
                "attitude": attitude_data,
                "vel": velocity_data,
                "battery": battery_data,
                "mode": str(self.vehicle.mode.name if self.vehicle.mode else "UNKNOWN"),
                "armed": bool(self.vehicle.armed if hasattr(self.vehicle, 'armed') else False),
                "home_location": {
                    "lat": float(self.vehicle.home_location.lat if self.vehicle.home_location else 0),
                    "lon": float(self.vehicle.home_location.lon if self.vehicle.home_location else 0)
                }
            }
            
            self.sequence_number += 1
            return telemetry
            
        except Exception as e:
            logger.error(f"Error fetching telemetry: {e}")
            return {}
    
    def buffer_telemetry(self, data: Dict[str, Any]):
        """Buffer telemetry data to SQLite when offline"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO telemetry (timestamp, drone_id, seq, data)
                VALUES (?, ?, ?, ?)
            ''', (
                datetime.now().isoformat(),
                data.get('drone_id', self.drone_id),
                data.get('seq', 0),
                json.dumps(data)
            ))
            
            conn.commit()
            conn.close()
            logger.debug(f"Buffered telemetry seq {data.get('seq')}")
        except Exception as e:
            logger.error(f"Error buffering telemetry: {e}")
    
    def send_buffered_data(self):
        """Send buffered telemetry when connection is restored"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('SELECT id, data FROM telemetry WHERE sent = FALSE ORDER BY id LIMIT 100')
            rows = cursor.fetchall()
            
            for row_id, data_json in rows:
                if self.ws and self.ws.sock and self.ws.sock.connected:
                    try:
                        data = json.loads(data_json)
                        message = {
                            "type": "SEND_MESSAGE",
                            "channel": "/ws/pi",
                            "message": data
                        }
                        self.ws.send(json.dumps(message))
                        
                        # Mark as sent
                        cursor.execute('UPDATE telemetry SET sent = TRUE WHERE id = ?', (row_id,))
                        conn.commit()
                        
                        time.sleep(0.01)  # Small delay to avoid flooding
                    except Exception as e:
                        logger.error(f"Error sending buffered data: {e}")
                        break
                else:
                    break
            
            conn.close()
            logger.info(f"Sent {len(rows)} buffered telemetry records")
        except Exception as e:
            logger.error(f"Error sending buffered data: {e}")
    
    def execute_command(self, command: str, args: Dict[str, Any] = None) -> Dict[str, Any]:
        """Execute drone commands with safety checks"""
        if not self.vehicle:
            return {"success": False, "error": "No drone connection"}
        
        try:
            logger.info(f"Executing command: {command} with args: {args}")
            
            # Safety checks
            if not self.safety_check():
                return {"success": False, "error": "Safety check failed"}
            
            result = {"success": False, "error": "Unknown command"}
            
            if command == "ARM":
                if self.vehicle.mode.name != "GUIDED":
                    self.vehicle.mode = dronekit.VehicleMode("GUIDED")
                    time.sleep(2)
                
                self.vehicle.armed = True
                while not self.vehicle.armed:
                    time.sleep(1)
                result = {"success": True, "message": "Vehicle armed"}
                
            elif command == "DISARM":
                self.vehicle.armed = False
                result = {"success": True, "message": "Vehicle disarmed"}
                
            elif command == "SET_MODE":
                mode = args.get("mode", "GUIDED")
                self.vehicle.mode = dronekit.VehicleMode(mode)
                result = {"success": True, "message": f"Mode set to {mode}"}
                
            elif command == "TAKEOFF":
                altitude = args.get("altitude", 10)
                if self.vehicle.armed:
                    self.vehicle.simple_takeoff(altitude)
                    result = {"success": True, "message": f"Taking off to {altitude}m"}
                else:
                    result = {"success": False, "error": "Vehicle not armed"}
                    
            elif command == "RTL":
                self.vehicle.mode = dronekit.VehicleMode("RTL")
                result = {"success": True, "message": "Returning to launch"}
            
            # Log command execution
            self.log_command(command, args, result)
            return result
            
        except Exception as e:
            error_msg = f"Command execution failed: {e}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}
    
    def safety_check(self) -> bool:
        """Perform safety checks before command execution"""
        if not self.vehicle:
            return False
        
        # Check GPS lock
        if not self.vehicle.gps_0 or self.vehicle.gps_0.fix_type < 3:
            logger.warning("GPS fix not adequate for safe operation")
            return False
        
        # Check battery level
        if self.vehicle.battery and self.vehicle.battery.level < 20:
            logger.warning("Battery level too low for safe operation")
            return False
        
        # Check if home location is set
        if not self.vehicle.home_location:
            logger.warning("Home location not set")
            return False
        
        return True
    
    def log_command(self, command: str, args: Dict[str, Any], result: Dict[str, Any]):
        """Log command execution to database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO commands (timestamp, command, args, executed, result)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                datetime.now().isoformat(),
                command,
                json.dumps(args or {}),
                result.get("success", False),
                json.dumps(result)
            ))
            
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Error logging command: {e}")
    
    # WebSocket event handlers
    def on_ws_message(self, ws, message):
        """Handle incoming WebSocket messages (commands from web)"""
        try:
            data = json.loads(message)
            if data.get("type") == "RECIEVER_MESSAGE":
                command_data = data.get("message", {})
                
                if command_data.get("type") == "command":
                    command = command_data.get("command")
                    args = command_data.get("args", {})
                    
                    # Execute command in separate thread to avoid blocking
                    threading.Thread(
                        target=self.handle_command,
                        args=(command, args),
                        daemon=True
                    ).start()
                    
        except Exception as e:
            logger.error(f"Error processing WebSocket message: {e}")
    
    def handle_command(self, command: str, args: Dict[str, Any]):
        """Handle command execution and send ACK back"""
        result = self.execute_command(command, args)
        
        # Send ACK back to Node server
        ack_message = {
            "type": "SEND_MESSAGE",
            "channel": "/ws/ui",
            "message": {
                "type": "command_ack",
                "command": command,
                "args": args,
                "result": result,
                "timestamp": int(time.time() * 1000)
            }
        }
        
        if self.ws:
            try:
                self.ws.send(json.dumps(ack_message))
                logger.info(f"Sent ACK for command {command}: {result}")
            except Exception as e:
                logger.error(f"Error sending ACK: {e}")
    
    def on_ws_error(self, ws, error):
        logger.error(f"WebSocket error: {error}")
    
    def on_ws_close(self, ws, close_status_code, close_msg):
        logger.info("WebSocket connection closed")
    
    def on_ws_open(self, ws):
        logger.info("WebSocket connection established")
        
        # Subscribe to command channel
        subscribe_message = {
            "type": "SUBSCRIBE",
            "channel": "/ws/pi"
        }
        ws.send(json.dumps(subscribe_message))
        
        # Send buffered data if any
        threading.Thread(target=self.send_buffered_data, daemon=True).start()
    
    def connect_websocket(self):
        """Connect to WebSocket server"""
        try:
            self.ws = websocket.WebSocketApp(
                self.websocket_url,
                on_open=self.on_ws_open,
                on_message=self.on_ws_message,
                on_error=self.on_ws_error,
                on_close=self.on_ws_close
            )
            
            # Run WebSocket in separate thread
            threading.Thread(
                target=self.ws.run_forever,
                kwargs={"reconnect": 5},
                daemon=True
            ).start()
            
            return True
        except Exception as e:
            logger.error(f"WebSocket connection failed: {e}")
            return False
    
    def send_heartbeat(self):
        """Send heartbeat every 5 seconds"""
        while self.running:
            try:
                if self.ws and self.ws.sock and self.ws.sock.connected:
                    heartbeat = {
                        "type": "SEND_MESSAGE",
                        "channel": "/ws/pi",
                        "message": {
                            "type": "heartbeat",
                            "drone_id": self.drone_id,
                            "timestamp": int(time.time() * 1000),
                            "status": "alive"
                        }
                    }
                    self.ws.send(json.dumps(heartbeat))
                    self.last_heartbeat = time.time()
                
                time.sleep(5)  # Heartbeat every 5 seconds
                
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
                time.sleep(5)
    
    def telemetry_loop(self):
        """Main telemetry streaming loop at 1-5 Hz"""
        while self.running:
            try:
                telemetry = self.get_telemetry_data()
                
                if telemetry:
                    # Try to send via WebSocket
                    if self.ws and self.ws.sock and self.ws.sock.connected:
                        try:
                            message = {
                                "type": "SEND_MESSAGE",
                                "channel": "/ws/ui", 
                                "message": telemetry
                            }
                            self.ws.send(json.dumps(message))
                            logger.debug(f"Sent telemetry seq {telemetry.get('seq')}")
                        except Exception as e:
                            logger.warning(f"Failed to send telemetry, buffering: {e}")
                            self.buffer_telemetry(telemetry)
                    else:
                        # Buffer when offline
                        self.buffer_telemetry(telemetry)
                
                time.sleep(0.2)  # 5 Hz telemetry rate
                
            except Exception as e:
                logger.error(f"Telemetry loop error: {e}")
                time.sleep(1)
    
    def start(self):
        """Start the telemetry client"""
        logger.info("Starting DroneKit Telemetry Client")
        self.running = True
        
        # Connect to drone
        if not self.connect_to_drone():
            logger.error("Failed to connect to drone. Exiting.")
            return False
        
        # Connect to WebSocket
        self.connect_websocket()
        
        # Wait a moment for WebSocket connection
        time.sleep(2)
        
        # Start heartbeat thread
        heartbeat_thread = threading.Thread(target=self.send_heartbeat, daemon=True)
        heartbeat_thread.start()
        
        # Start main telemetry loop
        try:
            self.telemetry_loop()
        except KeyboardInterrupt:
            logger.info("Shutting down...")
            self.stop()
        
        return True
    
    def stop(self):
        """Stop the telemetry client"""
        logger.info("Stopping telemetry client")
        self.running = False
        
        if self.ws:
            self.ws.close()
        
        if self.vehicle:
            self.vehicle.close()

def main():
    """Main function"""
    # Configuration - can be overridden via environment variables
    connection_string = os.getenv("DRONE_CONNECTION", "/dev/ttyUSB0")  # or "tcp:127.0.0.1:5762" for SITL
    websocket_url = os.getenv("WEBSOCKET_URL", "ws://localhost:8081")
    drone_id = os.getenv("DRONE_ID", "drone-01")
    
    client = DroneKitTelemetryClient(
        connection_string=connection_string,
        websocket_url=websocket_url,
        drone_id=drone_id
    )
    
    client.start()

if __name__ == "__main__":
    main()

