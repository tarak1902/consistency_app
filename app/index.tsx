import { Text, View } from 'react-native';
import { useTheme } from '@/theme';

export default function Index() {
  const { c } = useTheme();
  return (
    <View
      style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: c.text }}>Compound</Text>
    </View>
  );
}
