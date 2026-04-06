import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing } from '@/src/constants/theme';
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/stores/auth-store';
import ScreenHeader from '@/src/components/ScreenHeader';
import Input from '@/src/components/Input';
import Button from '@/src/components/Button';

export default function BuddyInviteScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { session, profile, fetchProfile } = useAuthStore();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    if (!username.trim()) return;

    let currentUserId = profile?.id ?? session?.user?.id;
    if (!currentUserId) {
      await fetchProfile();
      currentUserId = useAuthStore.getState().profile?.id ?? useAuthStore.getState().session?.user?.id;
    }
    if (!currentUserId) {
      Alert.alert('Session error', 'Please sign out and sign in again.');
      return;
    }

    setLoading(true);
    try {
      const { data: buddy, error: findError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.trim().toLowerCase())
        .single();

      if (findError || !buddy) {
        Alert.alert('User not found', 'No user with that username exists.');
        return;
      }

      const { error } = await supabase.from('buddy_pairs').insert({
        user_id: currentUserId,
        buddy_id: buddy.id,
      });

      if (error) throw error;

      Alert.alert('Invite sent!', `Buddy request sent to @${username.trim()}.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert(t('common.error'), t('common.retry'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Invite Buddy" showBack onBack={() => router.back()} />

      <View style={styles.content}>
        <Text style={styles.description}>
          Invite a friend to be your accountability buddy. They can verify your challenges and keep you on track.
        </Text>
        <Input
          label="Username"
          placeholder="Enter their username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <View style={styles.spacer} />
        <Button
          title="Send Invite"
          onPress={handleInvite}
          loading={loading}
          disabled={!username.trim()}
          size="lg"
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  description: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  spacer: {
    height: spacing.lg,
  },
});
