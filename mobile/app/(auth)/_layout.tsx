import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';

export default function AuthLayout() {
  const { session, loading } = useAuthStore();
  if (loading) return null;
  if (session) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
