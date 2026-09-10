import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Plugin to handle Mediapipe import issues
const mediapipeFix = {
  name: 'mediapipe-fix',
  resolveId(id) {
    if (id === '@mediapipe/pose') {
      return this.resolve('@mediapipe/pose');
    }
  },
  load(id) {
    if (id.includes('@mediapipe/pose/pose.js')) {
      // Mock Mediapipe Pose module
      return `
        export const Pose = class {
          static createInstance() {
            return new Pose();
          }
          async initialize() {}
          async send(input) { return { poseLandmarks: [] }; }
          close() {}
        };
        export default Pose;
      `;
    }
  }
};

export default defineConfig({
  plugins: [react(), mediapipeFix],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5002',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: [
      '@tensorflow/tfjs',
      '@tensorflow/tfjs-backend-webgl',
      '@tensorflow-models/pose-detection',
      '@mediapipe/pose',
      '@mediapipe/tasks-vision',
      'seedrandom',
    ],
    include: ['long'],
  },
  define: {
    global: 'globalThis',
  },
  ssr: {
    noExternal: ['seedrandom'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          tensorflow: ['@tensorflow/tfjs', '@tensorflow/tfjs-backend-webgl'],
          posedetection: ['@tensorflow-models/pose-detection'],
        },
      },
    },
  },
});