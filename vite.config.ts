import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // 统一使用 @ 指向 src，后续所有页面/组件均按此别名引用
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 固定端口，前端与既有演示坐标保持一致
    port: 5180,
    strictPort: true,
    proxy: {
      // 前端统一走 /api，由本地只读服务转发到飞书开放平台
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
