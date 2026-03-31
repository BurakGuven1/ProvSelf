import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing } from '@/src/constants/theme';
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/stores/auth-store';
import ScreenHeader from '@/src/components/ScreenHeader';
import Card from '@/src/components/Card';
import Button from '@/src/components/Button';
import Avatar from '@/src/components/Avatar';
import EmptyState from '@/src/components/EmptyState';

interface BuddyRequest {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export default function BuddyRequestsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [requests, setRequests] = useState<BuddyRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    if (!session?.user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('buddy_pairs')
        .select('id, user_id, profiles!buddy_pairs_user_id_fkey(username, display_name, avatar_url)')
        .eq('buddy_id', session.user.id)
        .eq('status', 'pending');

      if (data) {
        setRequests(
          data.map((d: any) => ({
            id: d.id,
            user_id: d.user_id,
            username: d.profiles?.username ?? '',
            display_name: d.profiles?.display_name ?? null,
            avatar_url: d.profiles?.avatar_url ?? null,
          }))
        );
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (requestId: string, accept: boolean) => {
    try {
      await supabase
        .from('buddy_pairs')
        .update({ status: accept ? 'active' : 'declined' })
        .eq('id', requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      // silently fail
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Buddy Requests" showBack onBack={() => router.back()} />

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card style={styles.requestCard}>
            <View style={styles.requestRow}>
              <Avatar
                uri={item.avatar_url}
                size="md"
                fallback={item.username.slice(0, 2).toUpperCase()}
              />
              <View style={styles.requestInfo}>
                <Text style={styles.requestName}>
                  {item.display_name || item.username}
                </Text>
                <Text style={styles.requestUsername}>@{item.username}</Text>
              </View>
            </View>
            <View style={styles.requestActions}>
              <Button
                title="Accept"
                onPress={() => handleRespond(item.id, true)}
                size="sm"
              />
              <View style={{ width: spacing.sm }} />
              <Button
                title="Decline"
                onPress={() => handleRespond(item.id, false)}
                variant="outline"
                size="sm"
              />
            </View>
          </Card>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            title="No pending requests"
            message="You don't have any buddy requests right now."
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  requestCard: {
    marginBottom: spacing.md,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  requestInfo: {
    marginLeft: spacing.md,
  },
  requestName: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  requestUsername: {
    ...typography.footnote,
    color: colors.textSecondary,
  },
  requestActions: {
    flexDirection: 'row',
  },
});
