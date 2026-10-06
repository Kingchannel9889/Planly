/** Daily planning destinations, with tomorrow's review always in reach. */
import { Tabs } from 'expo-router/js-tabs';
import { C, Icon, type IconName } from '@/components/planner/ui';
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.blue,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: C.line, paddingTop: 9 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 3 },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      {(
        [
          ['index', 'Today', 'sun'],
          ['tasks', 'Tasks', 'check-square'],
          ['review', 'Tomorrow', 'moon'],
          ['settings', 'Settings', 'sliders'],
        ] as const
      ).map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color }) => <Icon name={icon as IconName} color={color} size={22} />,
          }}
        />
      ))}
    </Tabs>
  );
}
