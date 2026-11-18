import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { useFonts } from 'expo-font';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components';
import { AuthProvider, useAuth } from '@/data/auth';
import { QueryProvider } from '@/data/QueryProvider';
import { useRealtimeSync } from '@/data/realtime';
import { withSentry } from '@/lib/sentry';
import { syncServerClock } from '@/lib/serverClock';
import { ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 200, fade: true });

function AppShell({ fontsReady }: { fontsReady: boolean }) {
  const { c, scheme } = useTheme();
  const { ready, user } = useAuth();
  useRealtimeSync(user?.id);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => undefined);
  }, [c.bg]);

  useEffect(() => {
    syncServerClock().catch(() => undefined);
  }, [user?.id]);

  useEffect(() => {
    if (fontsReady && ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsReady, ready]);

  if (!fontsReady || !ready) return null;

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
          animation: 'default',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="plan/new" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="plan/[id]" />
        <Stack.Screen name="results/[id]" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/scoring" />
        <Stack.Screen name="dev/ui" />
      </Stack>
    </>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <BottomSheetModalProvider>
                <ToastProvider>
                  <AppShell fontsReady={fontsLoaded || !!fontError} />
                </ToastProvider>
              </BottomSheetModalProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default withSentry(RootLayout);
