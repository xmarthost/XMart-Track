import { View } from 'react-native';
import { colors } from '../state/status';

// The root layout decides where to go (login or monitor) after restoring the session.
export default function Index() {
  return <View style={{ flex: 1, backgroundColor: colors.tealDark }} />;
}
