// APK do app de campo (Capacitor): casco Android que abre este mesmo site. No navegador/PWA tudo
// continua como antes; só quando roda dentro do APK entram o GPS em segundo plano e o push nativo (FCM).
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';

/** true quando a página está rodando dentro do APK. */
export const ehApp = Capacitor.isNativePlatform();

export const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
