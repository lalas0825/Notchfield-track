import { Text, View } from 'react-native';

type Props = {
  uri: string;
  page: number;
};

export function PdfViewerNative({ uri, page }: Props) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#94A3B8', fontSize: 16 }}>
        PDF viewing is available on the mobile app.
      </Text>
    </View>
  );
}
