import { defineConfig } from 'vite'

export default defineConfig({
  base: '/tcc-protection-app/',
  build: {
    outDir: 'docs',
    rollupOptions: {
      output: {
        // Keep readable names but add content hash for cache busting
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  }
})
