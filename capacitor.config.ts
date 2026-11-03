import type { CapacitorConfig } from '@capacitor/cli';

// APK do app de campo: um casco fino que abre o app publicado (control.brvniteroi.com.br/campo).
// Assim, todo deploy chega nos celulares sem gerar APK novo; o APK só muda quando mexe no nativo
// (GPS em segundo plano, notificação, ícone). `webDir` guarda só a tela de "sem conexão".
const config: CapacitorConfig = {
  appId: 'br.com.brvniteroi.control',
  appName: 'BRV Control',
  webDir: 'android-web',
  server: {
    url: 'https://control.brvniteroi.com.br/campo',
    androidScheme: 'https',
    errorPath: 'offline.html',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
