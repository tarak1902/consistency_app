import { Redirect } from 'expo-router';
import { useAuth } from '@/data/auth';

export default function Index() {
  const { ready, session, onboarded } = useAuth();
  if (!ready) return null;
  if (session) return <Redirect href="/today" />;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/sign-in" />;
}
