import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
    plugins: [
        react(),
        basicSsl() // Generates on-the-fly secure certs for your frontend window asset streams
    ],
    server: {
        host: true,
        port: 5173
    }
});