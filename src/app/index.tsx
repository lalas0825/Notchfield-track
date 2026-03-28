import { Redirect } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/auth-store';

export default function Index() {
  const session = useAuthStore((s) => s.session);

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
