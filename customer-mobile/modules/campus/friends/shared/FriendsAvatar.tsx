import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { resolveMediaUrl } from '../../../../utils/imageUpload';
import { FriendsColors } from '../friendsTheme';
import { GradientRing } from './FriendsUi';

const initialsOf = (name?: string | null) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

/** Stable tint per name so initials avatars are told apart at a glance (all AA with dark ink-on-tint). */
const AVATAR_TINTS = ['#2E2747', '#1F3340', '#3A2A1E', '#2F2236', '#1E3328', '#3A2230'];
const tintFor = (name?: string | null) => {
  const s = String(name || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_TINTS[Math.abs(h) % AVATAR_TINTS.length];
};

/** Avatar for dark surfaces (photo, or initials on a soft per-name tint). `ring` adds the brand gradient ring. */
export const FriendsAvatar: React.FC<{ name?: string | null; uri?: string | null; size?: number; ring?: boolean }> = ({ name, uri, size = 40, ring }) => {
  const [failed, setFailed] = useState(false);
  const src = resolveMediaUrl(uri);
  useEffect(() => setFailed(false), [src]);
  const body = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: src && !failed ? FriendsColors.cardHi : tintFor(name),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {src && !failed ? (
        <Image source={{ uri: src }} style={{ width: size, height: size }} contentFit="cover" onError={() => setFailed(true)} />
      ) : (
        <Text style={{ fontSize: Math.max(11, size * 0.34), fontWeight: '800', color: FriendsColors.ink }}>{initialsOf(name)}</Text>
      )}
    </View>
  );
  return ring ? <GradientRing size={size}>{body}</GradientRing> : body;
};
