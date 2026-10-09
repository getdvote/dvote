import { forwardRef } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { getLanguage, isRtl } from '../i18n';
import { fontFamily } from '../lib/theme';

/**
 * Text and TextInput in the app font (Inter; IBM Plex Sans Arabic when the app is in Arabic).
 * Use these instead of the react-native ones.
 *
 * With a custom font every weight is its own font file, so `fontWeight` alone wouldn't pick
 * Inter Bold (iOS would fall back to the system font; Android would fake the bold). These
 * read the style's `fontWeight` and set the matching Inter family, so styles keep using
 * plain `fontWeight: '600'` etc. In Arabic, text starts on the right (see readingSide).
 */
export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...props }, ref) {
  return <RNText ref={ref} {...props} style={[readingSide(style), style, interStyle(style)]} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  { style, ...props },
  ref,
) {
  // Typed text starts on the reading side: right in Arabic, unless a style sets textAlign.
  const align: TextStyle = StyleSheet.flatten(style)?.textAlign ? {} : { textAlign: isRtl(getLanguage()) ? 'right' : 'left' };
  return <RNTextInput ref={ref} {...props} style={[align, style, interStyle(style)]} />;
});

function interStyle(style: TextProps['style']): TextStyle {
  const { fontWeight, fontFamily: explicit } = StyleSheet.flatten(style) ?? {};
  if (explicit) return {}; // a style that names a font on purpose keeps it
  // fontWeight is reset so iOS doesn't try to embolden the already-bold Inter file.
  return { fontFamily: fontFamily(fontWeight, isRtl(getLanguage())), fontWeight: 'normal' };
}

/**
 * Arabic text starts on the right. Screens and sheets switch to right-to-left with `direction`,
 * and inside such a view iOS mirrors textAlign: 'left' means the start side, i.e. the right
 * (text with no textAlign stays on the left). So 'left' here, unless the style chooses.
 */
function readingSide(style: TextProps['style']): TextStyle {
  if (!isRtl(getLanguage()) || StyleSheet.flatten(style)?.textAlign) return {};
  return { textAlign: 'left' };
}
