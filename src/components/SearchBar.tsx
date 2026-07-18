import { useState, useRef, useEffect, useCallback } from 'react';
import { searchPlaces, formatGeocoderLabel, type GeocoderResult } from '../utils/geocoder';

interface Props {
  onSelect: (lat: number, lng: number, label: string) => void;
}

export default function SearchBar({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocoderResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (abortRef.current) abortRef.current.abort();
    if (!q.trim()) { setResults([]); setOpen(false); return; }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const data = await searchPlaces(q, controller.signal);
      if (!controller.signal.aborted) {
        setResults(data);
        setOpen(data.length > 0);
        setSelectedIdx(-1);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setResults([]);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timerRef.current);
  }, [query, doSearch]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectItem = (result: GeocoderResult) => {
    onSelect(parseFloat(result.lat), parseFloat(result.lon), formatGeocoderLabel(result));
    setQuery('');
    setResults([]);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter' && selectedIdx >= 0) {
      e.preventDefault();
      selectItem(results[selectedIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-[280px] sm:max-w-[320px]">
      {/* Search field */}
      <div
        className="flex items-center h-8 rounded-full overflow-hidden transition-all"
        style={{
          background: focused
            ? 'rgba(118,118,128,0.2)'
            : 'rgba(118,118,128,0.12)',
          border: focused
            ? '1px solid var(--accent)'
            : '1px solid transparent',
          boxShadow: focused ? '0 0 0 3px rgba(10,132,255,0.15)' : 'none',
        }}
      >
        {/* Magnifying glass */}
        <svg
          className="ml-2.5 shrink-0"
          width="15"
          height="15"
          viewBox="0 0 15 15"
          fill="none"
        >
          <circle
            cx="6.5"
            cy="6.5"
            r="4.5"
            stroke={focused ? 'var(--accent)' : 'rgba(255,255,255,0.3)'}
            strokeWidth="1.5"
          />
          <path
            d="M10 10l3.5 3.5"
            stroke={focused ? 'var(--accent)' : 'rgba(255,255,255,0.3)'}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { setFocused(true); if (results.length) setOpen(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="搜索地点…"
          className="flex-1 h-full bg-transparent px-2 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none min-w-0"
        />

        {/* Loading spinner or clear button */}
        {loading && (
          <div className="w-4 h-4 mr-2.5 shrink-0 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.2)] border-t-[var(--accent)]" />
        )}
        {!loading && query && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setQuery(''); setResults([]); setOpen(false); inputRef.current?.focus(); }}
            className="mr-1 w-6 h-6 flex items-center justify-center shrink-0 rounded-full hover:bg-[rgba(255,255,255,0.1)]"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <div
          className="absolute top-full mt-2 left-0 right-0 rounded-2xl overflow-hidden z-[1001]"
          style={{
            background: 'rgba(44,44,46,0.95)',
            backdropFilter: 'blur(30px) saturate(180%)',
            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {results.map((result, i) => (
            <button
              key={`${result.lat}-${result.lon}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectItem(result)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.06)]"
              style={{
                background: i === selectedIdx ? 'rgba(10,132,255,0.12)' : 'transparent',
                borderBottom: i < results.length - 1 ? '0.5px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              {/* Pin icon */}
              <svg className="shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="6" r="3" fill="rgba(10,132,255,0.3)" stroke="var(--accent)" strokeWidth="1.2" />
                <path d="M8 16c-3-3.5-5.5-6.5-5.5-9.5a5.5 5.5 0 1111 0C13.5 9.5 11 12.5 8 16z" fill="var(--accent)" opacity="0.2" />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium truncate text-[var(--text-primary)]">
                  {result.display_name.split(',')[0].trim()}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                  {formatGeocoderLabel(result)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
