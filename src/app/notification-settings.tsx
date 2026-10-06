/** Separate notification preferences, using the existing OS permission/scheduling adapter. */
import { useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { Banner, Screen, Txt } from '@/components/planner/ui';
import {
  SettingsButton,
  SettingsGroup,
  SettingsHeading,
  SettingsRow,
} from '@/components/planner/settings-ui';
import type { Settings } from '@/core/model';
import { notificationPermission, requestNotificationPermission } from '@/services/notifications';
import { usePlanner } from '@/store/planner-store';
export default function NotificationSettingsScreen() {
  const { data, change, retry, notificationError } = usePlanner();
  const s = data.settings;
  const [permission, setPermission] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const refresh = () => {
      void notificationPermission()
        .then(setPermission)
        .catch(() => setError('Could not check notification permission.'));
    };
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, []);
  async function update(patch: Partial<Settings>) {
    setBusy(true);
    setError('');
    try {
      await change((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function enable() {
    setBusy(true);
    setError('');
    try {
      const granted = await requestNotificationPermission();
      setPermission(granted);
      if (granted) await update({ notifications: true });
      else setError('Allow notifications in your device settings to receive reminders.');
    } catch {
      setError('Could not request notification permission. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Notifications" subtitle="A gentle nudge, when you need it." back>
      <SettingsGroup>
        <SettingsRow
          icon="bell"
          title="Planner notifications"
          detail={
            Platform.OS === 'web'
              ? 'Available in the Android app'
              : permission
                ? 'Device permission enabled'
                : 'Device permission required'
          }
          last
          disabled={busy || Platform.OS === 'web'}
          toggle={{
            value: s.notifications && permission,
            onChange: (value) =>
              value && !permission ? void enable() : void update({ notifications: value }),
          }}
        />
      </SettingsGroup>
      {!permission && Platform.OS !== 'web' && (
        <SettingsButton title="Enable notifications" busy={busy} onPress={() => void enable()} />
      )}
      <SettingsHeading>REMINDERS & ALERTS</SettingsHeading>
      <SettingsGroup>
        <SettingsRow
          icon="check-square"
          title="Task reminders"
          detail="10 minutes before a planned task"
          disabled={busy}
          toggle={{
            value: s.taskReminders ?? s.startReminders,
            onChange: (taskReminders) => void update({ taskReminders }),
          }}
        />
        <SettingsRow
          icon="calendar"
          title="Appointment reminders"
          detail="10 minutes before a fixed appointment"
          disabled={busy}
          toggle={{
            value: s.appointmentReminders ?? s.startReminders,
            onChange: (appointmentReminders) => void update({ appointmentReminders }),
          }}
        />
        <SettingsRow
          icon="alert-circle"
          title="Urgent alerts"
          detail="When a deadline needs attention"
          disabled={busy}
          toggle={{
            value: s.urgentAlerts ?? s.riskReminders,
            onChange: (urgentAlerts) => void update({ urgentAlerts }),
          }}
        />
        <SettingsRow
          icon="shield"
          title="Critical alerts"
          detail="When available time is running short"
          disabled={busy}
          toggle={{
            value: s.criticalAlerts ?? s.riskReminders,
            onChange: (criticalAlerts) => void update({ criticalAlerts }),
          }}
        />
        <SettingsRow
          icon="moon"
          title="Evening review reminder"
          detail={`Every evening at ${s.review}`}
          disabled={busy}
          toggle={{
            value: s.reviewReminder,
            onChange: (reviewReminder) => void update({ reviewReminder }),
          }}
        />
        <SettingsRow
          icon="sunrise"
          title="Wake-time summary"
          detail={`An overview at ${s.wake}`}
          last
          disabled={busy}
          toggle={{ value: s.wakeSummary, onChange: (wakeSummary) => void update({ wakeSummary }) }}
        />
      </SettingsGroup>
      <SettingsHeading>PROTECT YOUR DOWNTIME</SettingsHeading>
      <SettingsGroup>
        <SettingsRow
          icon="moon"
          title="Quiet hours"
          detail={`${s.sleep}–${s.wake} · follows your sleep schedule`}
          disabled={busy}
          toggle={{
            value: s.quietHours ?? true,
            onChange: (quietHours) => void update({ quietHours }),
          }}
        />
        <SettingsRow
          icon="shield"
          title="Allow Critical alerts during quiet hours"
          disabled={busy || s.quietHours === false}
          last
          toggle={{
            value: s.criticalDuringSleep,
            onChange: (criticalDuringSleep) => void update({ criticalDuringSleep }),
          }}
        />
      </SettingsGroup>
      <Txt muted size={12}>
        Changes save automatically. Quiet hours silence reminders, with a wake-time summary for work
        that still needs attention. Android may delay delivery under battery restrictions.
      </Txt>
      {Platform.OS !== 'web' && (
        <SettingsButton
          secondary
          title="Open device notification settings"
          onPress={() =>
            void Linking.openSettings().catch(() => setError('Could not open device settings.'))
          }
        />
      )}
      {notificationError && (
        <>
          <Banner warning text={notificationError} />
          <SettingsButton secondary title="Retry reminders" onPress={retry} />
        </>
      )}
      {error && <Banner warning text={error} />}
    </Screen>
  );
}
