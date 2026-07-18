import type { Weather } from '../types';

const WMO_CODES: Record<number, string> = {
  0: '晴',
  1: '大部晴',
  2: '多云',
  3: '阴',
  45: '雾',
  48: '冻雾',
  51: '小雨',
  53: '中雨',
  55: '大雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  80: '阵雨',
  81: '中阵雨',
  82: '大阵雨',
  95: '雷暴',
  96: '冰雹雷暴',
  99: '强冰雹雷暴',
};

export async function fetchWeather(lat: number, lng: number): Promise<Weather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const c = data.current;
    return {
      temp: Math.round(c.temperature_2m),
      humidity: c.relative_humidity_2m,
      windSpeed: Math.round(c.wind_speed_10m),
      weatherCode: c.weather_code,
      weatherDesc: WMO_CODES[c.weather_code] ?? '未知',
    };
  } catch {
    return null;
  }
}
