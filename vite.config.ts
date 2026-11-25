import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react({
      // Disable TypeScript checking during build
      typescript: {
        ignoreBuildErrors: true,
      },
      // Disable ESLint during build
      eslint: {
        ignoreDuringBuilds: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Don't fail on TypeScript errors
    rollupOptions: {
      output: {
        // Libraries change less often than the app, so they stay cached across deploys.
        // Charts and animation are left to the pages that use them so they are not part of startup.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
      onwarn(warning, warn) {
        // Suppress TypeScript warnings
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return
        warn(warning)
      },
    },
  },
})
