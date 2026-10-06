import { useState } from 'react';
import { Pressable, View, type TextInputProps } from 'react-native';
import { Field, Icon } from './ui';

export function PasswordField({
  label,
  ...props
}: Omit<TextInputProps, 'secureTextEntry'> & { label: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <Field
        {...props}
        label={label}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={!visible}
        style={[props.style, { paddingRight: 56 }]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        accessibilityState={{ disabled: props.editable === false, expanded: visible }}
        disabled={props.editable === false}
        onPress={() => setVisible((value) => !value)}
        style={({ pressed }) => ({
          position: 'absolute',
          right: 4,
          bottom: 3,
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed || props.editable === false ? 0.5 : 1,
        })}
      >
        <Icon name={visible ? 'eye-off' : 'eye'} color="#2563EB" size={20} />
      </Pressable>
    </View>
  );
}
