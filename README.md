# ReliefWings 2025 - Autonomous Drone Relief System

A comprehensive drone telemetry and control system designed for disaster relief operations, featuring real-time data transmission, autonomous flight capabilities, and emergency response coordination.

## 🚁 System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Raspberry Pi  │    │   Backend       │    │   Frontend      │
│   (Python)      │◄──►│   (Node.js)     │◄──►│   (React)       │
│                 │    │                 │    │                 │
│ • DroneKit      │    │ • WebSocket     │    │ • Real-time UI  │
│ • MAVLink       │    │ • Authentication│    │ • Drone Control │
│ • Telemetry     │    │ • MongoDB       │    │ • Telemetry     │
│ • Commands      │    │ • Redis Pub/Sub │    │ • Live Map      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        ▲                       ▲                       
        │                       │                       
        ▼                       ▼                       
┌─────────────────┐    ┌─────────────────┐              
│   Pixhawk FC    │    │   Redis Cache   │              
│   (Hardware)    │    │   MongoDB       │              
└─────────────────┘    └─────────────────┘
Pixhawk ↔ Raspberry Pi (Python/DroneKit)
                ↓ WebSocket (Secure, JSON protocol)
        Node.js Server (WSS + Redis + MongoDB)
                ↓ WebSocket (/ws/ui)
        React Web Dashboard (Live Telemetry + Commands)
```

## 📋 Features

### 🚁 Drone Telemetry (1-5 Hz)
- ✅ GPS position, altitude, velocity
- ✅ Battery level, voltage, current
- ✅ Attitude (roll, pitch, yaw)
- ✅ Flight mode, armed status
- ✅ Home location, distance to home
- ✅ Sequence numbers, timestamps

### 🎮 Command & Control
- ✅ ARM/DISARM with safety checks
- ✅ TAKEOFF with altitude setting
- ✅ RTL (Return to Launch)
- ✅ LAND command
- ✅ Flight mode changes (MANUAL, STABILIZE, AUTO, etc.)
- ✅ Emergency stop & motor kill
- ✅ Calibration commands

### 📡 Communication
- ✅ Bidirectional WebSocket messaging
- ✅ Command ACK system
- ✅ Heartbeat monitoring (5s interval)
- ✅ Automatic reconnection
- ✅ Offline data buffering (SQLite)

### 🛡️ Safety & Reliability  
- ✅ GPS lock verification
- ✅ Battery level checks
- ✅ Home location validation
- ✅ Command confirmation system
- ✅ Connection status monitoring
- ✅ Real-time alerts

### 📊 Web Dashboard
- ✅ Live GPS map with drone position
- ✅ Real-time telemetry graphs
- ✅ Battery & system status panels
- ✅ Flight control interface
- ✅ Alert notifications
- ✅ Command history & ACK status

### 🗄️ Data Management
- ✅ MongoDB telemetry logging (30-day TTL)
- ✅ Command history tracking
- ✅ Redis pub/sub messaging
- ✅ SQLite offline buffering
- ✅ User authentication (JWT/API keys)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Python 3.8+
- Redis server
- MongoDB (optional - for logging)
- MAVProxy/SITL (for testing)

### 1. Clone and Install
```bash
git clone <repository>
cd ReliefWings-2025

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies  
cd ../frontend && npm install

# Install Python dependencies (creates virtual env)
cd ../python
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install dronekit websocket-client aiofiles
```

### 2. Start Services
```bash
# Start Redis (Ubuntu/Debian)
sudo service redis-server start

# Start MongoDB (optional)
sudo service mongod start
```

### 3. Run the System

**Option A: Development (3 terminals)**
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend  
cd frontend && npm run dev

# Terminal 3: Python drone client
cd python && python main.py
```

**Option B: DroneKit SITL Testing**
```bash
# Terminal 1: Start SITL
mavproxy.py --master tcp:127.0.0.1:5760 --sitl localhost:5501 --out 127.0.0.1:14550 --out 127.0.0.1:14551

# Terminal 2: Backend
cd backend && WEBSOCKET_URL=ws://localhost:8081 npm run dev

# Terminal 3: Frontend
cd frontend && npm run dev

# Terminal 4: Python client (connect to SITL)
cd python && DRONE_CONNECTION=tcp:127.0.0.1:14550 python main.py
```

### 4. Access Dashboard
Open http://localhost:5173 in your browser

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```bash
PORT=3001
WS_PORT=8081
REDIS_URL=redis://localhost:6379
MONGODB_URI=mongodb://localhost:27017/reliefwings
JWT_SECRET=your-secret-key
API_KEY_WEB=web-client-api-key
API_KEY_PI=pi-client-api-key
```

**Python**
```bash
DRONE_CONNECTION=/dev/ttyUSB0          # or tcp:127.0.0.1:14550 for SITL
WEBSOCKET_URL=ws://localhost:8081
DRONE_ID=drone-01
```

### Hardware Setup (Raspberry Pi)
1. Connect Pixhawk to Pi via USB/UART
2. Install DroneKit: `pip install dronekit`
3. Set connection string: `/dev/ttyUSB0` or `/dev/serial0`
4. Configure WiFi for WebSocket connection
5. Run: `python main.py`

## 📡 API Endpoints

### WebSocket Channels
- `/ws/ui` - Web dashboard telemetry
- `/ws/pi` - Raspberry Pi commands

### REST API  
- `POST /api/command` - Send drone commands
- `GET /api/telemetry/:drone_id` - Get telemetry history
- `GET /api/commands/:drone_id` - Get command history
- `GET /health` - Health check

### Message Format
```typescript
// Telemetry
{
  "type": "telemetry",
  "version": 1,
  "drone_id": "drone-01", 
  "seq": 1234,
  "ts": 1694646400123,
  "gps": {"lat": 12.34, "lon": 77.45, "fix_type": 3},
  "alt_rel": 12.5,
  "attitude": {"roll": 0.01, "pitch": -0.02, "yaw": 1.5},
  "vel": [0.0, 0.0, -0.1],
  "battery": {"voltage": 11.9, "current": 1.2, "remaining": 82}
}

// Command
{
  "type": "command",
  "command": "ARM",
  "args": {"altitude": 10},
  "timestamp": 1694646400123
}
```

## 🛠️ Development

### Project Structure
```
ReliefWings-2025/
├── python/           # Raspberry Pi drone client
│   ├── main.py      # DroneKit telemetry client
│   └── requirements.txt
├── backend/         # Node.js server
│   ├── src/
│   │   ├── server.ts    # WebSocket + Express server
│   │   ├── database.ts  # MongoDB models
│   │   └── auth.ts      # Authentication
│   └── package.json
├── frontend/        # React dashboard
│   ├── src/
│   │   ├── hooks/useWebSocket.tsx
│   │   └── components/
│   └── package.json
└── README.md
```

### Adding New Commands
1. Update Python `execute_command()` method
2. Add command validation in backend
3. Update frontend ControlBar component
4. Test with SITL before hardware

### Telemetry Schema Updates
1. Modify Python `get_telemetry_data()`
2. Update TypeScript `TelemetryData` interface
3. Update dashboard components
4. Consider MongoDB index changes

## 🔒 Security

- ✅ JWT authentication for web clients
- ✅ API key authentication for Pi clients  
- ✅ WSS (secure WebSocket) in production
- ✅ Command validation and safety checks
- ✅ Rate limiting and CORS protection
- ✅ Input sanitization

## 📊 Monitoring

### Logs
- Backend: `logs/combined.log`, `logs/error.log`
- Python: `/tmp/drone_telemetry.log`
- Frontend: Browser console

### Health Checks
- WebSocket connection status
- Telemetry data freshness
- Command ACK monitoring
- Database connectivity

## 🚨 Troubleshooting

### Common Issues

**1. No Telemetry Data**
- Check drone connection string
- Verify Pixhawk is powered and connected
- Check Python logs: `tail -f /tmp/drone_telemetry.log`
- Test with SITL first

**2. WebSocket Connection Failed**
- Verify backend is running on port 8081
- Check firewall settings
- Confirm Redis is running
- Check browser console for errors

**3. Commands Not Working**
- Ensure drone is properly armed
- Check GPS lock status
- Verify battery level > 15%
- Check command ACK in dashboard

**4. SITL Testing**
```bash
# Install SITL
pip install mavproxy

# Start SITL
mavproxy.py --master tcp:127.0.0.1:5760 --sitl localhost:5501 --out 127.0.0.1:14550

# Connect Python client
DRONE_CONNECTION=tcp:127.0.0.1:14550 python main.py
```

### Performance Tips
- Use Redis for high-frequency telemetry
- MongoDB TTL indexes for log rotation
- WebSocket compression for bandwidth
- SQLite for offline resilience

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Test with SITL simulation
4. Submit pull request

## 📄 License

MIT License - see LICENSE file

## 🙏 Acknowledgments

- DroneKit Python - MAVLink communication
- ArduPilot - Flight controller software
- React Leaflet - Interactive mapping
- Framer Motion - UI animations

---

**⚠️ Safety Notice**: Always follow local regulations for drone operations. Test thoroughly in simulation before hardware deployment. Ensure proper failsafe configurations.


# SITL explore