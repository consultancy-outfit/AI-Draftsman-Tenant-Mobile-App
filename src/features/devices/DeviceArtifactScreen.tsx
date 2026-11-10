import { ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Paths, File as FsFile } from 'expo-file-system';
import { WebView } from 'react-native-webview';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, ErrorState, Loader, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';
import type { ChatConversationStackParamList } from '@/navigation/types';

import { useGetDeviceArtifactQuery } from './devicesApi';

type Rt = RouteProp<ChatConversationStackParamList, 'DeviceArtifact'>;

/** A locked-down page: no scripts, no network (default-src 'none'). */
const wrapHtml = (html: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;"></head><body>${html}</body></html>`;

export function DeviceArtifactScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const { params } = useRoute<Rt>();
  const q = useGetDeviceArtifactQuery({ artifactId: params.artifactId, computerKeyId: params.computerKeyId });
  const a = q.data;

  const save = async () => {
    if (!a) return;
    try {
      const file = new FsFile(Paths.document, a.filename.replace(/[\\/]/g, '_'));
      if (file.exists) file.delete();
      file.create();
      file.write(a.content);
      toast.show(`Saved ${file.name}.`, { tone: 'success' });
    } catch {
      /* fall back to the clipboard so the text is never lost */
      await Clipboard.setStringAsync(a.content);
      toast.show('Could not save the file. The text was copied instead.', { tone: 'neutral' });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={a?.title ?? 'File from your computer'} mode="stack" onBack={() => navigation.goBack()} />
      {q.isLoading ? (
        <Loader fullScreen />
      ) : q.error || !a ? (
        <ErrorState title="Could not open this file" message={getErrorMessage(q.error as never)} onRetry={() => void q.refetch()} />
      ) : (
        <>
          {a.mimeType === 'text/html' ? (
            <WebView
              originWhitelist={['about:*']}
              source={{ html: wrapHtml(a.content) }}
              javaScriptEnabled={false}
              domStorageEnabled={false}
              onShouldStartLoadWithRequest={(r) => r.url === 'about:blank'}
              style={{ flex: 1 }}
            />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text selectable style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: 13, lineHeight: 19 }}>
                {a.content}
              </Text>
            </ScrollView>
          )}
          <View style={{ padding: 16 }}>
            <Button label="Download" onPress={() => void save()} fullWidth />
          </View>
        </>
      )}
    </View>
  );
}
