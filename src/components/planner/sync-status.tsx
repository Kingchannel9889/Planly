import { router } from 'expo-router';
import { usePlanner } from '@/store/planner-store';
import { Banner, Button, Txt } from './ui';
import { View } from 'react-native';

export function PlannerSyncStatus() {
  const { syncStatus, syncIssue, conflict, sync } = usePlanner();
  if (!syncStatus) return null;
  return (
    <View style={{ gap: 8 }}>
      {syncIssue ? (
        <>
          <Banner warning text={syncStatus} />
          <Button
            secondary
            title={conflict ? 'Resolve in Settings' : 'Retry sync'}
            onPress={() => {
              if (conflict) router.push('/settings');
              else void sync();
            }}
          />
        </>
      ) : (
        <Txt size={12} muted>
          {syncStatus}
        </Txt>
      )}
    </View>
  );
}
