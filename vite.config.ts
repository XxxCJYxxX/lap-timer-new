import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/lap-timer-new/',
  plugins: [react(), tailwindcss()],
});
