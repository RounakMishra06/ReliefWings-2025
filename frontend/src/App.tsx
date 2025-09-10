import React from 'react';
import './App.css'; 
import DroneDashboard from './components/DroneDashboard/DroneDashboard';
import { WebSocketProvider } from './hooks/useWebSocket';

const App: React.FC = () => {
  return (
    <WebSocketProvider 
      url="ws://localhost:8081"
      apiKey="web-client-api-key-change-in-production"
    >
      <div style={{ width: '100vw', height: '100vh' }}>
        <DroneDashboard />
      </div>
    </WebSocketProvider>
  );
}

export default App;