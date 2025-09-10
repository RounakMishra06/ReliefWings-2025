import { WebSocketServer, WebSocket } from "ws";
import { createClient } from "redis";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import winston from "winston";
import { DatabaseManager, type TelemetryInput, type CommandInput } from "./database.js";
import { AuthManager, requireAuth } from "./auth.js";

// Load environment variables
dotenv.config();

// Configure Winston logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'relief-wings-backend' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ],
});

interface TelemetryData {
    type: string;
    version: number;
    drone_id: string;
    seq: number;
    ts: number;
    gps: {
        lat: number;
        lon: number;
        fix_type: number;
    };
    alt_rel: number;
    attitude: {
        roll: number;
        pitch: number;
        yaw: number;
    };
    vel: number[];
    battery: {
        voltage: number;
        current: number;
        remaining: number;
    };
    mode: string;
    armed: boolean;
    home_location: {
        lat: number;
        lon: number;
    };
}

interface CommandData {
    type: string;
    command: string;
    args?: any;
    timestamp: number;
    source: string;
}

interface WebSocketConnection {
    ws: WebSocket;
    channels: string[];
    clientType: 'web' | 'pi';
    authenticated: boolean;
    userId?: string;
    droneId?: string;
}

class ReliefWingsServer {
    private redisSubscribedRooms = new Set<string>();
    private publishClient: any;
    private subscribeClient: any;
    private database: DatabaseManager;
    private authManager: AuthManager;
    private wss!: WebSocketServer;
    private app!: express.Application;
    private subscriptions: { [id: string]: WebSocketConnection } = {};
    
    constructor() {
        this.database = new DatabaseManager(logger, process.env.DATABASE_URL);
        this.authManager = new AuthManager(
            process.env.JWT_SECRET || 'your-secret-key',
            process.env.JWT_EXPIRES_IN || '7d'
        );
        this.setupExpress();
        this.setupWebSocket();
    }
    
    private setupExpress() {
        this.app = express();
        
        // Security middleware
        this.app.use(helmet());
        this.app.use(cors({
            origin: process.env.CORS_ORIGIN || "http://localhost:5173",
            credentials: true
        }));
        this.app.use(express.json({ limit: '10mb' }));
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });
        
        // Command API endpoint for web clients
        this.app.post('/api/command', this.authenticateRequest.bind(this), (req, res) => {
            const { command, args, drone_id } = req.body;
            
            if (!command || !drone_id) {
                return res.status(400).json({ error: 'Missing command or drone_id' });
            }
            
            const commandData: CommandData = {
                type: 'command',
                command,
                args: args || {},
                timestamp: Date.now(),
                source: 'web_api'
            };
            
            // Forward command to drone via WebSocket
            this.forwardCommandToDrone(drone_id, commandData);
            
            // Log command to database
            this.logCommand(drone_id, commandData);
            
            res.json({ 
                success: true, 
                message: 'Command sent to drone',
                command_id: randomUUID()
            });
        });
        
        // Get telemetry history
        this.app.get('/api/telemetry/:drone_id', this.authenticateRequest.bind(this), async (req, res) => {
            try {
                const { drone_id } = req.params;
                const { limit = 100, skip = 0 } = req.query;
                
                const telemetry = await this.database.getLatestTelemetry(
                    drone_id, 
                    parseInt(limit as string)
                );
                
                res.json({ success: true, data: telemetry });
            } catch (error) {
                logger.error('Error fetching telemetry:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
        
        // Get command history
        this.app.get('/api/commands/:drone_id', this.authenticateRequest.bind(this), async (req, res) => {
            try {
                const { drone_id } = req.params;
                const { limit = 50, skip = 0 } = req.query;
                
                const commands = await this.database.getPendingCommands(drone_id);
                
                res.json({ success: true, data: commands });
            } catch (error) {
                logger.error('Error fetching commands:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
    }
    
    private setupWebSocket() {
        interface VerifyClientInfo {
            origin: string;
            secure: boolean;
            req: import("http").IncomingMessage;
        }

        interface WebSocketServerOptions {
            port: number;
            verifyClient: (info: VerifyClientInfo) => boolean;
        }

        this.wss = new WebSocketServer({ 
            port: parseInt(process.env.WS_PORT || '8081'),
            verifyClient: (info: VerifyClientInfo): boolean => {
            // Basic verification - you can add more sophisticated auth here
            return true;
            }
        } as WebSocketServerOptions);
        
        logger.info(`WebSocket server started on port ${process.env.WS_PORT || 8081}`);
        
        this.wss.on("connection", (ws: WebSocket, request) => {
            const id = randomUUID();
            this.subscriptions[id] = { 
                ws, 
                channels: [], 
                clientType: 'web',
                authenticated: false
            };
            
            logger.info(`Client connected: ${id}`);
            
            ws.on("message", async (data) => {
                await this.handleWebSocketMessage(id, data.toString());
            });
            
            ws.on("close", () => {
                this.handleClientDisconnect(id);
            });
            
            ws.on("error", (error) => {
                logger.error(`WebSocket error for client ${id}:`, error);
                this.handleClientDisconnect(id);
            });
        });
    }
    
    private async handleWebSocketMessage(clientId: string, message: string) {
        try {
            const parsedMessage = JSON.parse(message);
            const type = parsedMessage.type;
            const client = this.subscriptions[clientId];
            
            if (!client) return;
            
            switch (type) {
                case "AUTH":
                    await this.handleAuthentication(clientId, parsedMessage);
                    break;
                    
                case "SUBSCRIBE":
                    if (client.authenticated) {
                        await this.handleSubscribe(clientId, parsedMessage);
                    } else {
                        this.sendError(clientId, "Authentication required");
                    }
                    break;
                    
                case "UNSUBSCRIBE":
                    if (client.authenticated) {
                        await this.handleUnsubscribe(clientId, parsedMessage);
                    }
                    break;
                    
                case "SEND_MESSAGE":
                    if (client.authenticated) {
                        await this.handleSendMessage(clientId, parsedMessage);
                    } else {
                        this.sendError(clientId, "Authentication required");
                    }
                    break;
                    
                default:
                    logger.warn(`Unknown message type: ${type}`);
            }
        } catch (error) {
            logger.error(`Error handling WebSocket message from ${clientId}:`, error);
            this.sendError(clientId, "Invalid message format");
        }
    }
    
    private async handleAuthentication(clientId: string, message: any) {
        const { token, apiKey, clientType } = message;
        const client = this.subscriptions[clientId];
        
        if (!client) return;
        
        try {
            if (apiKey) {
                // API Key authentication (for Pi clients)
                if (apiKey === process.env.API_KEY_PI && clientType === 'pi') {
                    client.authenticated = true;
                    client.clientType = 'pi';
                    client.droneId = message.drone_id;
                    this.sendSuccess(clientId, "Authentication successful", { clientType: 'pi' });
                } else if (apiKey === process.env.API_KEY_WEB && clientType === 'web') {
                    client.authenticated = true;
                    client.clientType = 'web';
                    this.sendSuccess(clientId, "Authentication successful", { clientType: 'web' });
                } else {
                    this.sendError(clientId, "Invalid API key");
                    return;
                }
            } else if (token) {
                // JWT authentication (for web clients)
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
                client.authenticated = true;
                client.clientType = 'web';
                client.userId = decoded.userId;
                this.sendSuccess(clientId, "Authentication successful", { clientType: 'web', userId: decoded.userId });
            } else {
                this.sendError(clientId, "Missing authentication credentials");
            }
        } catch (error) {
            logger.error(`Authentication error for client ${clientId}:`, error);
            this.sendError(clientId, "Authentication failed");
        }
    }
    
    private async handleSubscribe(clientId: string, message: any) {
        const channel = message.channel;
        const client = this.subscriptions[clientId];
        
        if (!client || !client.authenticated) return;
        
        // Validate channel permissions
        if (!this.validateChannelAccess(client, channel)) {
            this.sendError(clientId, "Access denied to channel");
            return;
        }
        
        if (!client.channels.includes(channel)) {
            client.channels.push(channel);
        }
        
        if (this.atLeastOneUserConnected(channel)) {
            logger.info(`Client ${clientId} subscribed to channel: ${channel}`);
            
            if (!this.redisSubscribedRooms.has(channel)) {
                this.redisSubscribedRooms.add(channel);
                await this.subscribeClient.subscribe(channel, (message: string) => {
                    this.broadcastToChannel(channel, message);
                });
            }
        }
    }
    
    private async handleUnsubscribe(clientId: string, message: any) {
        const channel = message.channel;
        const client = this.subscriptions[clientId];
        
        if (!client) return;
        
        client.channels = client.channels.filter((c) => c !== channel);
        
        if (this.noOneIsConnected(channel)) {
            logger.info(`Client ${clientId} unsubscribed from channel: ${channel}`);
            await this.subscribeClient.unsubscribe(channel);
            this.redisSubscribedRooms.delete(channel);
        }
    }
    
    private async handleSendMessage(clientId: string, message: any) {
        const roomId = message.channel;
        const messageData = message.message;
        const client = this.subscriptions[clientId];
        
        if (!client || !client.authenticated) return;
        
        // Validate channel permissions
        if (!this.validateChannelAccess(client, roomId)) {
            this.sendError(clientId, "Access denied to channel");
            return;
        }
        
        logger.info(`Client ${clientId} sent message to channel ${roomId}`);
        
        // Handle telemetry data
        if (messageData.type === 'telemetry') {
            await this.processTelemetryData(messageData as TelemetryData);
        }
        
        // Handle command ACK
        if (messageData.type === 'command_ack') {
            await this.processCommandAck(messageData);
        }
        
        // Broadcast to Redis
        await this.publishClient.publish(roomId, JSON.stringify({
            type: "SEND_MESSAGE",
            channelId: roomId,
            message: messageData,
            timestamp: Date.now(),
            clientId: clientId
        }));
    }
    
    private validateChannelAccess(client: WebSocketConnection, channel: string): boolean {
        // Web clients can access UI channels
        if (client.clientType === 'web' && channel.startsWith('/ws/ui')) {
            return true;
        }
        
        // Pi clients can access Pi channels
        if (client.clientType === 'pi' && channel.startsWith('/ws/pi')) {
            return true;
        }
        
        // Pi clients can also send to UI channels (telemetry)
        if (client.clientType === 'pi' && channel.startsWith('/ws/ui')) {
            return true;
        }
        
        return false;
    }
    
    private async processTelemetryData(telemetry: TelemetryData) {
        try {
            // Add server timestamp
            // Store in PostgreSQL database
            await this.database.saveTelemetry(telemetry as TelemetryInput);
            
            logger.debug(`Stored telemetry for drone ${telemetry.drone_id}, seq ${telemetry.seq}`);
        } catch (error) {
            logger.error('Error storing telemetry:', error);
        }
    }
    
    private async processCommandAck(ackData: any) {
        try {
            // Note: Command acknowledgment can be implemented later if needed
            // For now, we just log the acknowledgment
            logger.debug(`Command acknowledgment received: ${JSON.stringify(ackData)}`);
            
            logger.info(`Command ACK processed: ${ackData.command}`);
        } catch (error) {
            logger.error('Error processing command ACK:', error);
        }
    }
    
    private async logCommand(droneId: string, commandData: CommandData) {
        try {
            await this.database.saveCommand({
                ...commandData,
                droneId: droneId,
            });
            logger.info(`Logged command: ${commandData.command} for drone ${droneId}`);
        } catch (error) {
            logger.error('Error logging command:', error);
        }
    }
    
    private forwardCommandToDrone(droneId: string, commandData: CommandData) {
        const piChannel = '/ws/pi';
        const message = {
            type: "SEND_MESSAGE",
            channelId: piChannel,
            message: commandData,
            timestamp: Date.now(),
            targetDrone: droneId
        };
        
        // Broadcast command to Pi clients
        this.publishClient.publish(piChannel, JSON.stringify(message));
    }
    
    private broadcastToChannel(channel: string, message: string) {
        try {
            const parsed = JSON.parse(message);
            const { channelId, message: msg } = parsed;
            
            Object.entries(this.subscriptions).forEach(([uid, client]) => {
                if (client.channels.includes(channelId) && client.ws.readyState === WebSocket.OPEN) {
                    client.ws.send(JSON.stringify({
                        type: "RECIEVER_MESSAGE",
                        channel: channelId,
                        message: msg
                    }));
                }
            });
        } catch (error) {
            logger.error('Error broadcasting to channel:', error);
        }
    }
    
    private sendSuccess(clientId: string, message: string, data?: any) {
        const client = this.subscriptions[clientId];
        if (client && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({
                type: "SUCCESS",
                message,
                data
            }));
        }
    }
    
    private sendError(clientId: string, error: string) {
        const client = this.subscriptions[clientId];
        if (client && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({
                type: "ERROR",
                error
            }));
        }
    }
    
    private handleClientDisconnect(clientId: string) {
        const client = this.subscriptions[clientId];
        if (client) {
            // Unsubscribe from all channels
            client.channels.forEach(async (channel) => {
                if (this.noOneIsConnected(channel)) {
                    await this.subscribeClient.unsubscribe(channel);
                    this.redisSubscribedRooms.delete(channel);
                }
            });
            
            delete this.subscriptions[clientId];
            logger.info(`Client disconnected: ${clientId}`);
        }
    }
    
    private authenticateRequest(req: any, res: any, next: any) {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const apiKey = req.headers['x-api-key'];
        
        try {
            if (apiKey && apiKey === process.env.API_KEY_WEB) {
                next();
            } else if (token) {
                jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
                next();
            } else {
                res.status(401).json({ error: 'Authentication required' });
            }
        } catch (error) {
            res.status(401).json({ error: 'Invalid authentication' });
        }
    }
    
    private atLeastOneUserConnected(roomId: string): boolean {
        return Object.values(this.subscriptions).some(sub => sub.channels.includes(roomId));
    }
    
    private noOneIsConnected(roomId: string): boolean {
        return !Object.values(this.subscriptions).some(sub => sub.channels.includes(roomId));
    }
    
    async initialize() {
        try {
            // Initialize Redis clients
            this.publishClient = createClient({
                url: process.env.REDIS_URL || "redis://localhost:6379"
            });
            await this.publishClient.connect();
            
            this.subscribeClient = createClient({
                url: process.env.REDIS_URL || "redis://localhost:6379"
            });
            await this.subscribeClient.connect();
            
            logger.info("Redis clients connected");
            
            // Initialize PostgreSQL database via Prisma
            await this.database.connect();
            logger.info("PostgreSQL database connected via Prisma");
            
            // Start Express server
            const port = parseInt(process.env.PORT || '3001');
            this.app.listen(port, () => {
                logger.info(`HTTP server started on port ${port}`);
            });
            
            logger.info("ReliefWings Server fully initialized");
            
        } catch (error) {
            logger.error("Failed to initialize server:", error);
            process.exit(1);
        }
    }
    
    async shutdown() {
        logger.info("Shutting down ReliefWings Server");
        
        // Close WebSocket server
        this.wss.close();
        
        // Close Redis clients
        if (this.publishClient) await this.publishClient.quit();
        if (this.subscribeClient) await this.subscribeClient.quit();
        
        // Close Database connection
        await this.database.disconnect();
        
        logger.info("Server shutdown complete");
    }
}

// Initialize and start server
const server = new ReliefWingsServer();

process.on('SIGTERM', async () => {
    await server.shutdown();
    process.exit(0);
});

process.on('SIGINT', async () => {
    await server.shutdown();
    process.exit(0);
});

server.initialize().catch((error) => {
    logger.error("Failed to start server:", error);
    process.exit(1);
});