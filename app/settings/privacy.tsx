import { ScrollView, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing } from '@/src/constants/theme';
import ScreenHeader from '@/src/components/ScreenHeader';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title={t('settings.privacy_policy')}
        showBack
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated: April 2, 2026</Text>

        <Text style={styles.heading}>1. Information We Collect</Text>
        <Text style={styles.body}>
          When you use Provself, we collect the following information:{'\n\n'}
          - <Text style={styles.bold}>Account Information:</Text> Your email address, username, and display name when you create an account.{'\n'}
          - <Text style={styles.bold}>Apple Sign In:</Text> If you sign in with Apple, we receive your Apple ID, name, and email (if shared).{'\n'}
          - <Text style={styles.bold}>Health Data:</Text> With your explicit permission, we read fitness metrics (steps, distance, calories, sleep) from Apple Health to verify challenge completion. We do not store raw health data on our servers — only whether the daily target was met.{'\n'}
          - <Text style={styles.bold}>Photos:</Text> If you use photo verification, images are uploaded to verify challenge completion and may be processed by AI. Photos are stored securely and only accessible to you.{'\n'}
          - <Text style={styles.bold}>Purchase History:</Text> We record in-app credit purchases to manage your balance. Payment processing is handled entirely by Apple — we never see or store your payment details.
        </Text>

        <Text style={styles.heading}>2. How We Use Your Information</Text>
        <Text style={styles.body}>
          We use your information to:{'\n\n'}
          - Provide and operate the Provself app{'\n'}
          - Verify challenge completion{'\n'}
          - Manage your commitment credit balance{'\n'}
          - Display leaderboards and social features{'\n'}
          - Send push notifications (with your permission){'\n'}
          - Provide AI coaching and motivation{'\n'}
          - Improve our services
        </Text>

        <Text style={styles.heading}>3. Data Storage and Security</Text>
        <Text style={styles.body}>
          Your data is stored securely using Supabase, which provides enterprise-grade security with row-level security policies, encryption at rest, and encryption in transit (TLS). Authentication tokens are stored securely on your device.
        </Text>

        <Text style={styles.heading}>4. Third-Party Services</Text>
        <Text style={styles.body}>
          Provself uses the following third-party services:{'\n\n'}
          - <Text style={styles.bold}>Supabase:</Text> Database and authentication{'\n'}
          - <Text style={styles.bold}>Apple HealthKit:</Text> Fitness data (with your permission){'\n'}
          - <Text style={styles.bold}>RevenueCat:</Text> In-app purchase management{'\n'}
          - <Text style={styles.bold}>Anthropic Claude:</Text> AI-powered photo verification and coaching{'\n'}
          - <Text style={styles.bold}>Expo Push Notifications:</Text> Push notification delivery
        </Text>

        <Text style={styles.heading}>5. Your Rights</Text>
        <Text style={styles.body}>
          You have the right to:{'\n\n'}
          - Access your personal data{'\n'}
          - Request deletion of your account and data{'\n'}
          - Opt out of push notifications{'\n'}
          - Revoke HealthKit permissions at any time via iOS Settings{'\n\n'}
          To request data deletion, contact us at privacy@provself.com.
        </Text>

        <Text style={styles.heading}>6. Children's Privacy</Text>
        <Text style={styles.body}>
          Provself is not intended for children under 13. We do not knowingly collect personal information from children under 13.
        </Text>

        <Text style={styles.heading}>7. Changes to This Policy</Text>
        <Text style={styles.body}>
          We may update this policy from time to time. We will notify you of any changes by posting the new policy in the app and updating the "Last updated" date.
        </Text>

        <Text style={styles.heading}>8. Contact Us</Text>
        <Text style={styles.body}>
          If you have questions about this privacy policy, please contact us at privacy@provself.com.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  updated: {
    ...typography.caption1,
    color: colors.textTertiary,
    marginBottom: spacing.xl,
  },
  heading: {
    ...typography.headline,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  bold: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
