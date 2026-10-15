import React, { useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ban, HeartOff, ImageOff } from '../../../../components/lucide';
import { ActionMenu, ActionMenuExtra } from '../shared/ActionMenu';
import { ReportSheet } from '../shared/ReportSheet';
import { FriendsColors } from '../friendsTheme';
import { blockConnectMatch, blockConnectProfile, unmatchConnect } from '../api/connectApi';
import { connectErrorMessage } from './connectShared';

const confirm = (title: string, message: string, action: string) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: action, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) })
  );

/** Block from a card or a match (a real Friends-wide block; the other person is not told). */
export const confirmAndBlock = async (target: { name: string; profileId?: string | null; matchId?: string | null }): Promise<boolean> => {
  const ok = await confirm(
    `Block ${target.name}?`,
    "You won't see each other in Connect or anywhere in Friends, and any match and chat ends. They aren't told.",
    'Block'
  );
  if (!ok) return false;
  try {
    if (target.matchId) await blockConnectMatch(target.matchId);
    else if (target.profileId) await blockConnectProfile(target.profileId);
    else return false;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return true;
  } catch (e: any) {
    Alert.alert("Couldn't block", connectErrorMessage(e));
    return false;
  }
};

export const confirmAndUnmatch = async (matchId: string, name: string): Promise<boolean> => {
  const ok = await confirm(`Unmatch ${name}?`, 'The chat closes for both of you and you will not see each other in Connect again.', 'Unmatch');
  if (!ok) return false;
  try {
    await unmatchConnect(matchId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return true;
  } catch (e: any) {
    Alert.alert("Couldn't unmatch", connectErrorMessage(e));
    return false;
  }
};

/**
 * "…" menu for a Connect person: Report profile, Report this photo, (Unmatch), Block.
 * Reports go to the unified moderation queue; a person reviews each one.
 */
export const ConnectPersonMenu: React.FC<{
  visible: boolean;
  onClose: () => void;
  name: string;
  profileId: string | null;
  photoId?: string | null;
  matchId?: string | null;
  onBlocked: () => void;
  onUnmatched?: () => void;
}> = ({ visible, onClose, name, profileId, photoId, matchId, onBlocked, onUnmatched }) => {
  const [photoReport, setPhotoReport] = useState<string | null>(null);
  const later = (fn: () => void) => {
    onClose();
    setTimeout(fn, Platform.OS === 'ios' ? 450 : 50);
  };
  const extra: ActionMenuExtra[] = [];
  if (photoId) {
    extra.push({
      key: 'photo',
      label: 'Report this photo',
      icon: <ImageOff size={18} color={FriendsColors.danger} />,
      destructive: true,
      onPress: () => later(() => setPhotoReport(photoId)),
    });
  }
  if (matchId && onUnmatched) {
    extra.push({
      key: 'unmatch',
      label: 'Unmatch',
      icon: <HeartOff size={18} color={FriendsColors.ink} />,
      onPress: () =>
        later(async () => {
          if (await confirmAndUnmatch(matchId, name)) onUnmatched();
        }),
    });
  }
  if (profileId || matchId) {
    extra.push({
      key: 'block',
      label: `Block ${name}`,
      destructive: true,
      icon: <Ban size={18} color={FriendsColors.danger} />,
      onPress: () =>
        later(async () => {
          if (await confirmAndBlock({ name, profileId, matchId })) onBlocked();
        }),
    });
  }
  return (
    <>
      <ActionMenu
        visible={visible}
        onClose={onClose}
        title={name}
        report={profileId ? { type: 'connect_profile', id: profileId, label: `${name}'s Connect profile` } : null}
        extra={extra}
      />
      <ReportSheet
        visible={!!photoReport}
        onClose={() => setPhotoReport(null)}
        target={photoReport ? { type: 'connect_photo', id: photoReport, label: `a photo on ${name}'s profile` } : null}
      />
    </>
  );
};
