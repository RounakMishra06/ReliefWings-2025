/**
 * PostgreSQL + Prisma Database Manager for ReliefWings
 * Replaces MongoDB implementation with production-ready PostgreSQL
 */
import { PrismaClient, Prisma, UserRole, DroneStatus, CommandStatus, MissionStatus, AlertSeverity } from '@prisma/client';
import type { 
  User, 
  Drone, 
  TelemetryData, 
  Command, 
  Mission, 
  Alert
} from '@prisma/client';
import winston from 'winston';

// Custom types for API interfaces
export interface TelemetryInput {
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

export interface CommandInput {
  type: string;
  command: string;
  args?: any;
  timestamp: number;
  source: string;
}

export interface CreateDroneInput {
  droneId: string;
  name: string;
  model: string;
  homeLocation: {
    lat: number;
    lon: number;
    alt: number;
  };
  configuration?: {
    maxAltitude?: number;
    maxSpeed?: number;
    batteryLowThreshold?: number;
  };
}

export interface CreateUserInput {
  username: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
  permissions?: string[];
}

export class DatabaseManager {
  private prisma: PrismaClient;
  private logger: winston.Logger;
  
  constructor(logger: winston.Logger, datasourceUrl?: string) {
    this.logger = logger;
    
    // Initialize Prisma with connection pooling and optimizations
    const prismaOptions: any = {
      errorFormat: 'pretty',
    };
    
    if (datasourceUrl) {
      prismaOptions.datasourceUrl = datasourceUrl;
    }
    
    this.prisma = new PrismaClient(prismaOptions);
  }
  
  async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      this.logger.info('PostgreSQL database connected successfully via Prisma');
      
      // Test the connection
      await this.prisma.$queryRaw`SELECT 1 as connection_test`;
      this.logger.info('Database connection test passed');
    } catch (error) {
      this.logger.error('Database connection failed:', error);
      throw error;
    }
  }
  
  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      this.logger.info('Database disconnected successfully');
    } catch (error) {
      this.logger.error('Error disconnecting from database:', error);
      throw error;
    }
  }
  
  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1 as health_check`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return false;
    }
  }
  
  /**
   * TELEMETRY DATA OPERATIONS
   */
  async saveTelemetry(data: TelemetryInput): Promise<TelemetryData> {
    try {
      // First, update drone status
      await this.updateDroneLastSeen(data.drone_id);
      
      // Save telemetry data
      const telemetry = await this.prisma.telemetryData.create({
        data: {
          type: data.type,
          version: data.version,
          droneId: data.drone_id,
          seq: data.seq,
          ts: BigInt(data.ts),
          gpsLat: data.gps.lat,
          gpsLon: data.gps.lon,
          gpsFixType: data.gps.fix_type,
          altRel: data.alt_rel,
          roll: data.attitude.roll,
          pitch: data.attitude.pitch,
          yaw: data.attitude.yaw,
          velX: data.vel[0] || 0,
          velY: data.vel[1] || 0,
          velZ: data.vel[2] || 0,
          batteryVoltage: data.battery.voltage,
          batteryCurrent: data.battery.current,
          batteryRemaining: data.battery.remaining,
          mode: data.mode,
          armed: data.armed,
          homeLocationLat: data.home_location.lat,
          homeLocationLon: data.home_location.lon,
        }
      });
      
      // Check for low battery alert
      if (data.battery.remaining < 20) {
        await this.createAlert(
          data.drone_id, 
          AlertSeverity.HIGH, 
          `Low battery warning: ${data.battery.remaining}%`,
          { battery: data.battery }
        );
      }
      
      return telemetry;
    } catch (error) {
      this.logger.error('Failed to save telemetry:', error);
      throw error;
    }
  }
  
  async getLatestTelemetry(droneId: string, limit: number = 10): Promise<TelemetryData[]> {
    try {
      return await this.prisma.telemetryData.findMany({
        where: { droneId },
        orderBy: { ts: 'desc' },
        take: limit,
      });
    } catch (error) {
      this.logger.error('Failed to get latest telemetry:', error);
      throw error;
    }
  }
  
  async getTelemetryInTimeRange(
    droneId: string, 
    startTime: Date, 
    endTime: Date,
    limit: number = 1000
  ): Promise<TelemetryData[]> {
    try {
      return await this.prisma.telemetryData.findMany({
        where: {
          droneId,
          receivedAt: {
            gte: startTime,
            lte: endTime,
          },
        },
        orderBy: { ts: 'desc' },
        take: limit,
      });
    } catch (error) {
      this.logger.error('Failed to get telemetry in time range:', error);
      throw error;
    }
  }
  
  /**
   * COMMAND OPERATIONS
   */
  async saveCommand(data: CommandInput & { droneId: string }): Promise<Command> {
    try {
      return await this.prisma.command.create({
        data: {
          droneId: data.droneId,
          type: data.type,
          command: data.command,
          args: data.args,
          source: data.source,
          timestamp: new Date(data.timestamp),
          status: CommandStatus.PENDING,
        }
      });
    } catch (error) {
      this.logger.error('Failed to save command:', error);
      throw error;
    }
  }
  
  async updateCommandStatus(
    commandId: string, 
    status: CommandStatus, 
    response?: any, 
    error?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
      };
      
      if (response !== undefined) {
        updateData.response = response;
      }
      
      if (error !== undefined) {
        updateData.error = error;
      }
      
      if (status !== CommandStatus.PENDING) {
        updateData.executedAt = new Date();
      }
      
      await this.prisma.command.update({
        where: { id: commandId },
        data: updateData
      });
    } catch (error) {
      this.logger.error('Failed to update command status:', error);
      throw error;
    }
  }
  
  async getPendingCommands(droneId: string): Promise<Command[]> {
    try {
      return await this.prisma.command.findMany({
        where: {
          droneId,
          status: CommandStatus.PENDING,
        },
        orderBy: { timestamp: 'asc' },
      });
    } catch (error) {
      this.logger.error('Failed to get pending commands:', error);
      throw error;
    }
  }
  
  /**
   * DRONE OPERATIONS
   */
  async createDrone(data: CreateDroneInput): Promise<Drone> {
    try {
      return await this.prisma.drone.create({
        data: {
          droneId: data.droneId,
          name: data.name,
          model: data.model,
          homeLocationLat: data.homeLocation.lat,
          homeLocationLon: data.homeLocation.lon,
          homeLocationAlt: data.homeLocation.alt,
          maxAltitude: data.configuration?.maxAltitude || 120,
          maxSpeed: data.configuration?.maxSpeed || 15,
          batteryLowThreshold: data.configuration?.batteryLowThreshold || 20,
        }
      });
    } catch (error) {
      this.logger.error('Failed to create drone:', error);
      throw error;
    }
  }
  
  async getDroneStatus(droneId: string): Promise<Drone | null> {
    try {
      return await this.prisma.drone.findUnique({
        where: { droneId },
        include: {
          _count: {
            select: {
              telemetryData: true,
              commands: true,
              missions: true,
              alerts: {
                where: { resolved: false }
              }
            }
          }
        }
      });
    } catch (error) {
      this.logger.error('Failed to get drone status:', error);
      throw error;
    }
  }
  
  async updateDroneLastSeen(droneId: string): Promise<void> {
    try {
      await this.prisma.drone.upsert({
        where: { droneId },
        update: {
          lastSeen: new Date(),
          status: DroneStatus.ONLINE,
        },
        create: {
          droneId,
          name: `Drone ${droneId}`,
          model: 'Unknown',
          homeLocationLat: 0,
          homeLocationLon: 0,
          homeLocationAlt: 0,
          status: DroneStatus.ONLINE,
          lastSeen: new Date(),
        }
      });
    } catch (error) {
      this.logger.error('Failed to update drone last seen:', error);
      throw error;
    }
  }
  
  async getAllDrones(): Promise<Drone[]> {
    try {
      return await this.prisma.drone.findMany({
        include: {
          _count: {
            select: {
              telemetryData: true,
              alerts: { where: { resolved: false } }
            }
          }
        },
        orderBy: { lastSeen: 'desc' }
      });
    } catch (error) {
      this.logger.error('Failed to get all drones:', error);
      throw error;
    }
  }
  
  /**
   * USER OPERATIONS
   */
  async createUser(data: CreateUserInput): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          username: data.username,
          email: data.email,
          passwordHash: data.passwordHash,
          role: data.role || UserRole.VIEWER,
          permissions: data.permissions || [],
        }
      });
    } catch (error) {
      this.logger.error('Failed to create user:', error);
      throw error;
    }
  }
  
  async getUserByUsername(username: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { username }
      });
    } catch (error) {
      this.logger.error('Failed to get user by username:', error);
      throw error;
    }
  }
  
  async updateUserLastLogin(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastLogin: new Date() }
      });
    } catch (error) {
      this.logger.error('Failed to update user last login:', error);
      throw error;
    }
  }
  
  /**
   * ALERT OPERATIONS
   */
  async createAlert(
    droneId: string, 
    severity: AlertSeverity, 
    message: string, 
    data?: any
  ): Promise<Alert> {
    try {
      const alert = await this.prisma.alert.create({
        data: {
          droneId,
          severity,
          message,
          data: data || {},
        }
      });
      
      this.logger.warn(`Alert created for drone ${droneId}: ${severity} - ${message}`);
      return alert;
    } catch (error) {
      this.logger.error('Failed to create alert:', error);
      throw error;
    }
  }
  
  async getUnresolvedAlerts(droneId?: string): Promise<Alert[]> {
    try {
      const whereClause: any = {
        resolved: false,
      };
      
      if (droneId) {
        whereClause.droneId = droneId;
      }
      
      return await this.prisma.alert.findMany({
        where: whereClause,
        include: {
          drone: {
            select: { name: true, droneId: true }
          }
        },
        orderBy: [
          { severity: 'desc' },
          { timestamp: 'desc' }
        ]
      });
    } catch (error) {
      this.logger.error('Failed to get unresolved alerts:', error);
      throw error;
    }
  }
  
  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    try {
      await this.prisma.alert.update({
        where: { id: alertId },
        data: {
          resolved: true,
          resolvedBy,
          resolvedAt: new Date(),
        }
      });
    } catch (error) {
      this.logger.error('Failed to resolve alert:', error);
      throw error;
    }
  }
  
  /**
   * ANALYTICS & REPORTING
   */
  async getDroneStatistics(droneId: string, hours: number = 24): Promise<any> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const [telemetryCount, avgBattery, flightTime, alerts] = await Promise.all([
        this.prisma.telemetryData.count({
          where: { droneId, receivedAt: { gte: since } }
        }),
        this.prisma.telemetryData.aggregate({
          where: { droneId, receivedAt: { gte: since } },
          _avg: { batteryRemaining: true }
        }),
        this.prisma.telemetryData.aggregate({
          where: { droneId, receivedAt: { gte: since }, armed: true },
          _count: true
        }),
        this.prisma.alert.count({
          where: { droneId, timestamp: { gte: since } }
        })
      ]);
      
      return {
        telemetryPoints: telemetryCount,
        averageBattery: avgBattery._avg.batteryRemaining,
        estimatedFlightTime: Math.round((flightTime._count * 50) / 1000 / 60), // Rough estimate in minutes
        alertCount: alerts,
        periodHours: hours,
      };
    } catch (error) {
      this.logger.error('Failed to get drone statistics:', error);
      throw error;
    }
  }
  
  // Clean up old telemetry data (useful for maintenance)
  async cleanupOldTelemetry(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
      
      const result = await this.prisma.telemetryData.deleteMany({
        where: {
          receivedAt: { lt: cutoffDate }
        }
      });
      
      this.logger.info(`Cleaned up ${result.count} old telemetry records`);
      return result.count;
    } catch (error) {
      this.logger.error('Failed to cleanup old telemetry:', error);
      throw error;
    }
  }
}

// Export types for use in other modules
export type {
  User,
  Drone,
  TelemetryData,
  Command,
  Mission,
  Alert,
  UserRole,
  DroneStatus,
  CommandStatus,
  MissionStatus,
  AlertSeverity
};
