import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  // O app só começa pelo index.html da raiz: sem isto o Vite varre o projeto inteiro procurando
  // .html (inclusive o backup do Field, ~68 mil arquivos, e o build do Android) e trava no "scanning dependencies"
  optimizeDeps: { entries: ['index.html'] },
  server: {
    // Pastas grandes que não são código do app: fora do vigia de arquivos
    watch: {
      ignored: ['**/scripts/**/dados/**', '**/amostra/**', '**/android/**', '**/android-web/**', '**/android-assinatura/**'],
    },
    // Acessível pelo celular na mesma rede (testar o PWA dos técnicos)
    host: true,
  },
});
