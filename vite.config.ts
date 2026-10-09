import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths: the build works from any sub-path (GitHub Pages).
  base: './',
  test: {
    // Sweeps and network solvers are quick; keep a modest cap.
    testTimeout: 20000,
  },
})
