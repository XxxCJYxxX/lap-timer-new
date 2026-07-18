import { useEffect, useRef, useState } from 'react';
import { useRouteStore } from '../stores/routeStore';
import { useTimerStore } from '../stores/timerStore';
import { useRecordsStore } from '../stores/recordStore';
import { useLocationStore } from '../stores/locationStore';
import { toStorageCoords } from '../utils/coord';
import { COLOR_MAP } from '../utils/color';
import { downloadRoute } from '../utils/routeIO';
import { encodePolyline, decodePolyline } from '../utils/seedcode';
import { db } from '../db/db';
import type { RecordColor } from '../types';

type Tab = 'routes' | 'timer' | 'records';

/* ── Format helpers ── */
function formatTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  const hh = String(hours).padStart(2, '0');
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const xxx = String(millis).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${xxx}`;
}

function formatTimeShort(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function getRecordColor(records: { timeMs: number; id?: number }[], record: { timeMs: number; id?: number }): RecordColor {
  const times = records.map((r) => r.timeMs);
  const pb = Math.min(...times);
  const idx = records.findIndex((r) => r.id === record.id);
  if (idx === -1) return null;
  if (record.timeMs === pb) return 'purple';
  const prev = records[idx + 1];
  if (prev && record.timeMs < prev.timeMs) return 'green';
  if (prev && record.timeMs > prev.timeMs) return 'yellow';
  return null;
}

export default function BottomPanel() {
  const [tab, setTab] = useState<Tab>('timer');

  // Route store
  const {
    routes, activeRouteId, isCreating, createStep,
    draftWaypoints,
    loadRoutes, setActiveRoute, startCreate, saveRoute, cancelCreate, deleteRoute,
    undoWaypoint, setFinish, reverseRoute,
  } = useRouteStore();

  // Timer store
  const { status, elapsed, lastRecord, lastRecordColor, autoMode, autoPhase, distanceToTarget, currentSpeed, maxSpeed, lightPhase, splits, weather, stop, tick, reset, toggleAutoMode, beginStartSequence, captureSplit } = useTimerStore();
  const { lat: gpsLat, lng: gpsLng } = useLocationStore();

  // Records store
  const { records, loadRecords, deleteRecord } = useRecordsStore();

  // Route creation state
  const [routeName, setRouteName] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [seedInput, setSeedInput] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  useEffect(() => {
    if (activeRouteId) loadRecords(activeRouteId);
  }, [activeRouteId, loadRecords]);

  // rAF timer tick
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (status !== 'running') return;
    const loop = () => { tick(); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [status, tick]);

  // Focus name input
  useEffect(() => {
    if (createStep === 'naming' && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [createStep]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    const { parseRouteFile } = await import('../utils/routeIO');
    const parsed = parseRouteFile(text);
    if (parsed) {
      const id = await db.routes.add({ name: parsed.name, waypoints: parsed.waypoints, createdAt: Date.now() });
      loadRoutes(); setActiveRoute(id); setTab('timer');
    } else alert('文件格式不正确');
    e.target.value = '';
  };

  const importSeed = async (code: string) => {
    if (!code.trim()) return;
    try {
      const wps = decodePolyline(code.trim());
      if (wps.length < 2) { alert('无效的种子码'); return; }
      const id = await db.routes.add({ name: `导入路线 ${new Date().toLocaleDateString()}`, waypoints: wps, createdAt: Date.now() });
      setSeedInput('');
      loadRoutes(); setActiveRoute(id); setTab('timer');
    } catch { alert('种子码格式错误'); }
  };

  const handleSaveRoute = () => {
    const name = routeName.trim();
    if (!name) return;
    saveRoute(name);
    setRouteName('');
    setTab('timer');
  };

  const activeRoute = routes.find((r) => r.id === activeRouteId);
  const colorMeta = lastRecordColor ? COLOR_MAP[lastRecordColor] : null;
  const pb = records.length > 0 ? Math.min(...records.map((r) => r.timeMs)) : null;

  return (
    <>
      {/* Segmented control */}
      <div className="flex justify-center mb-2">
        <div className="segmented">
          {([
            { key: 'routes', label: '路线' },
            { key: 'timer', label: '计时' },
            { key: 'records', label: '记录' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              className={tab === key ? 'active' : ''}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Routes Tab ── */}
      {tab === 'routes' && (
        <div className="space-y-2 custom-scrollbar max-h-[min(340px,38vh)] overflow-y-auto">
          {/* Route actions */}
          {!isCreating && (
            <div className="space-y-2">
              <div className="flex justify-between items-center gap-2">
                <span className="text-[13px] font-medium text-[var(--text-secondary)]">{routes.length} 条路线</span>
                <div className="flex gap-1.5">
                  <button onClick={startCreate} className="btn btn-sm btn-primary">+ 新建</button>
                </div>
              </div>
              {/* Seed code + import */}
              <div className="flex gap-1.5 items-center">
                <input
                  type="text"
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  placeholder="粘贴种子码导入…"
                  className="input-apple h-8 text-[12px]"
                  onKeyDown={(e) => { if (e.key === 'Enter') importSeed(seedInput); }}
                />
                <input ref={fileInputRef} type="file" accept=".json,.laproute.json" onChange={handleImport} className="hidden" />
                {seedInput.trim() ? (
                  <button onClick={() => importSeed(seedInput)} className="btn btn-sm btn-primary shrink-0" title="导入种子">
                    ⬇ 导入
                  </button>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()} className="btn btn-sm btn-ghost shrink-0" title="导入JSON文件">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v8M3 7l4 4 4-4M1 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Creation flow */}
          {isCreating && (
            <div className="p-3 rounded-2xl space-y-2" style={{ background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.2)' }}>
              {createStep === 'adding_points' && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                    <span className="text-[13px] text-[var(--accent)] font-medium">
                      点击地图添加航点（{draftWaypoints.length} 个）
                    </span>
                  </div>
                  {/* Use current location */}
                  {gpsLat !== null && gpsLng !== null && (
                    <button
                      onClick={() => {
                        const [wlng, wlat] = toStorageCoords(gpsLng, gpsLat);
                        useRouteStore.getState().addWaypoint(wlng, wlat);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[12px] font-medium"
                      style={{ background: 'rgba(10,132,255,0.12)', color: 'var(--accent)' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="7" cy="7" r="0.8" fill="currentColor"/><path d="M7 1v2.5M7 10.5V13M1 7h2.5M10.5 7H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                      使用当前位置添加航点
                    </button>
                  )}
                  <div className="flex gap-2">
                    <button onClick={undoWaypoint} disabled={draftWaypoints.length === 0} className="btn btn-sm btn-ghost flex-1 disabled:opacity-30">
                      ↩ 撤销
                    </button>
                    <button onClick={setFinish} disabled={draftWaypoints.length < 2} className="btn btn-sm btn-primary flex-1 disabled:opacity-40">
                      🏁 设为终点
                    </button>
                  </div>
                </>
              )}
              {createStep === 'naming' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--green)]" />
                    <span className="text-[13px] font-medium text-[var(--text-primary)]">{draftWaypoints.length} 个航点已设置</span>
                  </div>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveRoute()}
                    placeholder="路线名称"
                    className="input-apple"
                    maxLength={30}
                  />
                  <div className="flex gap-2">
                    <button onClick={cancelCreate} className="btn btn-sm btn-ghost flex-1">取消</button>
                    <button onClick={handleSaveRoute} disabled={!routeName.trim()} className="btn btn-sm btn-primary flex-1 disabled:opacity-40 disabled:pointer-events-none">
                      保存路线
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Route list */}
          <div className="space-y-1">
            {routes.map((route) => (
              <div
                key={route.id}
                onClick={() => { setActiveRoute(route.id!); setTab('timer'); }}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all route-item ${
                  activeRouteId === route.id ? 'active border' : 'border-transparent'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[15px] font-medium leading-tight truncate">{route.name}</div>
                  <div className="text-[12px] text-[var(--text-tertiary)]">
                    {new Date(route.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadRoute(route); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full active:bg-[rgba(255,255,255,0.12)]"
                    style={{ color: 'var(--text-tertiary)' }}
                    title="导出JSON"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v8M3 7l4 4 4-4M1 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); reverseRoute(route.id!); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full active:bg-[rgba(255,255,255,0.12)]"
                    style={{ color: 'var(--text-tertiary)' }}
                    title="反跑"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2l4 4-4 4M13 6H1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`删除"${route.name}"？`)) deleteRoute(route.id!);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full active:bg-[rgba(255,69,58,0.18)]"
                    style={{ color: 'var(--text-tertiary)' }}
                    title="删除"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                  {/* 复制种子码 — 最右侧常驻 */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const code = encodePolyline(route.waypoints);
                      try {
                        await navigator.clipboard.writeText(code);
                      } catch {
                        const ta = document.createElement('textarea');
                        ta.value = code;
                        document.body.appendChild(ta); ta.select();
                        document.execCommand('copy'); document.body.removeChild(ta);
                      }
                      setCopiedId(route.id!);
                      setTimeout(() => setCopiedId(null), 1500);
                    }}
                    className="h-8 px-2.5 flex items-center justify-center gap-1 rounded-full text-[11px] font-medium shrink-0"
                    style={{
                      background: copiedId === route.id ? 'rgba(48,209,88,0.18)' : 'rgba(10,132,255,0.14)',
                      color: copiedId === route.id ? 'var(--green)' : 'var(--accent)',
                    }}
                    title="复制种子码"
                  >
                    {copiedId === route.id ? (
                      <>✓ 已复制</>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="3" y="3" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1 10V3a2 2 0 012-2h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        种子
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {routes.length === 0 && !isCreating && (
            <p className="text-center text-[13px] text-[var(--text-tertiary)] py-8">点击"+ 新建路线"创建第一条</p>
          )}
        </div>
      )}

      {/* ── Timer Tab ── */}
      {tab === 'timer' && (
        <div className="space-y-2">
          {!activeRoute ? (
            <div className="text-center py-8">
              <div className="text-[40px] mb-2">🏎️</div>
              <p className="text-[15px] text-[var(--text-secondary)]">请先在"路线"中选择或创建路线</p>
            </div>
          ) : (
            <>
              {/* Route badge + weather */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full min-w-0" style={{ background: 'rgba(191,90,242,0.1)' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-purple)] shrink-0" />
                  <span className="text-[12px] font-medium truncate" style={{ color: 'var(--accent-purple)' }}>
                    {activeRoute.name}
                  </span>
                </div>
                {weather && (
                  <span className="text-[11px] shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                    {weather.weatherDesc} {weather.temp}° 💨{weather.windSpeed}
                  </span>
                )}
              </div>

              {/* Timer display */}
              <div className="text-center">
                <div
                  style={{
                    fontFamily: "'SF Mono', 'Menlo', 'Courier New', monospace",
                    fontSize: 'clamp(34px, 9vw, 52px)',
                    lineHeight: 1.05,
                    color: status === 'running' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {formatTime(elapsed)}
                </div>
                <div className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-widest">
                  {status === 'idle' ? '就绪' : status === 'running' ? '计时中' : '已停止'}
                </div>
              </div>

              {/* Speed — compact */}
              {status === 'running' && currentSpeed !== null && (
                <div className="flex items-center justify-center gap-4">
                  <div className="speed-gauge" style={{ width: 56, height: 56 }}>
                    <svg viewBox="0 0 72 72" width="56" height="56">
                      <circle className="speed-gauge-ring" cx="36" cy="36" r="30" />
                      <circle
                        className="speed-gauge-fill"
                        cx="36" cy="36" r="30"
                        strokeDasharray={`${Math.min(currentSpeed / 200 * 188.5, 188.5)} 188.5`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="tabular-nums text-[16px] font-bold leading-none text-[var(--text-primary)]">
                        {Math.round(currentSpeed)}
                      </span>
                      <span className="text-[8px] font-medium text-[var(--text-tertiary)] leading-tight">km/h</span>
                    </div>
                  </div>
                  {maxSpeed !== null && (
                    <div className="text-center">
                      <div className="text-[9px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">最高</div>
                      <div className="flex items-baseline justify-center gap-0.5" style={{ color: 'var(--accent)' }}>
                        <span className="tabular-nums text-[18px] font-bold leading-none">{Math.round(maxSpeed)}</span>
                        <span className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>km/h</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Auto mode toggle */}
              <button
                onClick={toggleAutoMode}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all"
                style={{
                  background: autoMode ? 'rgba(10,132,255,0.15)' : 'rgba(118,118,128,0.08)',
                  border: autoMode ? '1px solid rgba(10,132,255,0.3)' : '1px solid transparent',
                }}
              >
                <span style={{ color: autoMode ? 'var(--accent)' : 'var(--text-secondary)' }}>⏱ 自动启停</span>
                <div
                  className="w-9 h-5 rounded-full transition-colors relative"
                  style={{ background: autoMode ? 'var(--accent)' : 'rgba(118,118,128,0.4)' }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                    style={{ left: autoMode ? 'calc(100% - 18px)' : '2px' }}
                  />
                </div>
              </button>

              {/* Auto phase indicator */}
              {autoMode && (
                <div className="flex items-center justify-center gap-1.5">
                  {autoPhase === 'waiting_start' && (
                    <span className="text-[11px] text-[var(--text-tertiary)]">
                      📍 靠近发车点以自动启表
                      {distanceToTarget !== null && (
                        <span className="tabular-nums ml-1" style={{ color: distanceToTarget < 20 ? 'var(--green)' : 'var(--text-secondary)' }}>
                          {Math.round(distanceToTarget)} m
                        </span>
                      )}
                    </span>
                  )}
                  {autoPhase === 'leaving_start' && (
                    <span className="text-[11px] text-[var(--text-tertiary)]">
                      🚀 已发车，离开起点区域
                      {distanceToTarget !== null && (
                        <span className="tabular-nums ml-1" style={{ color: distanceToTarget > 50 ? 'var(--green)' : 'var(--yellow)' }}>
                          {Math.round(distanceToTarget)} m
                        </span>
                      )}
                    </span>
                  )}
                  {autoPhase === 'heading_to_finish' && (
                    <span className="text-[11px] text-[var(--text-tertiary)]">
                      🏁 距终点
                      {distanceToTarget !== null && (
                        <span className="tabular-nums ml-1" style={{ color: distanceToTarget < 20 ? 'var(--green)' : 'var(--text-secondary)' }}>
                          {distanceToTarget < 1000
                            ? `${Math.round(distanceToTarget)} m`
                            : `${(distanceToTarget / 1000).toFixed(1)} km`}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )}

              {/* Controls */}
              <div className="flex gap-2">
                {status === 'idle' && lightPhase === 'idle' && (
                  <button onClick={beginStartSequence} className="btn btn-primary flex-1" style={{ background: 'var(--green)', color: '#000' }}>
                    启表
                  </button>
                )}
                {status === 'running' && (
                  <>
                    <button onClick={captureSplit} className="btn btn-ghost flex-1">分段</button>
                    <button onClick={() => stop()} className="btn btn-danger flex-1">停表</button>
                  </>
                )}
                {status === 'stopped' && (
                  <button onClick={reset} className="btn btn-ghost flex-1">重置</button>
                )}
              </div>

              {/* Live splits during run */}
              {status === 'running' && splits.length > 0 && (
                <div className="space-y-1">
                  {splits.map((t, i) => (
                    <div key={i} className="flex justify-between px-3 py-1.5 rounded-lg text-[12px]" style={{ background: 'rgba(118,118,128,0.1)' }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>S{i + 1}</span>
                      <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{formatTimeShort(t)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Last result */}
              {lastRecord && colorMeta && (
                <div className="p-3 rounded-2xl flex items-center gap-2.5" style={{ background: `${colorMeta.bg === 'bg-purple-500/20' ? 'rgba(191,90,242,0.12)' : colorMeta.bg === 'bg-green-500/20' ? 'rgba(48,209,88,0.12)' : 'rgba(255,214,10,0.12)'}` }}>
                  <div className="text-xl">
                    {lastRecordColor === 'purple' ? '🟣' : lastRecordColor === 'green' ? '🟢' : '🟡'}
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold" style={{ color: `var(--${lastRecordColor === 'purple' ? 'accent-purple' : lastRecordColor === 'green' ? 'green' : 'yellow'})` }}>
                      {colorMeta.label}
                    </div>
                    <div className="tabular-nums text-[18px] font-semibold text-[var(--text-primary)]">
                      {formatTime(lastRecord.timeMs)}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Records Tab ── */}
      {tab === 'records' && (
        <div className="space-y-2 custom-scrollbar max-h-[min(340px,38vh)] overflow-y-auto">
          {!activeRoute ? (
            <p className="text-center text-[13px] text-[var(--text-tertiary)] py-8">请先选择路线</p>
          ) : records.length === 0 ? (
            <p className="text-center text-[13px] text-[var(--text-tertiary)] py-8">暂无记录，开始计时吧</p>
          ) : (
            <>
              {/* PB badge */}
              {pb !== null && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl" style={{ background: 'rgba(191,90,242,0.1)', border: '1px solid rgba(191,90,242,0.2)' }}>
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--accent-purple)' }}>PB</span>
                  <span className="tabular-nums text-[15px] font-semibold ml-auto" style={{ color: 'var(--accent-purple)' }}>{formatTime(pb)}</span>
                </div>
              )}

              <div className="space-y-1">
                {records.map((record) => {
                  const color = getRecordColor(records, record);
                  const bgMap: Record<string, string> = {
                    purple: 'rgba(191,90,242,0.08)',
                    green: 'rgba(48,209,88,0.08)',
                    yellow: 'rgba(255,214,10,0.08)',
                  };
                  const textMap: Record<string, string> = {
                    purple: 'var(--accent-purple)',
                    green: 'var(--green)',
                    yellow: 'var(--yellow)',
                  };
                  return (
                    <div
                      key={record.id}
                      className="group flex items-center justify-between px-3 py-2 rounded-xl"
                      style={{ background: color ? bgMap[color] : 'rgba(118,118,128,0.08)' }}
                    >
                      <span className="tabular-nums text-[15px] font-medium" style={{ color: color ? textMap[color] : 'var(--text-primary)' }}>
                        {formatTimeShort(record.timeMs)}
                        {record.weather && <span className="ml-1.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{record.weather.weatherDesc} {record.weather.temp}°</span>}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-[var(--text-tertiary)]">
                          {new Date(record.timestamp).toLocaleString('zh-CN', {
                            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                        <button
                          onClick={() => { if (confirm('删除这条记录？')) deleteRecord(record.id!); }}
                          className="w-6 h-6 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-[rgba(255,69,58,0.15)] transition-all shrink-0"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
