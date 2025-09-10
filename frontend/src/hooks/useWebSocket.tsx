import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface TelemetryData {
  type: 'telemetry';
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
  vel: [number, number, number];
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

export interface CommandAck {
  type: 'command_ack';
  command: string;
  args: any;
  result: {
    success: boolean;
    message?: string;
    error?: string;
  };
  timestamp: number;
}

export interface WebSocketContextType {
  isConnected: boolean;
  latestTelemetry: TelemetryData | null;
  telemetryHistory: TelemetryData[];
  commandAcks: CommandAck[];
  sendCommand: (command: string, args?: any, droneId?: string) => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
  url?: string;
  apiKey?: string;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ 
  children, 
  url = 'ws://localhost:8081',
  apiKey = 'web-client-api-key-change-in-production'
}) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [latestTelemetry, setLatestTelemetry] = useState<TelemetryData | null>(null);
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryData[]>([]);
  const [commandAcks, setCommandAcks] = useState<CommandAck[]>([]);
  const [subscribedChannels, setSubscribedChannels] = useState<Set<string>>(new Set());
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 5;
  const reconnectInterval = 3000;

  const connect = useCallback(() => {
    if (ws?.readyState === WebSocket.CONNECTING || ws?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');
    console.log('Attempting to connect to WebSocket...');
    
    const websocket = new WebSocket(url);

    websocket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setConnectionStatus('connected');
      setReconnectAttempts(0);
      
      // Authenticate
      websocket.send(JSON.stringify({
        type: 'AUTH',
        apiKey: apiKey,
        clientType: 'web'
      }));
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    websocket.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      
      // Attempt to reconnect if not manually closed
      if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
        setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          connect();
        }, reconnectInterval);
      } else if (reconnectAttempts >= maxReconnectAttempts) {
        setConnectionStatus('error');
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('error');
    };

    setWs(websocket);
  }, [url, apiKey, reconnectAttempts]);

  const handleMessage = (data: any) => {
    switch (data.type) {
      case 'SUCCESS':
        console.log('Authentication successful:', data.message);
        // Auto-subscribe to telemetry channel
        subscribe('/ws/ui');
        break;
        
      case 'ERROR':
        console.error('WebSocket error:', data.error);
        break;
        
      case 'RECIEVER_MESSAGE':
        const message = data.message;
        
        if (message.type === 'telemetry') {
          const telemetry = message as TelemetryData;
          setLatestTelemetry(telemetry);
          
          // Add to history (keep last 1000 records)
          setTelemetryHistory(prev => {
            const updated = [telemetry, ...prev];
            return updated.slice(0, 1000);
          });
        } else if (message.type === 'command_ack') {
          const ack = message as CommandAck;
          setCommandAcks(prev => {
            const updated = [ack, ...prev];
            return updated.slice(0, 100); // Keep last 100 ACKs
          });
        } else if (message.type === 'heartbeat') {
          console.debug('Heartbeat received from drone:', message.drone_id);
        }
        break;
        
      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const subscribe = useCallback((channel: string) => {
    if (ws?.readyState === WebSocket.OPEN && !subscribedChannels.has(channel)) {
      ws.send(JSON.stringify({
        type: 'SUBSCRIBE',
        channel: channel
      }));
      setSubscribedChannels(prev => new Set(prev).add(channel));
      console.log('Subscribed to channel:', channel);
    }
  }, [ws, subscribedChannels]);

  const unsubscribe = useCallback((channel: string) => {
    if (ws?.readyState === WebSocket.OPEN && subscribedChannels.has(channel)) {
      ws.send(JSON.stringify({
        type: 'UNSUBSCRIBE',
        channel: channel
      }));
      setSubscribedChannels(prev => {
        const updated = new Set(prev);
        updated.delete(channel);
        return updated;
      });
      console.log('Unsubscribed from channel:', channel);
    }
  }, [ws, subscribedChannels]);

  const sendCommand = useCallback((command: string, args: any = {}, droneId: string = 'drone-01') => {
    if (ws?.readyState === WebSocket.OPEN) {
      const commandMessage = {
        type: 'SEND_MESSAGE',
        channel: '/ws/pi',
        message: {
          type: 'command',
          command,
          args,
          drone_id: droneId,
          timestamp: Date.now(),
          source: 'web_dashboard'
        }
      };
      
      ws.send(JSON.stringify(commandMessage));
      console.log('Command sent:', command, args);
    } else {
      console.error('WebSocket not connected. Cannot send command.');
    }
  }, [ws]);

  useEffect(() => {
    connect();
    
    return () => {
      if (ws) {
        ws.close(1000, 'Component unmounting');
      }
    };
  }, [connect]);

  // Resubscribe to channels when reconnecting
  useEffect(() => {
    if (isConnected && subscribedChannels.size > 0) {
      subscribedChannels.forEach(channel => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'SUBSCRIBE',
            channel: channel
          }));
        }
      });
    }
  }, [isConnected, ws, subscribedChannels]);

  const value: WebSocketContextType = {
    isConnected,
    latestTelemetry,
    telemetryHistory,
    commandAcks,
    sendCommand,
    subscribe,
    unsubscribe,
    connectionStatus
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
