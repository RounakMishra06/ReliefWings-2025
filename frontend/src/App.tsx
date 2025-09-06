import React from 'react';
import './App.css'; 
import DroneDashboard from './components/DroneDashboard/DroneDashboard';

const App: React.FC = () => {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <DroneDashboard />
    </div>
  );
}

export default App;