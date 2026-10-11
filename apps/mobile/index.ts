import { Platform } from 'react-native';
import 'expo-router/entry';

// Android draws home-screen widgets in a background task (see src/widgets). Loaded only on
// Android, so iOS and the web preview never import the Android widget library.
if (Platform.OS === 'android') {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { registerWidgetTaskHandler } = require('react-native-android-widget') as typeof import('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widgets/android-task') as typeof import('./src/widgets/android-task');
  /* eslint-enable @typescript-eslint/no-require-imports */
  registerWidgetTaskHandler(widgetTaskHandler);
}
