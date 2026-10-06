import { useState } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Banner, Brand, Field, Screen, Txt } from '@/components/planner/ui';
import { SettingsButton } from '@/components/planner/settings-ui';
import { useSession } from '@/store/session-store';
import { PasswordField } from '@/components/planner/password-field';
export default function WelcomeScreen() {
  const { login } = useSession();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [error, setError] = useState('');
  async function submit() {
    setBusy(true);
    setError('');
    try {
      if (register && password !== confirm) throw new Error('Passwords do not match.');
      if (Array.from(password).length < 6)
        throw new Error('Use a password with at least 6 characters.');
      await login(email, password, register);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <View style={{ alignItems: 'center', paddingTop: 24 }}>
        <Brand large />
      </View>
      <LinearGradient
        colors={['#EFF6FF', '#DBEAFF', '#F8FBFF']}
        style={{ padding: 28, borderRadius: 24, marginVertical: 16, gap: 12 }}
      >
        <Txt bold size={29}>
          A calmer day.{'\n'}A clearer tomorrow.
        </Txt>
        <Txt muted>Your plans, ready when you are.</Txt>
      </LinearGradient>
      <Txt bold size={24}>
        {register ? 'Create your account' : 'Welcome back'}
      </Txt>
      <Txt muted>
        {register
          ? 'Save your planner to your account and keep a copy on this device.'
          : 'Sign in to open your Planly planner.'}
      </Txt>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        editable={!busy}
      />
      <PasswordField
        label="Password"
        key={register ? 'register-password' : 'login-password'}
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoComplete={register ? 'new-password' : 'current-password'}
        editable={!busy}
      />
      {register && (
        <PasswordField
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="none"
          editable={!busy}
        />
      )}
      {register && (
        <Txt muted size={12}>
          Use at least 6 characters. Email verification and password recovery are not available in
          this development version.
        </Txt>
      )}
      {error && <Banner warning text={error} />}
      <SettingsButton
        title={register ? 'Create account' : 'Sign In'}
        busy={busy}
        onPress={() => void submit()}
      />
      <SettingsButton
        secondary
        title={register ? 'Already have an account? Sign In' : 'New to Planly? Create account'}
        disabled={busy}
        onPress={() => {
          setRegister(!register);
          setError('');
          setPassword('');
          setConfirm('');
        }}
      />
      <Txt muted size={12}>
        Logging out keeps your local planner. Sign in to the same account to open it again.
      </Txt>
    </Screen>
  );
}
