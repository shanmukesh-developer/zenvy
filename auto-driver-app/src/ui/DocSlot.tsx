// One document / photo slot: signed preview (1-hour link from the server), Camera / Gallery buttons,
// private upload, then onUploaded(path) so the screen saves the reference.
import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, font, radius, space } from '../theme';
import { Badge, Button } from './kit';
import { useToast } from './Toast';
import { pickPhoto, uploadPhoto, type PhotoSource } from '../lib/photo';
import { errorMessage } from '../lib/http';

export function DocSlot({
  label, required, previewUrl, hasDoc, onUploaded, disabled,
}: {
  label: string;
  required?: boolean;
  /** signed preview from the server (null when none / expired) */
  previewUrl?: string | null;
  hasDoc: boolean;
  onUploaded: (path: string, previewUrl: string | null) => Promise<void>;
  disabled?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<PhotoSource | null>(null);
  const [failed, setFailed] = useState(false);

  const take = async (src: PhotoSource) => {
    if (busy) return;
    setBusy(src);
    try {
      const pick = await pickPhoto(src);
      if (!pick.ok) {
        if (pick.reason !== 'cancelled') toast.show(pick.message, 'error');
        return;
      }
      const up = await uploadPhoto(pick.uri, pick.mimeType);
      await onUploaded(up.url, up.previewUrl);
      setFailed(false);
      toast.show('Saved', 'success');
    } catch (e) {
      toast.show(errorMessage(e, 'Upload failed. Please try again.'), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Text style={[font.h3, { color: color.text, flex: 1 }]}>{label}</Text>
        {hasDoc ? <Badge text="ADDED" fg={color.openDark} bg={color.openTint} icon="checkmark" />
          : required ? <Badge text="REQUIRED" fg={color.alertDark} bg={color.alertTint} /> : <Badge text="OPTIONAL" fg={color.textMuted} bg={color.surfaceAlt} />}
      </View>
      {hasDoc && previewUrl && !failed ? (
        <Image source={{ uri: previewUrl }} style={styles.preview} resizeMode="contain" onError={() => setFailed(true)} accessibilityLabel={`${label} photo`} />
      ) : hasDoc ? (
        <View style={[styles.preview, styles.placeholder]}>
          <Ionicons name="document-attach" size={36} color={color.textMuted} />
          <Text style={[font.small, { color: color.textMuted }]}>Uploaded. Pull down to refresh the preview.</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.xs }}>
        <Button label={hasDoc ? 'Retake' : 'Camera'} icon="camera" size="secondary" variant={hasDoc ? 'secondary' : 'primary'} style={{ flex: 1 }} loading={busy === 'camera'} disabled={disabled || !!busy} onPress={() => take('camera')} />
        <Button label="Gallery" icon="images" size="secondary" variant="secondary" style={{ flex: 1 }} loading={busy === 'gallery'} disabled={disabled || !!busy} onPress={() => take('gallery')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.md, borderWidth: 1, borderColor: color.border, gap: space.sm },
  preview: { width: '100%', height: 180, borderRadius: radius.md, backgroundColor: color.surfaceAlt },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: space.xs, padding: space.md },
});
