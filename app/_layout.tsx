import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/stores/auth-store';
import { configureRevenueCat, loginRevenueCat, logoutRevenueCat } from '@/src/lib/revenue-cat';
import { useSubscriptionStore } from '@/src/stores/subscription-store';
import '@/src/lib/i18n';
import { colors } from '@/src/constants/theme';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const { session, setSession, fetchProfile } = useAuthStore();
  const { checkSubscription, reset: resetSubscription } = useSubscriptionStore();
  const segments = useSegments();
  const router = useRouter();

  // Initialize RevenueCat SDK once
  useEffect(() => {
    configureRevenueCat();
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession) {
          await fetchProfile();
          // Sync RevenueCat user identity
          await loginRevenueCat(newSession.user.id);
          await checkSubscription();
        } else {
          await logoutRevenueCat();
          resetSubscription();
        }
        setIsReady(true);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      setSession(existingSession);
      if (existingSession) {
        await fetchProfile();
        await loginRevenueCat(existingSession.user.id);
        await checkSubscription();
      }
      setIsReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, segments, isReady]);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="dark" />
      <Slot />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
