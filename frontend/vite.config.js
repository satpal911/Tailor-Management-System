import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function preserveClientHost(proxy) {
  const setClientHost = (proxyRequest, request) => {
    if (request.headers.host) proxyRequest.setHeader('host', request.headers.host);
  };
  proxy.on('proxyReq', setClientHost);
  proxy.on('proxyReqWs', setClientHost);
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: false,
        configure: preserveClientHost,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: false,
        ws: true,
        configure: preserveClientHost,
      },
    },
  },
});
