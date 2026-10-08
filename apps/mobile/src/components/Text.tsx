import { forwardRef } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { fontFamily } from '../lib/theme';

/**
 * Text and TextInput in the app font (Inter). Use these instead of the react-native ones.
 *
 * With a custom font every weight is its own font file, so `fontWeight` alone wouldn't pick
 * Inter Bold (iOS would fall back to the system font; Android would fake the bold). These
 * read the style's `fontWeight` and set the matching Inter family, so styles keep using
 * plain `fontWeight: '600'` etc.
 */
export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...props }, ref) {
  return <RNText ref={ref} {...props} style={[style, interStyle(style)]} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  { style, ...props },
  ref,
) {
  return <RNTextInput ref={ref} {...props} style={[style, interStyle(style)]} />;
});

function interStyle(style: TextProps['style']): TextStyle {
  const { fontWeight, fontFamily: explicit } = StyleSheet.flatten(style) ?? {};
  if (explicit) return {}; // a style that names a font on purpose keeps it
  // fontWeight is reset so iOS doesn't try to embolden the already-bold Inter file.
  return { fontFamily: fontFamily(fontWeight), fontWeight: 'normal' };
}
