import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { resolveMediaUrl } from '../../../../utils/imageUpload';
import { FriendsColors } from '../friendsTheme';

const initialsOf = (name?: string | null) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

/** Avatar for dark surfaces (photo, or initials in light ink). */
export const FriendsAvatar: React.FC<{ name?: string | null; uri?: string | null; size?: number }> = ({ name, uri, size = 40 }) => {
  const [failed, setFailed] = useState(false);
  const src = resolveMediaUrl(uri);
  useEffect(() => setFailed(false), [src]);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: FriendsColors.cardHi,
        borderWidth: 1,
        borderColor: FriendsColors.line,
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
};
