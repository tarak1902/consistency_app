import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/data/auth';
import { useTheme } from '@/theme';

export default function AuthLayout() {
  const { session } = useAuth();
  const { c } = useTheme();
  if (session) return <Redirect href="/today" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}
