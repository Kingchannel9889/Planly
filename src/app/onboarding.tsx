/** First launch is local setup, never an account or seeded-data flow. */
import { useState } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SettingsForm } from '@/components/planner/settings-form';
import { Banner, Brand, Button, C, Card, Icon, Row, Screen, Txt } from '@/components/planner/ui';
import { usePlanner } from '@/store/planner-store';
export default function Onboarding() {
  const { data, change } = usePlanner();
  const [settings, setSettings] = useState(data.settings),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function start() {
    if (settings.wake === settings.sleep) {
      setError('Choose different wake and sleep times.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await change((d) => ({ ...d, settings, onboarded: true }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <View style={{ paddingTop: 20, paddingBottom: 14 }}>
        <Brand large />
      </View>
      <LinearGradient
        colors={['#E1F0FF', '#F2F8FF']}
        style={{ borderRadius: 26, padding: 25, gap: 17, overflow: 'hidden' }}
      >
        <Row>
          <View style={{ padding: 15, borderRadius: 20, backgroundColor: '#FFF' }}>
            <Icon name="sunrise" size={32} />
          </View>
          <Txt color={C.blue} size={12} bold>
            A CALMER, SMARTER YOU
          </Txt>
        </Row>
        <Txt size={32} bold>
          Let’s set up{'\n'}your day.
        </Txt>
        <Txt muted>A few details to create a little more clarity, and a little less rush.</Txt>
      </LinearGradient>
      <Card>
        <SettingsForm value={settings} onChange={setSettings} />
      </Card>
      {error && <Banner warning text={error} />}
      <Button title="Start planning" icon="arrow-right" busy={busy} onPress={() => void start()} />
      <Row style={{ justifyContent: 'center' }}>
        <Icon name="shield" size={14} color={C.muted} />
        <Txt size={12} muted>
          Just you and your plans. Saved on this device.
        </Txt>
      </Row>
    </Screen>
  );
}
