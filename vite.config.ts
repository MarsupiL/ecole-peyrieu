import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: '/peyrieu-school-demo/',
  build: { chunkSizeWarningLimit: 750 },
});
