import React, { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CampusShell } from '../modules/campus/CampusShell';
import { CampusLink } from '../modules/campus/campusLinks';

/**
 * Campus hub (students + friends): Chats, Feed, Campus, Me.
 * Deep links / notifications: /friends?tab=me&screen=requests, /friends?chatId=<id>, /friends?tab=feed&segment=wall
 */
export default function CampusScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; segment?: string; chatId?: string; chatName?: string; screen?: string }>();

  const one = (v: unknown) => (Array.isArray(v) ? v[0] : typeof v === 'string' ? v : undefined);
  const tab = one(params.tab);
  const segment = one(params.segment);
  const chatId = one(params.chatId);
  const chatName = one(params.chatName);
  const screen = one(params.screen);

  const link = useMemo<CampusLink | null>(() => {
    // Old links used ?tab=wall / ?tab=pulse / ?tab=you.
    const mappedTab =
      tab === 'wall' || tab === 'posts' || tab === 'pulse' ? 'feed' : tab === 'you' || tab === 'profile' ? 'me' : tab === 'study' ? 'campus' : tab;
    const mappedSegment = segment || (tab === 'wall' ? 'wall' : tab === 'pulse' ? 'pulse' : tab === 'study' ? 'study' : undefined);
    if (!mappedTab && !chatId && !screen && !mappedSegment) return null;
    return {
      tab: (['chats', 'feed', 'campus', 'me'].includes(mappedTab || '') ? mappedTab : undefined) as CampusLink['tab'],
      segment: mappedSegment,
      chatId,
      chatName,
      screen,
    };
  }, [tab, segment, chatId, chatName, screen]);

  // Opened from a notification / deep link there may be no screen to go back to.
  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/' as any);
  };

  return <CampusShell onBack={handleBack} link={link} />;
}
