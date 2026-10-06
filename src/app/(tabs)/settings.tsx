/** Grouped settings with focused editors and a non-destructive local logout flow. */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { DateField } from '@/components/planner/date-field';
import { Banner, Chips, Field, Icon, Row, Screen, Txt } from '@/components/planner/ui';
import {
  S,
  SettingsButton,
  SettingsGroup,
  SettingsHeading,
  SettingsRow,
  SettingsSheet,
} from '@/components/planner/settings-ui';
import type { PlannerData, Priority, Settings } from '@/core/model';
import { atTime, isQuiet } from '@/core/planner';
import { exportBackup, pickBackup } from '@/services/backup';
import { usePlanner } from '@/store/planner-store';
import { useSession } from '@/store/session-store';
import { PasswordField } from '@/components/planner/password-field';
import { legacyPlanner } from '@/services/planner-sync';
import { LOCAL_ONLY } from '@/core/app-mode';
type Panel =
  | 'profile'
  | 'wake'
  | 'sleep'
  | 'review'
  | 'duration'
  | 'priority'
  | 'quiet'
  | 'password'
  | 'privacy'
  | 'terms'
  | 'logout'
  | 'sync'
  | 'import';
const titles: Record<Panel, string> = {
  sync: 'Resolve planner conflict',
  profile: 'Edit Profile',
  wake: 'Wake-up time',
  sleep: 'Sleep time',
  review: 'Evening review',
  duration: 'Default task duration',
  priority: 'Default priority',
  quiet: 'Quiet hours',
  password: 'Change Password',
  privacy: 'Privacy',
  terms: 'Terms of Service',
  logout: 'Log out of Planly?',
  import: 'Restore your planner?',
};
const priorityLabels: Record<Priority, string> = { High: 'High', Medium: 'Normal', Low: 'Low' };
const clockLabel = (value: string) =>
  atTime(new Date(), value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export default function SettingsScreen() {
  const { data, change, sync, syncStatus, conflict } = usePlanner();
  const { account, logout, password: changePassword } = useSession();
  const [currentPassword, setCurrentPassword] = useState(''),
    [nextPassword, setNextPassword] = useState('');
  const s = data.settings;
  const [panel, setPanel] = useState<Panel>(),
    [draft, setDraft] = useState<Settings>(s),
    [duration, setDuration] = useState(String(s.defaultDuration));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState<PlannerData>();
  function open(next: Panel) {
    setDraft(s);
    setCurrentPassword('');
    setNextPassword('');
    setDuration(String(s.defaultDuration));
    setError('');
    setMessage('');
    setPanel(next);
  }
  function close() {
    if (!busy) {
      setPanel(undefined);
      setPending(undefined);
      setError('');
    }
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (e) {
      setError((e as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function patch(value: Partial<Settings>) {
    await change((d) => ({ ...d, settings: { ...d.settings, ...value } }));
  }
  async function save() {
    let values: Partial<Settings> = {};
    if (panel === 'profile') {
      values = { name: draft.name.trim() };
    } else if (panel === 'duration') {
      const value = Number(duration);
      if (!Number.isInteger(value) || value < 1 || value > 525600)
        throw new Error('Enter a positive whole number of minutes.');
      values = { defaultDuration: value };
    } else if (panel === 'priority')
      values = { defaultPriority: draft.defaultPriority ?? 'Medium' };
    else if (panel === 'quiet')
      values = {
        quietHours: draft.quietHours ?? true,
        criticalDuringSleep: draft.criticalDuringSleep,
      };
    else if (panel === 'wake' || panel === 'sleep' || panel === 'review') {
      if (draft.sleep === draft.wake) throw new Error('Wake and sleep times must be different.');
      values = { [panel]: draft[panel] };
    }
    await patch(values);
    setPanel(undefined);
    setMessage('Your preferences are saved.');
  }
  const notifications = () => router.push('/notification-settings');
  const enabled = (value: boolean) => (s.notifications && value ? 'On' : 'Off');
  const initials = s.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((v) => v[0])
    .join('')
    .toUpperCase();
  const editable =
    panel &&
    ['profile', 'wake', 'sleep', 'review', 'duration', 'priority', 'quiet'].includes(panel);
  return (
    <Screen
      resetScrollOnFocus
      title="Settings"
      subtitle="A little more you. A little more balance."
    >
      <SettingsHeading>PROFILE</SettingsHeading>
      <SettingsGroup>
        <View style={{ padding: 20, gap: 17 }}>
          <Row style={{ gap: 16 }}>
            <View
              style={{
                width: 66,
                height: 66,
                borderRadius: 23,
                backgroundColor: '#EAF2FF',
                borderWidth: 1,
                borderColor: '#CCDEFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityLabel="Profile avatar"
            >
              {initials ? (
                <Txt bold size={24} color={S.blue}>
                  {initials}
                </Txt>
              ) : (
                <Icon name="user" size={29} color={S.blue} />
              )}
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Txt bold size={22}>
                {s.name || 'Your profile'}
              </Txt>
              <Txt size={13} color={S.muted}>
                {LOCAL_ONLY ? 'Saved on this device' : account?.user.email}
              </Txt>
              <Txt size={10} bold color={S.blue} style={{ letterSpacing: 1, marginTop: 3 }}>
                {LOCAL_ONLY ? 'LOCAL EDITION' : 'PLANLY ACCOUNT'}
              </Txt>
            </View>
          </Row>
          <Pressable
            accessibilityRole="button"
            onPress={() => open('profile')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              gap: 8,
              minHeight: 42,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#CDDEFF',
              borderRadius: 12,
              backgroundColor: '#F8FBFF',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon name="edit-2" size={15} color={S.blue} />
            <Txt bold size={13} color={S.blue}>
              Edit Profile
            </Txt>
          </Pressable>
        </View>
      </SettingsGroup>
      <SettingsHeading>DAILY SCHEDULE</SettingsHeading>
      <SettingsGroup>
        <SettingsRow
          icon="sunrise"
          title="Wake-up time"
          value={clockLabel(s.wake)}
          onPress={() => open('wake')}
        />
        <SettingsRow
          icon="moon"
          title="Sleep time"
          value={clockLabel(s.sleep)}
          onPress={() => open('sleep')}
        />
        <SettingsRow
          icon="sunset"
          title="Evening review"
          value={clockLabel(s.review)}
          last
          onPress={() => open('review')}
        />
      </SettingsGroup>
      <SettingsHeading>NOTIFICATIONS</SettingsHeading>
      <SettingsGroup>
        <SettingsRow
          icon="check-square"
          title="Task reminders"
          value={enabled(s.taskReminders ?? s.startReminders)}
          onPress={notifications}
        />
        <SettingsRow
          icon="calendar"
          title="Appointment reminders"
          value={enabled(s.appointmentReminders ?? s.startReminders)}
          onPress={notifications}
        />
        <SettingsRow
          icon="alert-circle"
          title="Urgent alerts"
          value={enabled(s.urgentAlerts ?? s.riskReminders)}
          onPress={notifications}
        />
        <SettingsRow
          icon="shield"
          title="Critical alerts"
          value={enabled(s.criticalAlerts ?? s.riskReminders)}
          onPress={notifications}
        />
        <SettingsRow
          icon="sunset"
          title="Evening review reminder"
          value={enabled(s.reviewReminder)}
          onPress={notifications}
        />
        <SettingsRow
          icon="sunrise"
          title="Wake-time summary"
          value={enabled(s.wakeSummary)}
          onPress={notifications}
        />
        <SettingsRow
          icon="moon"
          title="Quiet hours"
          value={s.quietHours === false ? 'Off' : 'On'}
          last
          onPress={notifications}
        />
      </SettingsGroup>
      <SettingsHeading>PLANNING PREFERENCES</SettingsHeading>
      <SettingsGroup>
        <SettingsRow
          icon="clock"
          title="Default task duration"
          value={`${s.defaultDuration} min`}
          onPress={() => open('duration')}
        />
        <SettingsRow
          icon="flag"
          title="Default priority"
          value={priorityLabels[s.defaultPriority ?? 'Medium']}
          onPress={() => open('priority')}
        />
        <SettingsRow
          icon="moon"
          title="Quiet hours"
          detail={`${clockLabel(s.sleep)} – ${clockLabel(s.wake)}`}
          value={s.quietHours === false ? 'Off' : 'On'}
          onPress={() => open('quiet')}
        />
        <SettingsRow
          icon="shield"
          title="Allow Critical alerts during quiet hours"
          last
          disabled={busy || s.quietHours === false}
          toggle={{
            value: s.criticalDuringSleep,
            onChange: (value) => void run(() => patch({ criticalDuringSleep: value })),
          }}
        />
      </SettingsGroup>
      <SettingsHeading>DATA & BACKUP</SettingsHeading>
      {LOCAL_ONLY && (
        <Banner text="Your planner stays on this device. Export backups regularly and before uninstalling or clearing app data. To bring tasks from another edition, export there and import the file here." />
      )}
      <SettingsGroup>
        {!LOCAL_ONLY && (
          <>
            <SettingsRow
              icon="cloud"
              title={conflict ? 'Resolve sync conflict' : 'Sync account'}
              detail={syncStatus || 'Your planner saves locally first.'}
              disabled={busy}
              onPress={() => (conflict ? open('sync') : void run(() => sync()))}
            />
            <SettingsRow
              icon="hard-drive"
              title="Import previous local planner"
              detail="Choose to restore data from before account sign-in was added."
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  const previous = await legacyPlanner();
                  if (!previous) {
                    setMessage('No previous local planner was found on this device.');
                    return;
                  }
                  setPending(previous);
                  setPanel('import');
                })
              }
            />
          </>
        )}
        <SettingsRow
          icon="upload"
          title="Export Backup"
          detail="Save your tasks, appointments, settings, and local planner data."
          disabled={busy}
          onPress={() => void run(() => exportBackup(data))}
        />
        <SettingsRow
          icon="download"
          title="Import Backup"
          detail="Restore Planly from a previous backup file."
          last
          disabled={busy}
          onPress={() =>
            void run(async () => {
              const file = await pickBackup();
              if (file) {
                setPending(file);
                setPanel('import');
              }
            })
          }
        />
      </SettingsGroup>
      <SettingsHeading>{LOCAL_ONLY ? 'ABOUT' : 'ACCOUNT'}</SettingsHeading>
      <SettingsGroup>
        {!LOCAL_ONLY && (
          <>
            <SettingsRow
              icon="mail"
              title="Email"
              value={account?.user.email}
              onPress={() => open('profile')}
            />
            <SettingsRow
              icon="lock"
              title="Change Password"
              detail="Update your account password"
              onPress={() => open('password')}
            />
          </>
        )}
        <SettingsRow icon="shield" title="Privacy" onPress={() => open('privacy')} />
        <SettingsRow icon="file-text" title="Terms of Service" last onPress={() => open('terms')} />
      </SettingsGroup>
      {!LOCAL_ONLY && (
        <>
          <View style={{ height: 1, backgroundColor: S.border, marginVertical: 9 }} />
          <Pressable
            accessibilityRole="button"
            onPress={() => open('logout')}
            style={({ pressed }) => ({
              padding: 19,
              borderRadius: 20,
              backgroundColor: pressed ? '#FFF0F2' : '#FFFCFD',
              borderWidth: 1,
              borderColor: '#F5D5DB',
            })}
          >
            <Row style={{ alignItems: 'flex-start', gap: 14 }}>
              <View style={{ padding: 10, borderRadius: 12, backgroundColor: '#FFF0F2' }}>
                <Icon name="log-out" color={S.red} size={21} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt bold color={S.red}>
                  Log Out
                </Txt>
                <Txt size={12} color={S.muted}>
                  Sign out of your Planly account on this device.
                </Txt>
              </View>
              <Icon name="chevron-right" color={S.red} size={17} />
            </Row>
          </Pressable>
        </>
      )}
      {!panel && error && <Banner warning text={error} />}
      {!panel && message && <Banner text={message} />}
      <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 6, gap: 4 }}>
        <Txt bold size={12} color={S.muted}>
          Planly v1.0.0{LOCAL_ONLY ? ' · Local' : ''}
        </Txt>
        <Txt size={11} color="#8A9CB6">
          Plan today. Protect tomorrow.
        </Txt>
      </View>
      {panel && (
        <SettingsSheet
          title={titles[panel]}
          onClose={close}
          busy={busy}
          danger={panel === 'logout'}
          icon={
            panel === 'logout'
              ? 'log-out'
              : panel === 'profile'
                ? 'user'
                : panel === 'privacy'
                  ? 'shield'
                  : 'sliders'
          }
        >
          {panel === 'profile' && (
            <>
              <Field
                label="Name"
                value={draft.name}
                maxLength={60}
                onChangeText={(name) => setDraft({ ...draft, name })}
                autoCapitalize="words"
                placeholder="Your name"
              />
              {!LOCAL_ONLY && (
                <Field
                  label="Email address"
                  value={account?.user.email ?? ''}
                  editable={false}
                  onChangeText={(email) => setDraft({ ...draft, email })}
                  maxLength={254}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="you@example.com"
                />
              )}
              <Txt muted size={12}>
                {LOCAL_ONLY
                  ? 'Your name is saved only as part of your local planner.'
                  : 'Your name is part of your planner. Your sign-in email cannot be changed here.'}
              </Txt>
            </>
          )}
          {(panel === 'wake' || panel === 'sleep' || panel === 'review') && (
            <>
              <DateField
                label={titles[panel]}
                mode="time"
                value={atTime(new Date(), draft[panel])}
                onChange={(date) =>
                  setDraft({
                    ...draft,
                    [panel]: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
                  })
                }
              />
              <Txt muted size={13}>
                {panel === 'review'
                  ? 'Set aside a moment to prepare tomorrow’s plan.'
                  : 'Sleep hours also reduce the available time used to calculate deadline risk.'}
              </Txt>
              {isQuiet(atTime(new Date(), draft.review), draft) && (
                <Banner text="Your evening review falls during quiet hours, so its reminder will be skipped." />
              )}
            </>
          )}
          {panel === 'duration' && (
            <>
              <Field
                label="Minutes"
                keyboardType="number-pad"
                value={duration}
                onChangeText={setDuration}
              />
              <Txt muted size={13}>
                Applies to new tasks. Existing estimates stay unchanged.
              </Txt>
            </>
          )}
          {panel === 'priority' && (
            <>
              <Chips
                values={['Low', 'Normal', 'High']}
                value={priorityLabels[draft.defaultPriority ?? 'Medium']}
                onChange={(label) =>
                  setDraft({
                    ...draft,
                    defaultPriority: label === 'Normal' ? 'Medium' : (label as Priority),
                  })
                }
              />
              <Txt muted size={13}>
                Normal uses the standard priority. Deadline risk can still make a task Urgent or
                Critical.
              </Txt>
            </>
          )}
          {panel === 'quiet' && (
            <>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt bold>Quiet hours</Txt>
                <Switch
                  accessibilityLabel="Quiet hours"
                  value={draft.quietHours ?? true}
                  trackColor={{ true: S.bright }}
                  onValueChange={(quietHours) => setDraft({ ...draft, quietHours })}
                />
              </Row>
              <Txt muted>
                {clockLabel(s.sleep)} – {clockLabel(s.wake)}. Quiet hours follow your daily sleep
                schedule.
              </Txt>
              <Row>
                <Txt style={{ flex: 1 }}>Allow Critical alerts during quiet hours</Txt>
                <Switch
                  accessibilityLabel="Allow Critical alerts during quiet hours"
                  disabled={draft.quietHours === false}
                  value={draft.criticalDuringSleep}
                  trackColor={{ true: S.bright }}
                  onValueChange={(criticalDuringSleep) =>
                    setDraft({ ...draft, criticalDuringSleep })
                  }
                />
              </Row>
              <Txt muted size={12}>
                Turning off quiet hours allows notifications during sleep. It does not change the
                time available for tasks.
              </Txt>
            </>
          )}
          {panel === 'password' && (
            <>
              <PasswordField
                label="Current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                editable={!busy}
                autoCapitalize="none"
              />
              <PasswordField
                label="New password"
                value={nextPassword}
                onChangeText={setNextPassword}
                editable={!busy}
                autoCapitalize="none"
              />
              <Txt muted>
                Use at least 6 characters. Changing your password signs out other sessions.
              </Txt>
              <SettingsButton
                title="Change Password"
                busy={busy}
                onPress={() =>
                  void run(async () => {
                    if (Array.from(nextPassword).length < 6)
                      throw new Error('Use at least 6 characters.');
                    await changePassword(currentPassword, nextPassword);
                    setCurrentPassword('');
                    setNextPassword('');
                    setPanel(undefined);
                    setMessage('Password changed.');
                  })
                }
              />
            </>
          )}
          {panel === 'privacy' && (
            <>
              {LOCAL_ONLY ? (
                <>
                  <Txt bold>Your planner stays on this device.</Txt>
                  <Txt muted>
                    Tasks, appointments, settings, and reminders work without an account or Planly
                    server. This edition does not synchronize your planner online.
                  </Txt>
                  <Txt muted>
                    Local planner data and exported JSON files are not encrypted. Export a backup
                    before uninstalling or clearing app data. Import your backup to restore it or
                    move to another phone.
                  </Txt>
                </>
              ) : (
                <>
                  <Txt bold>Your planner belongs to your account.</Txt>
                  <Txt muted>
                    Your tasks, appointments, and settings are saved locally and synchronized with
                    the configured Planly server. Passwords are hashed on the server; native session
                    credentials use secure device storage.
                  </Txt>
                  <Txt muted>
                    Local planner data and exported JSON backups are not encrypted. Logging out
                    preserves your local copy and stops reminders on this device. Sign in to the
                    same account to open it again.
                  </Txt>
                </>
              )}
              <SettingsButton secondary title="Done" onPress={close} />
            </>
          )}
          {panel === 'sync' && (
            <>
              <Txt muted>
                Both copies are preserved until you choose. Export a backup of the planner on this
                device first if you want to keep it.
              </Txt>
              <SettingsButton
                secondary
                title="Export the device copy"
                busy={busy}
                onPress={() => void run(() => exportBackup(data))}
              />
              <SettingsButton
                title="Keep the device copy"
                busy={busy}
                onPress={() =>
                  void run(async () => {
                    await sync('device');
                    setPanel(undefined);
                  })
                }
              />
              <SettingsButton
                secondary
                title="Replace device copy with server copy"
                busy={busy}
                onPress={() =>
                  void run(async () => {
                    await sync('server');
                    setPanel(undefined);
                  })
                }
              />
              <Txt muted size={12}>
                Your choice replaces the other copy. Task lists are not merged automatically.
              </Txt>
            </>
          )}
          {panel === 'terms' && (
            <>
              <Txt muted>
                Terms of Service have not been published for this local development version. No
                account agreement is presented or accepted here.
              </Txt>
              <Txt muted>
                This is a development service. Published terms must be provided before public
                release.
              </Txt>
              <SettingsButton secondary title="Done" onPress={close} />
            </>
          )}
          {panel === 'logout' && (
            <>
              <Txt muted>
                You’ll be signed out of your account on this device. Your locally stored planner
                data will remain on this device unless it is manually deleted.
              </Txt>
              <Txt size={12} muted>
                Connect to the internet to end your server session. Your local planner remains
                saved.
              </Txt>
              <Row>
                <View style={{ flex: 1 }}>
                  <SettingsButton secondary title="Cancel" disabled={busy} onPress={close} />
                </View>
                <View style={{ flex: 1 }}>
                  <SettingsButton
                    danger
                    title="Log Out"
                    busy={busy}
                    onPress={() => void run(logout)}
                  />
                </View>
              </Row>
            </>
          )}
          {panel === 'import' && pending && (
            <>
              <Txt muted>
                This replaces your current planner with{' '}
                {pending.entries.filter((e) => e.kind === 'task').length} tasks and{' '}
                {pending.entries.filter((e) => e.kind === 'appointment').length} appointments.
                Export a backup first if you want to keep your current data.
              </Txt>
              <Txt size={12} muted>
                {LOCAL_ONLY
                  ? 'The restored planner will be saved on this device.'
                  : 'Your session will not change.'}
              </Txt>
              <SettingsButton
                danger
                title="Replace with this backup"
                busy={busy}
                onPress={() =>
                  void run(async () => {
                    await change(() => ({ ...pending, onboarded: true }), true);
                    setPending(undefined);
                    setPanel(undefined);
                    setMessage('Backup restored.');
                  })
                }
              />
              <SettingsButton secondary title="Cancel" disabled={busy} onPress={close} />
            </>
          )}
          {error && <Banner warning text={error} />}
          {editable && (
            <>
              <SettingsButton title="Save changes" busy={busy} onPress={() => void run(save)} />
              <SettingsButton secondary title="Cancel" disabled={busy} onPress={close} />
            </>
          )}
        </SettingsSheet>
      )}
    </Screen>
  );
}
