import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { useAuthStore } from '@/src/stores/auth-store';
import ScreenHeader from '@/src/components/ScreenHeader';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/src/lib/i18n';

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Fran\u00e7ais',
  ja: '\u65e5\u672c\u8a9e',
};

export default function LanguageScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { updateProfile } = useAuthStore();

  const handleSelect = async (lang: SupportedLanguage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await i18n.changeLanguage(lang);
    try {
      await updateProfile({ locale: lang });
    } catch {
      // continue even if profile update fails
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title={t('settings.language')}
        showBack
        onBack={() => router.back()}
      />

      <View style={styles.list}>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang}
            style={styles.row}
            onPress={() => handleSelect(lang)}
            activeOpacity={0.6}
          >
            <Text style={styles.label}>{LANGUAGE_LABELS[lang]}</Text>
            {i18n.language === lang && (
              <Ionicons name="checkmark" size={22} color={colors.accent} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.backgroundTertiary,
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
  },
});
