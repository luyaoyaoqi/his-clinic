import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';

// Vite 配置：纯前端，浏览器直连平台（需平台支持 CORS）
// 启动：npm run dev
export default defineConfig({
  plugins: [vue(), vueDevTools()],
  server: {
    port: 5173,
    strictPort: false,
  },
});