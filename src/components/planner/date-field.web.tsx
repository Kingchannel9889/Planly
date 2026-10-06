/** Browser-only date/time inputs are development conveniences. */
import { View } from 'react-native';
import { dayKey } from '@/core/planner';
import { C, Txt } from './ui';
interface Props {
  label: string;
  value: Date;
  mode: 'date' | 'time';
  onChange: (date: Date) => void;
}
export function DateField({ label, value, mode, onChange }: Props) {
  const clock = `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  return (
    <View style={{ gap: 7 }}>
      <Txt size={13} bold>
        {label}
      </Txt>
      <input
        aria-label={label}
        type={mode}
        value={mode === 'date' ? dayKey(value) : clock}
        onChange={(e) => {
          if (!e.target.value) return;
          const next =
            mode === 'date'
              ? new Date(`${e.target.value}T${clock}:00`)
              : new Date(`${dayKey(value)}T${e.target.value}:00`);
          if (Number.isFinite(+next)) onChange(next);
        }}
        style={{
          minHeight: 49,
          boxSizing: 'border-box',
          border: '1px solid #CBDBEF',
          borderRadius: 12,
          padding: '12px 13px',
          color: C.navy,
          background: '#FFF',
          fontFamily: 'inherit',
          fontSize: 15,
          width: '100%',
        }}
      />
    </View>
  );
}
