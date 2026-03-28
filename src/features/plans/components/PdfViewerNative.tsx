import Pdf from 'react-native-pdf';

type Props = {
  uri: string;
  page: number;
};

export function PdfViewerNative({ uri, page }: Props) {
  return (
    <Pdf
      source={{ uri }}
      page={page}
      enablePaging
      horizontal
      style={{ flex: 1, backgroundColor: '#0F172A' }}
      onError={(err: any) => {
        console.error('[Plans] PDF render error:', err);
      }}
    />
  );
}
