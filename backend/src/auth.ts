/**
 * Authentication utilities for ReliefWings backend
 */
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export interface AuthPayload {
  userId: string;
  username: string;
  role: string;
  permissions: string[];
}

export class AuthManager {
  private jwtSecret: string;
  private jwtExpiresIn: string | number;
  
  constructor(jwtSecret: string, jwtExpiresIn: string | number = '7d') {
    this.jwtSecret = jwtSecret;
    this.jwtExpiresIn = jwtExpiresIn;
  }
  
  /**
   * Generate JWT token for user
   */
  generateToken(payload: AuthPayload): string {
    const options: SignOptions = {
      expiresIn: this.jwtExpiresIn as any
    };
    return jwt.sign(payload, this.jwtSecret, options);
  }
  
  /**
   * Verify JWT token
   */
  verifyToken(token: string): AuthPayload {
    return jwt.verify(token, this.jwtSecret) as AuthPayload;
  }
  
  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }
  
  /**
   * Verify password
   */
  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }
  
  /**
   * Check if user has required permission
   */
  hasPermission(userPermissions: string[], requiredPermission: string): boolean {
    return userPermissions.includes(requiredPermission) || userPermissions.includes('admin');
  }
  
  /**
   * Generate API key (for Pi clients)
   */
  generateApiKey(): string {
    return `rw_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
  }
}

/**
 * Middleware factory for Express route protection
 */
export function requireAuth(authManager: AuthManager, requiredPermission?: string) {
  return (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const apiKey = req.headers['x-api-key'];
    
    try {
      if (apiKey) {
        // API key authentication (for Pi clients or external integrations)
        if (apiKey === process.env.API_KEY_PI || apiKey === process.env.API_KEY_WEB) {
          req.auth = { apiKey, type: 'api_key' };
          return next();
        } else {
          return res.status(401).json({ error: 'Invalid API key' });
        }
      }
      
      if (token) {
        // JWT authentication
        const payload = authManager.verifyToken(token);
        
        // Check required permission if specified
        if (requiredPermission && !authManager.hasPermission(payload.permissions, requiredPermission)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        req.auth = { ...payload, type: 'jwt' };
        return next();
      }
      
      return res.status(401).json({ error: 'Authentication required' });
      
    } catch (error) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
  };
}

/**
 * Rate limiting configuration
 */
export const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
};
