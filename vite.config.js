import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // 로컬 개발서버 포트 3000
  },
  historyApiFallback: true, // 페이지 새로고침 시 404 방지
});
