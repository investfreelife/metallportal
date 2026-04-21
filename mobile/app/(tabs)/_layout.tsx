import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Redirect, Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';

const PRIMARY = '#1a56db';

function TabIcon({ name, color, badge }: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
  badge?: number;
}) {
  return (
    <View>
      <FontAwesome size={24} style={{ marginBottom: -3 }} name={name} color={color} />
      {!!badge && (
        <View style={tb.badge}>
          <Text style={tb.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </View>
  );
}

const tb = StyleSheet.create({
  badge: { position: 'absolute', top: -6, right: -10, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { session, loading } = useAuthStore();
  const cartCount = useCartStore((s) => s.count());

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { borderTopColor: '#e2e8f0', backgroundColor: '#fff' },
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Каталог',
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Корзина',
          tabBarIcon: ({ color }) => <TabIcon name="shopping-cart" color={color} badge={cartCount} />,
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Заказы',
          tabBarIcon: ({ color }) => <TabIcon name="list" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Чат',
          tabBarIcon: ({ color }) => <TabIcon name="comment" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color }) => <TabIcon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}
