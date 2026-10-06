/** Native date/time controls; a separate web file keeps native modules out of browser builds. */
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Icon, Row, Txt, styles } from './ui';
export interface DateFieldProps {
  label: string;
  value: Date;
  mode: 'date' | 'time';
  onChange: (date: Date) => void;
}
export function DateField({ label, value, mode, onChange }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <Txt size={13} bold>
        {label}
      </Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.input}
        onPress={() => setOpen(true)}
      >
        <Row>
          <Icon name={mode === 'date' ? 'calendar' : 'clock'} size={17} />
          <Txt>
            {mode === 'date'
              ? value.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
              : value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </Txt>
        </Row>
      </Pressable>
      {open && (
        <DateTimePicker
          value={value}
          mode={mode}
          onDismiss={() => setOpen(false)}
          onValueChange={(_event, date) => {
            setOpen(Platform.OS === 'ios');
            onChange(date);
          }}
        />
      )}
    </View>
  );
}
