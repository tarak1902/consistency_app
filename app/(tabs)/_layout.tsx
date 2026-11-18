import { Redirect, Tabs } from 'expo-router';
import { Archive, ChartLine, House } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { useAuth } from '@/data/auth';
import { fonts, useTheme } from '@/theme';

export default function TabsLayout() {
  const { session } = useAuth();
  const { c } = useTheme();
  if (!session) return <Redirect href="/sign-in" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.text3,
        tabBarStyle: {
          backgroundColor: c.bg,
          borderTopColor: c.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        sceneStyle: { backgroundColor: c.bg },
        animation: 'fade',
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <House size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color, size }) => <ChartLine size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <Archive size={size - 2} color={color} />,
        }}
      />
    </Tabs>
  );
}
