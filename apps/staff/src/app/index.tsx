import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

/** Start: wait for the stored login, then go to Home or Login. */
export default function Index() {
  const { loading, me } = useSession();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator color={theme.text} />
      </View>
    );
  }
  return <Redirect href={me ? '/home' : '/login'} />;
}
