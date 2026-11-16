import { useCallback, useRef, useState } from 'react';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type LinkingOptions,
  type NavigationContainerRef,
  type Theme,
} from '@react-navigation/native';

import { selectIsFullyAuthenticated } from '@/store/authSlice';
import { useAppSelector } from '@/store/hooks';
import { useAppTheme } from '@/theme/ThemeContext';

import { ActiveRoutePathContext, getActiveRoutePath } from './activeRoute';
import { AppNavigator } from './AppNavigator';
import { AuthNavigator } from './AuthNavigator';

/**
 * Deep link config. Only ResetPassword is currently reachable this way (the
 * emailed link, `aidraftsmantenant://reset-password/:token`) — it's
 * resolved against whichever navigator is mounted, so it only works while
 * signed out, which is the real-world case (a user clicks the email link
 * from outside the app). If the app is already authenticated when the link
 * fires, it's a no-op rather than a crash, since AppNavigator doesn't
 * declare a ResetPassword screen — acceptable for a case that means "you
 * already have a session, the reset link isn't really for you right now".
 */
const linking: LinkingOptions<Record<string, unknown>> = {
  prefixes: ['aidraftsmantenant://'],
  config: {
    screens: {
      Login: 'login',
      ResetPassword: 'reset-password/:token',
    },
  },
};

export function RootNavigator() {
  const { theme, isDark } = useAppTheme();
  // Both halves of the sign-in must be done before the app stack mounts:
  // password (isLoggedIn) AND second factor (isOtpVerified), with the phase
  // settled on `authenticated`. Sign-out resets all three together, so the
  // next attempt starts from the Login screen every time — see
  // store/authSlice.ts.
  const isAuthenticated = useAppSelector(selectIsFullyAuthenticated);

  // See activeRoute.ts — this is the single source of truth the sidebar
  // reads to know which tab/screen is really focused, including inside
  // nested navigators (e.g. the bottom tabs living inside the drawer).
  const navigationRef = useRef<NavigationContainerRef<Record<string, unknown>>>(null);
  const [activeRoutePath, setActiveRoutePath] = useState<string[]>([]);

  const syncActiveRoutePath = useCallback(() => {
    setActiveRoutePath(getActiveRoutePath(navigationRef.current?.getRootState()));
  }, []);

  const navigationTheme: Theme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: theme.colors.accent,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.error,
    },
  };

  return (
    <ActiveRoutePathContext.Provider value={activeRoutePath}>
      <NavigationContainer
        ref={navigationRef}
        linking={linking}
        theme={navigationTheme}
        onReady={syncActiveRoutePath}
        onStateChange={syncActiveRoutePath}
      >
        {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </ActiveRoutePathContext.Provider>
  );
}
