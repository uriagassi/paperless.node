import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteTsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
    // depending on your application, base can also be "/"
    base: '',
    plugins: [react(), viteTsconfigPaths()],
    server: {
        proxy: {
            '/csrf': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/auth': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
        // this ensures that the browser opens upon server start
        open: true,
        // this sets a default port to 3000
        port: 3000,
    },
})