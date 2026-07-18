import { useState, useCallback } from 'react';
import MapView from './components/MapView';
import BottomPanel from './components/BottomPanel';
import SearchBar from './components/SearchBar';
import StartLights from './components/StartLights';

interface FlyToTarget {
  lat: number;
  lng: number;
  label: string;
}

function App() {
  const [flyTo, setFlyTo] = useState<FlyToTarget | null>(null);

  const handleSearchSelect = useCallback((lat: number, lng: number, label: string) => {
    setFlyTo({ lat, lng, label });
  }, []);

  const handleFlyComplete = useCallback(() => {
    setFlyTo(null);
  }, []);

  return (
    <div className="h-full w-full overflow-hidden bg-black">
      {/* Map - full screen */}
      <main className="absolute inset-0">
        <MapView flyTo={flyTo} onFlyComplete={handleFlyComplete} />
      </main>

      {/* Top bar with safe area */}
      <header
        className="absolute top-0 left-0 right-0 z-[900] flex items-center gap-3 px-4 select-none header-safe"
        style={{
          background: 'rgba(28, 28, 30, 0.72)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          height: '44px',
        }}
      >
        {/* App logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #BF5AF2, #0A84FF)' }}
          >
            <span className="text-[11px] font-black text-white">LT</span>
          </div>
          <h1 className="text-[14px] font-bold tracking-tight text-[var(--text-primary)] hidden sm:inline">
            LapTimer
          </h1>
        </div>

        {/* Search bar */}
        <SearchBar onSelect={handleSearchSelect} />

        {/* Version */}
        <span className="text-[11px] font-medium text-[var(--text-tertiary)] shrink-0 hidden sm:inline">v0.1</span>
      </header>

      {/* F1 starting lights overlay */}
      <StartLights />

      {/* Bottom glass panel — responsive */}
      <div
        className="absolute z-[900] rounded-3xl overflow-hidden bottom-panel"
        style={{
          background: 'rgba(28, 28, 30, 0.82)',
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.05) inset',
          left: 'max(12px, env(safe-area-inset-left, 0px) + 4px)',
          right: 'max(12px, env(safe-area-inset-right, 0px) + 4px)',
        }}
      >
        <div className="p-2.5 sm:p-4">
          <BottomPanel />
        </div>
      </div>
    </div>
  );
}

export default App;
