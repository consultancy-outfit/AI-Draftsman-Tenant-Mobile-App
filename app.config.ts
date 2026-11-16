import { existsSync } from 'node:fs';
import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * App config is a function so it can read env vars at build/start time
 * (APP_ENV selects which API base URL and bundle identifier suffix to use).
 * See src/config/env.ts for the matching runtime reader.
 */
const APP_ENV = (process.env.APP_ENV ?? 'development') as
  | 'development'
  | 'staging'
  | 'production';

const IS_DEV = APP_ENV === 'development';
const IS_STAGING = APP_ENV === 'staging';

const bundleSuffix = IS_DEV ? '.dev' : IS_STAGING ? '.staging' : '';
// Always the same visible app name regardless of environment — the bundle
// identifier / package suffix above is what actually keeps dev, staging,
// and production installable side by side on one device; the name itself
// no longer carries an "(Dev)"/"(Staging)" suffix per request.
const appName = 'AI Draftsman B2B';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: appName,
  slug: 'ai-draftsman-tenant-mobile',
  version: '1.2.1',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic', // driven by our own ThemeProvider, not the OS switch alone
  scheme: 'aidraftsmantenant',
  newArchEnabled: true,
  jsEngine: 'hermes',
  primaryColor: '#C8622A',
  backgroundColor: '#F4F2EE',

  // We render our own animated JS splash screen (see src/app/SplashGate.tsx).
  // The native splash below is only the instant-launch frame shown before JS boots.
  splash: {
    /*
     * The same wordmark the JS splash and the sign-in header show, so the
     * native frame and the animated one are the same picture and the handover
     * is invisible. Each theme takes the artwork drawn for it: the dark-ink
     * lockup on the light ground, the white lockup on the dark ground.
     */
    image: './assets/splash-logo-light-theme.png',
    resizeMode: 'contain',
    backgroundColor: '#F4F2EE',
    dark: {
      image: './assets/splash-logo-dark-theme.png',
      resizeMode: 'contain',
      backgroundColor: '#1C1A16',
    },
  },

  ios: {
    /*
     * iPhone only. The UI is a phone layout throughout — a five-tab bottom bar,
     * single-column stacks, cards sized to a phone's width — and none of it has
     * been designed or tested against an iPad's canvas. Declaring tablet support
     * would ship a stretched phone app AND oblige us to supply iPad screenshots
     * that misrepresent it. Flip this back on only alongside real iPad layouts.
     */
    supportsTablet: false,
    bundleIdentifier: `ai.aidraftsman.tenant${bundleSuffix}`,
    buildNumber: '11',
    infoPlist: {
      NSFaceIDUsageDescription:
        'Use Face ID to unlock AI Draftsman B2B quickly and securely.',
      LSApplicationQueriesSchemes: ['googleauthenticator', 'otpauth'],
      /* Only standard HTTPS/TLS — exempt from export compliance. Declared
         here so neither EAS nor App Store Connect asks on every build. */
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  android: {
    package: `ai.aidraftsman.tenant${bundleSuffix}`,
    /* Firebase config for Android push; only wired in when the file is present. */
    ...(existsSync('./google-services.json') ? { googleServicesFile: './google-services.json' } : {}),
    adaptiveIcon: {
      backgroundColor: '#F4F2EE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    /* Play reads the manifest, not our intentions: an explicit versionCode here
       (appVersionSource is "local") means a bump is a reviewed source change
       rather than something EAS infers. */
    versionCode: 11,
    permissions: ['USE_BIOMETRIC', 'USE_FINGERPRINT'],
    /*
     * Permissions expo-image-picker's plugin adds by default for capabilities we
     * never use. RECORD_AUDIO comes with its video-capture path, SYSTEM_ALERT_WINDOW
     * and WRITE_EXTERNAL_STORAGE are legacy defaults. All three are dead weight, and
     * a declared microphone permission with no feature behind it contradicts the
     * Data safety declaration (no audio collected) — which is exactly the kind of
     * mismatch Play flags. READ_EXTERNAL_STORAGE stays: the picker still needs it
     * for gallery access on API 32 and below.
     */
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'aidraftsmantenant' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },

  web: {
    favicon: './assets/favicon.png',
  },

  plugins: [
    /* Dispatch push (Expo). Android needs the Firebase file below to receive pushes; iOS needs an APNs key in EAS. */
    ['expo-notifications', { color: '#C8622A' }],
    ['expo-camera', { cameraPermission: 'Used to scan the pairing code shown on your computer.', recordAudioAndroid: false }],
    /*
     * Android release optimisation — Play Console flagged "DEX code
     * optimization is below our threshold" (obfuscation 2%, fix by Feb 2027).
     * R8 minifies, obfuscates and shrinks the Java/Kotlin code of release
     * builds only; debug builds and the JS bundle are untouched. React
     * Native and Expo modules ship their own keep rules, so no app-level
     * rules are needed today — add to `extraProguardRules` if a release build
     * ever crashes with a ClassNotFound/NoSuchMethod that debug does not.
     */
    [
      'expo-build-properties',
      {
        android: {
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
    'expo-secure-store',
    'expo-font',
    'expo-web-browser',
    '@preeternal/react-native-cookie-manager',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#F4F2EE',
        image: './assets/splash-logo-light-theme.png',
        dark: {
          backgroundColor: '#1C1A16',
          image: './assets/splash-logo-dark-theme.png',
        },
        /* Matches BrandLogo's width in BrandSplash, so the wordmark does not
           jump size when the JS splash takes over from the native frame. */
        imageWidth: 180,
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission:
          'Use Face ID to unlock AI Draftsman B2B quickly and securely.',
      },
    ],
  ],

  extra: {
    appEnv: APP_ENV,
    /*
     * Dispatch push is only switched on once it is configured: either the
     * Firebase file is in the project (Android) or PUSH_ENABLED=1 is set for the
     * build (e.g. an iOS build whose APNs key is already in EAS). Until then the
     * app never asks for the notification permission and never registers a token.
     */
    pushEnabled: existsSync('./google-services.json') || process.env.PUSH_ENABLED === '1',
    eas: {
      projectId: 'c237be2a-2e1b-4544-9184-3d7db85e95d9',
    },
  },
});
