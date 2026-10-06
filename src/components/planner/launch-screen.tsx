/** Branded startup surface shown while local data and the session are restored. */
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Txt } from './ui';
import { S, SettingsButton } from './settings-ui';
export function LaunchScreen({ error, onRetry }: { error?: string; onRetry: () => void }) {
  return (
    <LinearGradient colors={['#FFFFFF', '#F0F7FF', '#E4EFFF']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <View style={styles.halo}>
              <Image
                source={require('@/assets/images/planly-icon.png')}
                accessibilityLabel="Planly logo"
                style={styles.logo}
              />
            </View>
            <Txt bold size={44} color={S.navy} style={{ letterSpacing: -1.5 }}>
              Planly
            </Txt>
            <Txt size={16} color={S.blue} style={{ textAlign: 'center' }}>
              Plan today. Protect tomorrow.
            </Txt>
            <Txt muted size={14} style={{ textAlign: 'center', marginTop: 14, maxWidth: 260 }}>
              A little more clarity.{'\n'}A calmer start to your day.
            </Txt>
          </View>
          <View style={styles.status} accessibilityLiveRegion="polite">
            {error ? (
              <>
                <Banner text={error} warning />
                <SettingsButton title="Try again" onPress={onRetry} />
              </>
            ) : (
              <>
                <ActivityIndicator
                  color={S.blue}
                  size="small"
                  accessibilityLabel="Loading Planly"
                />
                <Txt size={13} color={S.muted}>
                  Preparing your planner…
                </Txt>
              </>
            )}
          </View>
          <Txt size={11} color="#8C9EB9" style={{ textAlign: 'center', letterSpacing: 1.3 }}>
            A CALMER, SMARTER YOU
          </Txt>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 28, paddingBottom: 25, minHeight: 500 },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingVertical: 32 },
  halo: {
    padding: 17,
    borderRadius: 48,
    backgroundColor: '#F8FBFF',
    borderWidth: 1,
    borderColor: '#D8E9FF',
    marginBottom: 15,
    shadowColor: '#3B82F6',
    shadowOpacity: 0.1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  logo: { width: 108, height: 108, borderRadius: 29 },
  status: { gap: 14, alignItems: 'center', marginBottom: 48, marginTop: 20 },
});
