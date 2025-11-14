/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from '@vitejs/plugin-react'
import path from 'node:path'

const projectRoot = path.resolve(__dirname)

const aliasConfig = {
      '@': path.resolve(projectRoot, 'src'),
      '@plugins': path.resolve(projectRoot, '../plugins'),
    }

export default defineConfig({
  root: projectRoot,
  plugins: [react()],
  resolve: {
    alias: aliasConfig,
  },
  test: {
    globals: true, 
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts', 
    
    coverage: {
      provider: 'v8', 
      reporter: ['text', 'lcov'], 
      reportsDirectory: './coverage', 
    },
    alias: aliasConfig,
  },
  build: {
    outDir: path.resolve(projectRoot, 'dist'),
    emptyOutDir: true,
  },
})
