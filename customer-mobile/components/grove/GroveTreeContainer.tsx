import React, { useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { generateGroveHtml, type Props } from './groveHtmlGenerator';

export type { Props };

function GroveTreeContainer(props: Props) {
  const webViewRef = useRef<WebView>(null);

  const html = useMemo(() => {
    return generateGroveHtml({
      friends: props.friends,
      seedKey: props.seedKey || 'zenvy-grove',
      tod: props.tod,
      filter: props.filter,
      showBonds: props.showBonds,
      isRaining: props.isRaining,
    });
  }, [
    props.friends,
    props.seedKey,
    props.tod,
    props.filter,
    props.showBonds,
    props.isRaining,
  ]);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'selectFriend') {
        props.onSelectFriend?.(data.id);
      } else if (data.type === 'openStory') {
        props.onOpenStory?.(data.friendId, data.storyId);
      } else if (data.type === 'post') {
        props.onPost?.();
      }
    } catch (e) {
      console.warn('[GROVE_WEBVIEW_MESSAGE_ERROR]', e);
    }
  }, [props.onSelectFriend, props.onOpenStory, props.onPost]);

  return (
    <View style={styles.root}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webView}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    backgroundColor: '#04050d',
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    width: '100%',
    backgroundColor: '#04050d',
  },
});

export default React.memo(GroveTreeContainer, (prev, next) => {
  return (
    prev.friends === next.friends &&
    prev.seedKey === next.seedKey &&
    prev.tod === next.tod &&
    prev.filter === next.filter &&
    prev.showBonds === next.showBonds &&
    prev.isRaining === next.isRaining
  );
});
