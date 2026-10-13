import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, ActivityIndicator } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Flag, VolumeX, Volume2, Ban, Link, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { FriendsSheet } from './FriendsSheet';
import { ReportSheet, ReportTarget } from './ReportSheet';
import { FriendsColors, FS, FT, fui } from '../friendsTheme';
import { muteTarget, unmuteTarget, MuteTargetType } from '../api/core';
import { blockCampusUser } from '../../campusApi';

export interface ActionMenuExtra {
  key: string;
  label: string;
  icon?: React.ReactNode;
  destructive?: boolean;
  onPress: () => void | Promise<void>;
}

/**
 * The "…" menu used on every Friends item: Report, Mute, Block, Copy link, Delete (own content).
 * Each action is shown only when its prop is given. Anonymous content passes no `block` / `mute`
 * user (the server never tells the app who wrote it); report still works.
 */
export const ActionMenu: React.FC<{
  visible: boolean;
  onClose: () => void;
  title?: string;
  report?: ReportTarget | null;
  mute?: { targetType: MuteTargetType; targetId: string; label: string; muted?: boolean } | null;
  block?: { userId: string; name: string } | null;
  copyLink?: string | null;
  /** Own content only. Asked for confirmation first. */
  onDelete?: (() => Promise<void> | void) | null;
  deleteLabel?: string;
  extra?: ActionMenuExtra[];
  onMuteChanged?: (muted: boolean) => void;
  onBlocked?: (userId: string) => void;
}> = ({ visible, onClose, title = 'Options', report, mute, block, copyLink, onDelete, deleteLabel = 'Delete', extra, onMuteChanged, onBlocked }) => {
  const [reportOpen, setReportOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // iOS can't present a modal while another is still sliding away.
  const afterClose = useCallback(
    (fn: () => void) => {
      onClose();
      setTimeout(fn, Platform.OS === 'ios' ? 450 : 0);
    },
    [onClose]
  );

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } catch (e: any) {
      Alert.alert("Couldn't do that", e?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const doMute = () =>
    mute &&
    run('mute', async () => {
      if (mute.muted) {
        await unmuteTarget(mute.targetType, mute.targetId);
        onMuteChanged?.(false);
      } else {
        await muteTarget(mute.targetType, mute.targetId);
        onMuteChanged?.(true);
      }
      Haptics.selectionAsync().catch(() => {});
      onClose();
    });

  const doBlock = () => {
    if (!block) return;
    Alert.alert(
      `Block ${block.name}?`,
      "They won't be able to message or call you, and you won't see each other's posts in Friends. They aren't told.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () =>
            run('block', async () => {
              await blockCampusUser(block.userId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              onBlocked?.(block.userId);
              onClose();
            }),
        },
      ]
    );
  };

  const doDelete = () => {
    if (!onDelete) return;
    Alert.alert(`${deleteLabel}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: deleteLabel,
        style: 'destructive',
        onPress: () =>
          run('delete', async () => {
            await onDelete();
            onClose();
          }),
      },
    ]);
  };

  const rows: { key: string; label: string; icon: React.ReactNode; destructive?: boolean; onPress: () => void }[] = [];
  if (copyLink) {
    rows.push({
      key: 'copy',
      label: 'Copy link',
      icon: <Link size={18} color={FriendsColors.ink} />,
      onPress: () => {
        Clipboard.setString(copyLink);
        Haptics.selectionAsync().catch(() => {});
        onClose();
      },
    });
  }
  (extra || []).forEach((x) =>
    rows.push({
      key: x.key,
      label: x.label,
      icon: x.icon || <View style={{ width: 18 }} />,
      destructive: x.destructive,
      onPress: () => run(x.key, async () => {
        await x.onPress();
      }),
    })
  );
  if (mute) {
    rows.push({
      key: 'mute',
      label: mute.muted ? `Unmute ${mute.label}` : `Mute ${mute.label}`,
      icon: mute.muted ? <Volume2 size={18} color={FriendsColors.ink} /> : <VolumeX size={18} color={FriendsColors.ink} />,
      onPress: doMute,
    });
  }
  if (report) {
    rows.push({
      key: 'report',
      label: 'Report',
      icon: <Flag size={18} color={FriendsColors.danger} />,
      destructive: true,
      onPress: () => afterClose(() => setReportOpen(true)),
    });
  }
  if (block) {
    rows.push({ key: 'block', label: `Block ${block.name}`, icon: <Ban size={18} color={FriendsColors.danger} />, destructive: true, onPress: doBlock });
  }
  if (onDelete) {
    rows.push({ key: 'delete', label: deleteLabel, icon: <Trash2 size={18} color={FriendsColors.danger} />, destructive: true, onPress: doDelete });
  }

  return (
    <>
      <FriendsSheet visible={visible} onClose={onClose} title={title}>
        <View style={fui.card}>
          {rows.map((r, i) => (
            <TouchableOpacity
              key={r.key}
              style={[fui.row, i === rows.length - 1 && { borderBottomWidth: 0 }]}
              onPress={r.onPress}
              disabled={!!busy}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={r.label}
            >
              {busy === r.key ? <ActivityIndicator size="small" color={FriendsColors.muted} /> : r.icon}
              <Text style={[FT.h3, r.destructive && { color: FriendsColors.danger }]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
          {rows.length === 0 ? (
            <View style={[fui.row, { borderBottomWidth: 0 }]}>
              <Text style={FT.muted}>No actions available.</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity style={[fui.ghostBtn, { marginTop: FS.md }]} onPress={onClose} accessibilityRole="button">
          <Text style={fui.ghostBtnText}>Cancel</Text>
        </TouchableOpacity>
      </FriendsSheet>
      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} target={report || null} />
    </>
  );
};

