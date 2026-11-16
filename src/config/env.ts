import Constants from 'expo-constants';

export type AppEnv = 'development' | 'staging' | 'production';

const appEnv: AppEnv =
  (Constants.expoConfig?.extra?.appEnv as AppEnv | undefined) ?? 'development';

/**
 * API base URLs. Confirmed against the live OpenAPI spec at
 * https://be-api.aidraftsman.ai/api-json (239 paths, global prefix
 * `api/v1`). Staging/dev URLs are placeholders until confirmed —
 * see analysis doc conflicts-and-risks.md.
 */
/**
 * DEV TUNNEL (Dispatch / "send work to my computer"). The ngrok address
 * changes every time ngrok restarts: this is the ONE place to update it.
 * Set to `null` to go back to the hosted API in development.
 */
const DEV_TUNNEL_API_BASE_URL: string | null =
  null;

const API_BASE_URLS: Record<AppEnv, string> = {
  development: DEV_TUNNEL_API_BASE_URL ?? 'https://be-api.aidraftsman.ai/api/v1',
  staging: 'https://be-api.aidraftsman.ai/api/v1',
  production: 'https://be-api.aidraftsman.ai/api/v1',
};

const apiBaseUrl = API_BASE_URLS[appEnv];

export const env = {
  appEnv,
  apiBaseUrl,
  apiOrigin: apiBaseUrl.replace(/\/api\/v1\/?$/, ''),
  /** ngrok shows an interstitial page unless this header is sent. */
  isTunnel: /\.ngrok(-free)?\.(app|dev|io)$/.test(new URL(apiBaseUrl).hostname),
  /** The web portal's own origin — used as the connector OAuth `returnTo`
   * (see marketplaceApi.ts's `startConnectorOAuth`). The gateway's 302
   * lands the SYSTEM BROWSER back on this web page, not back in this app —
   * there is no mobile deep-link/custom-scheme registered on the gateway's
   * CORS allow-list yet. The connection itself completes server-side
   * before that redirect fires, so the app just needs to notice the new
   * install when the user switches back to it (see ConnectorCatalogueSection's
   * focus-refetch). */
  webOrigin: 'https://b2b-fe.aidraftsman.ai',
  isDev: appEnv === 'development',
} as const;
