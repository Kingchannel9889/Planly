/** Planly's shared visual language: spacious cards, navy text, and clear labelled states. */
import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ColorValue,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Attention } from '@/core/model';
export const C = {
  blue: '#0878FF',
  navy: '#102657',
  muted: '#657797',
  bg: '#F5F9FF',
  line: '#E0EAF7',
  pale: '#EAF3FF',
  teal: '#069B89',
  red: '#D7374A',
  orange: '#B65C09',
};
export type IconName = ComponentProps<typeof Feather>['name'];
export function Icon({
  name,
  size = 22,
  color = C.blue,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
}) {
  return <Feather name={name} size={size} color={color} />;
}
export function Txt({
  children,
  muted = false,
  size = 15,
  bold = false,
  color,
  style,
}: {
  children: ReactNode;
  muted?: boolean;
  size?: number;
  bold?: boolean;
  color?: string;
  style?: ComponentProps<typeof Text>['style'];
}) {
  return (
    <Text
      style={[
        {
          color: color ?? (muted ? C.muted : C.navy),
          fontSize: size,
          lineHeight: size * 1.45,
          fontWeight: bold ? '700' : '400',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>{children}</View>
  );
}
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Button({
  title,
  onPress,
  icon,
  secondary,
  danger,
  disabled,
  busy,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  const color = secondary ? (danger ? C.red : C.blue) : '#FFFFFF';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary ? '#FFFFFF' : danger ? C.red : C.blue,
          borderColor: danger ? '#F5C7CE' : secondary ? '#B6D6FF' : C.blue,
          opacity: disabled || busy ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} />
      ) : icon ? (
        <Icon name={icon} size={18} color={color} />
      ) : null}
      <Txt bold color={color}>
        {title}
      </Txt>
    </Pressable>
  );
}
export function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.iconButton}
    >
      <Icon name={icon} />
    </Pressable>
  );
}
export function Section({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
      <Txt size={18} bold>
        {title}
      </Txt>
      {action && (
        <Pressable accessibilityRole="button" onPress={onPress} style={{ padding: 10 }}>
          <Txt size={13} bold color={C.blue}>
            {action}
          </Txt>
        </Pressable>
      )}
    </Row>
  );
}
export function Screen({
  children,
  title,
  subtitle,
  back,
  action,
  scroll = true,
  resetScrollOnFocus = false,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
  scroll?: boolean;
  resetScrollOnFocus?: boolean;
}) {
  const scrollRef = useRef<ScrollView>(null);
  useFocusEffect(
    useCallback(() => {
      if (resetScrollOnFocus) scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [resetScrollOnFocus]),
  );
  const content = (
    <>
      {title && (
        <Row style={{ marginBottom: 8 }}>
          {back && (
            <IconButton
              icon="arrow-left"
              label="Go back"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            />
          )}
          <View style={{ flex: 1 }}>
            <Txt size={28} bold>
              {title}
            </Txt>
            {subtitle && (
              <Txt muted size={13}>
                {subtitle}
              </Txt>
            )}
          </View>
          {action}
        </Row>
      )}
      {children}
    </>
  );
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.screen}
          >
            {content}
          </ScrollView>
        ) : (
          <View style={[styles.screen, { flex: 1 }]}>{content}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Txt size={13} bold>
        {label}
      </Txt>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#93A2BA"
        {...props}
        style={[
          styles.input,
          props.multiline && { minHeight: 88, textAlignVertical: 'top' },
          props.style,
        ]}
      />
    </View>
  );
}
export function Chips<T extends string>({
  values,
  value,
  onChange,
}: {
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {values.map((v) => (
        <Pressable
          key={v}
          accessibilityRole="button"
          accessibilityState={{ selected: v === value }}
          onPress={() => onChange(v)}
          style={[styles.chip, v === value && { backgroundColor: C.blue, borderColor: C.blue }]}
        >
          <Txt size={13} bold color={v === value ? '#FFF' : C.muted}>
            {v}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}
const badgeColors: Record<string, [string, string]> = {
  Overdue: ['#FDE9EE', '#B52541'],
  Critical: ['#FFF0EF', '#CF302D'],
  Urgent: ['#FFF3E4', '#AC5608'],
  Important: ['#FEE2E2', '#B91C1C'],
  Normal: ['#E6F7F2', '#097E6D'],
  Unfinished: ['#EEF0FF', '#6355B6'],
  Completed: ['#E6F7F2', '#097E6D'],
  Fixed: ['#E9F2FF', '#1D65B9'],
  Past: ['#EFF2F7', '#64758E'],
};
export function Badge({ label }: { label: Attention | string }) {
  const [bg, fg] = badgeColors[label] ?? badgeColors.Normal;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: bg,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 7,
      }}
    >
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: fg }} />
      <Txt size={10} bold color={fg}>
        {label.toUpperCase()}
      </Txt>
    </View>
  );
}
export function Banner({ text, warning = false }: { text: string; warning?: boolean }) {
  return (
    <Card
      style={{
        backgroundColor: warning ? '#FFF3E7' : C.pale,
        borderColor: warning ? '#F3D8B9' : '#D6E7FF',
      }}
    >
      <Row>
        <Icon
          name={warning ? 'alert-circle' : 'info'}
          color={warning ? C.orange : C.blue}
          size={18}
        />
        <Txt size={13} style={{ flex: 1 }} color={warning ? C.orange : C.navy}>
          {text}
        </Txt>
      </Row>
    </Card>
  );
}
export function Brand({ large = false }: { large?: boolean }) {
  return (
    <Row style={{ gap: 11 }}>
      <Image
        source={require('@/assets/images/planly-icon.png')}
        accessibilityLabel="Planly calendar logo"
        style={{ width: large ? 70 : 48, height: large ? 70 : 48, borderRadius: large ? 20 : 13 }}
      />
      <View>
        <Txt size={large ? 34 : 24} bold>
          Planly
        </Txt>
        <Txt size={large ? 13 : 10} muted>
          Plan today. Protect tomorrow.
        </Txt>
      </View>
    </Row>
  );
}
export function Empty({ title, body, onAdd }: { title: string; body: string; onAdd?: () => void }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 36, gap: 13 }}>
      <View style={{ backgroundColor: C.pale, padding: 22, borderRadius: 28, marginBottom: 5 }}>
        <Icon name="calendar" size={44} />
      </View>
      <Txt size={21} bold>
        {title}
      </Txt>
      <Txt muted style={{ textAlign: 'center', maxWidth: 270 }}>
        {body}
      </Txt>
      {onAdd && (
        <View style={{ alignSelf: 'stretch', marginTop: 9 }}>
          <Button title="Add your first task" icon="plus" onPress={onAdd} />
        </View>
      )}
    </Card>
  );
}
export const styles = StyleSheet.create({
  screen: { padding: 22, paddingBottom: 40, gap: 16 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
    gap: 12,
  },
  button: {
    minHeight: 49,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CBDBEF',
    borderRadius: 12,
    minHeight: 49,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: C.navy,
    fontSize: 15,
  },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: C.line,
  },
});
