import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { SPACES_AUDIO_HTML } from './spacesAudioHtml';
import type { SpaceIceServer, SpaceSignalPayload } from './spacesSocket';
import type { SpaceRole } from '../api/spacesApi';

export type SpaceEngineCommand =
  | { cmd: 'start'; iceServers: SpaceIceServer[]; role: SpaceRole; muted: boolean }
  | { cmd: 'ice_servers'; iceServers: SpaceIceServer[] }
  | { cmd: 'role'; role: SpaceRole; muted?: boolean }
  | { cmd: 'connect'; peer: string; initiator: boolean; direction: 'sendonly' | 'recvonly' | 'sendrecv' }
  | { cmd: 'close'; peer: string }
  | { cmd: 'signal'; peer: string; payload: SpaceSignalPayload }
  | { cmd: 'mute'; muted: boolean }
  | { cmd: 'resume' }
  | { cmd: 'hangup' };

export type SpaceEngineMessage =
  | { type: 'ready' }
  | { type: 'signal'; peer: string; payload: SpaceSignalPayload }
  | { type: 'peer_state'; peer: string; state: string }
  | { type: 'mic'; ok: boolean; error?: string }
  | { type: 'speaking'; ids: string[] }
  | { type: 'error'; peer?: string; message: string }
  /** The WebView renderer restarted: every peer connection is gone (re-join to rebuild them). */
  | { type: 'reset' };

export interface SpaceAudioEngineHandle {
  send: (c: SpaceEngineCommand) => void;
}

/**
 * Hidden WebView that runs the Spaces WebRTC audio engine (spacesAudioHtml.ts).
 * Commands sent before the page is ready are queued and replayed in order.
 * Known limit: Android / iOS may pause WebView audio while the app is in the background.
 */
export const SpaceAudioEngine = forwardRef<SpaceAudioEngineHandle, { onMessage: (m: SpaceEngineMessage) => void }>(({ onMessage }, ref) => {
  const web = useRef<WebView>(null);
  const ready = useRef(false);
  const queue = useRef<SpaceEngineCommand[]>([]);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const inject = useCallback((c: SpaceEngineCommand) => {
    web.current?.injectJavaScript(`window.__fromRN && window.__fromRN(${JSON.stringify(c)}); true;`);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      send: (c) => {
        if (!ready.current) {
          queue.current.push(c);
          return;
        }
        inject(c);
      },
    }),
    [inject]
  );

  const handle = (e: WebViewMessageEvent) => {
    let m: SpaceEngineMessage | null = null;
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (!m || typeof (m as any).type !== 'string') return;
    if (m.type === 'ready') {
      ready.current = true;
      const pending = queue.current;
      queue.current = [];
      pending.forEach(inject);
    }
    onMessageRef.current(m);
  };

  return (
    <View style={styles.hidden} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <WebView
        ref={web}
        originWhitelist={['*']}
        source={{ html: SPACES_AUDIO_HTML, baseUrl: 'https://localhost' }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        mixedContentMode="always"
        onLoadStart={() => {
          // A reload (renderer restart) loses the page state: queue until it says ready again.
          ready.current = false;
        }}
        onMessage={handle}
        onRenderProcessGone={() => {
          ready.current = false;
          web.current?.reload();
          onMessageRef.current({ type: 'reset' });
        }}
        onContentProcessDidTerminate={() => {
          ready.current = false;
          web.current?.reload();
          onMessageRef.current({ type: 'reset' });
        }}
        style={styles.web}
      />
    </View>
  );
});
SpaceAudioEngine.displayName = 'SpaceAudioEngine';

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10, overflow: 'hidden' },
  web: { width: 1, height: 1, backgroundColor: 'transparent' },
});
