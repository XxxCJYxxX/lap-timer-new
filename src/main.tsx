import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

// Show a loading indicator before React mounts
root.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#000;color:rgba(255,255,255,0.4);font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;">正在加载 LapTimer…</div>';

try {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (e) {
  root.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#000;color:#FF453A;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;flex-direction:column;gap:8px;"><span>加载失败</span><span style="font-size:12px;color:rgba(255,255,255,0.3);">${(e as Error).message}</span></div>`;
}
