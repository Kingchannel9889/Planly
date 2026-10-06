/** Root navigation and persistent state. All entry points honor first-run setup. */
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PlannerProvider, usePlanner } from '@/store/planner-store';
import { SessionProvider, useSession } from '@/store/session-store';
import { watchNotificationTaps } from '@/services/notifications';
import { C } from '@/components/planner/ui';
import { LaunchScreen } from '@/components/planner/launch-screen';
// Keep the native image until the first React surface is laid out, avoiding a white flash.
void SplashScreen.preventAutoHideAsync().catch(() => {});
function Navigation() {
  const { data, ready, error, retry } = usePlanner();
  const session = useSession();
  const [launchComplete, setLaunchComplete] = useState(false);
  useEffect(() => {
    // A brief brand introduction on cold launch only; actual loading can take longer.
    const timer = setTimeout(() => setLaunchComplete(true), 900);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!launchComplete || !ready || !data.onboarded || !session.ready || !session.active) return;
    return watchNotificationTaps((route, id) => {
      if (route === 'review') router.push('/review');
      else if (route === 'task' && id) router.push({ pathname: '/task', params: { id } });
      else router.replace('/');
    });
  }, [launchComplete, ready, data.onboarded, session.ready, session.active]);
  if (!launchComplete || !ready || !session.ready)
    return (
      <LaunchScreen
        error={error || session.error}
        onRetry={() => {
          retry();
          session.retry();
        }}
      />
    );
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Protected guard={!session.active}>
        <Stack.Screen name="welcome" />
      </Stack.Protected>
      <Stack.Protected guard={session.active && !data.onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={session.active && data.onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="task" />
        <Stack.Screen name="edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="quick-add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="notification-settings" />
      </Stack.Protected>
    </Stack>
  );
}
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <PlannerProvider>
          <View style={{ flex: 1, backgroundColor: '#EAF2FC' }}>
            <View
              style={{ flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' }}
              onLayout={() => {
                void SplashScreen.hideAsync().catch(() => {});
              }}
            >
              <StatusBar style="dark" />
              <Navigation />
            </View>
          </View>
        </PlannerProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
