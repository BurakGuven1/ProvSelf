import { ScrollView, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing } from '@/src/constants/theme';
import ScreenHeader from '@/src/components/ScreenHeader';

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title={t('settings.terms')}
        showBack
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated: April 2, 2026</Text>

        <Text style={styles.heading}>1. Acceptance of Terms</Text>
        <Text style={styles.body}>
          By downloading, installing, or using Provself ("the App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the App.
        </Text>

        <Text style={styles.heading}>2. Description of Service</Text>
        <Text style={styles.body}>
          Provself is a habit accountability app that allows users to create personal challenges, commit virtual credits ("Commitment Credits") to those challenges, and verify completion through Apple Health data, photo proof, or peer verification.
        </Text>

        <Text style={styles.heading}>3. Commitment Credits</Text>
        <Text style={styles.body}>
          Commitment Credits are virtual, in-app tokens purchased through Apple's In-App Purchase system. Important terms:{'\n\n'}
          - Credits are <Text style={styles.bold}>non-refundable</Text> once purchased.{'\n'}
          - Credits are <Text style={styles.bold}>non-transferable</Text> between users.{'\n'}
          - Credits <Text style={styles.bold}>cannot be cashed out</Text> or converted to real currency.{'\n'}
          - Credits have <Text style={styles.bold}>no real-world monetary value</Text>.{'\n'}
          - When you complete a challenge, your committed credits are returned to your in-app balance.{'\n'}
          - When you fail a challenge, your committed credits are forfeited within the app.{'\n\n'}
          Provself is not a gambling service. No real money is at risk beyond the initial purchase of credits, and credits cannot be converted back to money.
        </Text>

        <Text style={styles.heading}>4. Subscriptions</Text>
        <Text style={styles.body}>
          Provself offers an optional Pro subscription with additional features. Subscriptions are billed through Apple and auto-renew unless cancelled at least 24 hours before the end of the current billing period. You can manage your subscription in your Apple ID settings.
        </Text>

        <Text style={styles.heading}>5. Account Responsibilities</Text>
        <Text style={styles.body}>
          You are responsible for maintaining the confidentiality of your account. You agree to:{'\n\n'}
          - Provide accurate information when creating your account{'\n'}
          - Not create multiple accounts to manipulate the system{'\n'}
          - Not attempt to cheat or game the verification system{'\n'}
          - Not upload inappropriate or offensive content as proof photos
        </Text>

        <Text style={styles.heading}>6. Health Data</Text>
        <Text style={styles.body}>
          When you grant HealthKit access, the App reads health metrics solely for challenge verification. We do not sell, share, or use your health data for advertising. You can revoke access at any time through iOS Settings.
        </Text>

        <Text style={styles.heading}>7. AI Verification</Text>
        <Text style={styles.body}>
          Photo verification uses artificial intelligence and may not always be accurate. If you believe an AI verification result is incorrect, you can re-submit your proof or contact support. AI verification decisions are provided as-is.
        </Text>

        <Text style={styles.heading}>8. Limitation of Liability</Text>
        <Text style={styles.body}>
          Provself is provided "as is" without warranties of any kind. We are not liable for any loss of commitment credits due to technical issues, account compromise, or any other circumstance. Our total liability shall not exceed the amount you paid for credits in the past 12 months.
        </Text>

        <Text style={styles.heading}>9. Termination</Text>
        <Text style={styles.body}>
          We reserve the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or abuse the platform. Upon termination, any remaining credits are forfeited.
        </Text>

        <Text style={styles.heading}>10. Changes to Terms</Text>
        <Text style={styles.body}>
          We may update these terms from time to time. Continued use of the App after changes constitutes acceptance of the revised terms.
        </Text>

        <Text style={styles.heading}>11. Contact</Text>
        <Text style={styles.body}>
          For questions about these terms, contact us at support@provself.com.
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
