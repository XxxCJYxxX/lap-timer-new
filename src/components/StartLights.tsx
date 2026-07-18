import { useTimerStore } from '../stores/timerStore';

export default function StartLights() {
  const lightPhase = useTimerStore((s) => s.lightPhase);

  if (lightPhase === 'idle') return null;

  const active = lightPhase === 'go'
    ? 0
    : parseInt(lightPhase.replace('light', ''));

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center pointer-events-none"
      style={{ background: 'rgba(0,0,0,0.9)' }}
    >
      <div className="flex gap-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="relative">
            <div
              className="absolute inset-0 rounded-full blur-md transition-all duration-300"
              style={{
                background: '#FF453A',
                opacity: n <= active ? 0.5 : 0,
                transform: 'scale(1.4)',
              }}
            />
            <div
              className="w-11 h-11 sm:w-14 sm:h-14 rounded-full transition-all duration-200 relative"
              style={{
                background: n <= active
                  ? 'radial-gradient(circle at 40% 35%, #FF6B6B, #CC0000 60%, #660000)'
                  : 'rgba(255,255,255,0.04)',
                border: n <= active
                  ? '2px solid #FF453A'
                  : '2px solid rgba(255,255,255,0.08)',
                boxShadow: n <= active
                  ? '0 0 24px rgba(255,69,58,0.6), inset 0 2px 4px rgba(255,255,255,0.1)'
                  : 'none',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
