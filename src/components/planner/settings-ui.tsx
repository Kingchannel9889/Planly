/** Settings-specific styling extends Planly without changing other screens. */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Row, Txt, type IconName } from './ui';
export const S = {
  blue: '#2563EB',
  bright: '#3B82F6',
  navy: '#132B52',
  muted: '#6B7E99',
  border: '#E1EBFA',
  pale: '#EFF6FF',
  red: '#DC3545',
};
export function SettingsGroup({ children }: { children: ReactNode }) {
  return <View style={css.group}>{children}</View>;
}
export function SettingsHeading({ children }: { children: ReactNode }) {
  return (
    <Txt bold size={13} color={S.muted} style={{ marginTop: 9, marginLeft: 4, letterSpacing: 0.8 }}>
      {children}
    </Txt>
  );
}
export function SettingsRow({
  icon,
  title,
  value,
  detail,
  onPress,
  last,
  toggle,
  disabled,
}: {
  icon: IconName;
  title: string;
  value?: string;
  detail?: string;
  onPress?: () => void;
  last?: boolean;
  toggle?: { value: boolean; onChange: (value: boolean) => void };
  disabled?: boolean;
}) {
  const content = (
    <>
      <View style={css.icon}>
        <Icon name={icon} size={20} color={S.blue} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Txt bold size={14} color={S.navy}>
          {title}
        </Txt>
        {detail && (
          <Txt size={12} color={S.muted}>
            {detail}
          </Txt>
        )}
      </View>
      {toggle ? (
        <Switch
          accessibilityLabel={title}
          disabled={disabled}
          value={toggle.value}
          onValueChange={toggle.onChange}
          trackColor={{ false: '#D9E3F2', true: S.bright }}
        />
      ) : (
        <>
          {value && (
            <Txt size={13} color={S.muted} style={{ maxWidth: '40%', textAlign: 'right' }}>
              {value}
            </Txt>
          )}
          {onPress && <Icon name="chevron-right" size={17} color="#9AAEC9" />}
        </>
      )}
    </>
  );
  return (
    <View style={{ paddingHorizontal: 16 }}>
      {onPress && !toggle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}${value ? `, ${value}` : ''}`}
          disabled={disabled}
          onPress={onPress}
          style={({ pressed }) => [css.row, { opacity: pressed || disabled ? 0.55 : 1 }]}
        >
          {content}
        </Pressable>
      ) : (
        <View style={css.row}>{content}</View>
      )}
      {!last && <View style={{ height: 1, backgroundColor: '#EDF2FA', marginLeft: 50 }} />}
    </View>
  );
}
export function SettingsButton({
  title,
  onPress,
  secondary,
  danger,
  busy,
  disabled,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  busy?: boolean;
  disabled?: boolean;
}) {
  const color = secondary ? S.blue : '#FFF';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      accessibilityState={{ disabled: !!busy || !!disabled }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: secondary ? '#CBDEFF' : danger ? S.red : S.blue,
        backgroundColor: secondary ? '#F5F9FF' : danger ? S.red : S.blue,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
        opacity: pressed || busy || disabled ? 0.6 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <Txt bold color={color}>
          {title}
        </Txt>
      )}
    </Pressable>
  );
}
/** One modal surface supports cancel/back, keyboard avoidance, and long accessibility text. */
export function SettingsSheet({
  title,
  children,
  onClose,
  busy,
  icon = 'sliders',
  danger,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  icon?: IconName;
  danger?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={css.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Dismiss dialog"
          accessibilityRole="button"
          disabled={busy}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={[css.sheet, { paddingBottom: Math.max(24, insets.bottom + 14), maxHeight: '90%' }]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 18 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View
                style={[
                  css.icon,
                  { backgroundColor: danger ? '#FFF0F2' : S.pale, width: 48, height: 48 },
                ]}
              >
                <Icon name={icon} color={danger ? S.red : S.blue} size={24} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
                disabled={busy}
                onPress={onClose}
                style={{ padding: 12 }}
              >
                <Icon name="x" color={S.muted} size={21} />
              </Pressable>
            </Row>
            <Txt size={23} bold color={S.navy}>
              {title}
            </Txt>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const css = StyleSheet.create({
  group: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: S.border,
    shadowColor: '#3976C6',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 73, paddingVertical: 14 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: S.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,35,70,0.35)',
    justifyContent: 'center',
    padding: 22,
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    padding: 24,
    borderRadius: 24,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: S.border,
  },
});
