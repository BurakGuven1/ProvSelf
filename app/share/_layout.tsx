import { Stack } from 'expo-router';
import { colors } from '@/src/constants/theme';

export default function ShareLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        presentation: 'modal',
      }}
    />
  );
}
