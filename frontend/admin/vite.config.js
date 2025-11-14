import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, 'src') },
      {
        find: /element-plus\/es\/defaults\.mjs$/,
        replacement: 'element-plus/dist/index.full.mjs'
      }
    ]
  },
  server: {
    port: 18964,
    proxy: {
      '/api': {
        target: 'http://backend:28964',
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 18964,
    proxy: {
      '/api': {
        target: 'http://backend:28964',
        changeOrigin: true
      }
    }
  }
})
