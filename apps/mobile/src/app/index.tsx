import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

/** Start: wait for the stored sign-in, then go to the cards or the welcome screen. */
export default function Index() {
  const { loading, session } = useSession();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator color={theme.text} />
      </View>
    );
  }
  return <Redirect href={session ? '/(tabs)/cards' : '/welcome'} />;
}
