import React, { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CampusShell } from '../modules/campus/CampusShell';
import { CampusLink, isFriendsSub } from '../modules/campus/campusLinks';

/**
 * Campus hub (students + friends): Chats, Friends, Campus, Me.
 * Deep links / notifications:
 *   /friends?tab=me&screen=requests, /friends?chatId=<id>
 *   /friends?tab=friends&sub=pulse|spaces|forum|tasks|connect&id=<id>
 *   /friends?tab=friends&sub=pulse&segment=wall (old campus feed: posts | wall | pulse)
 * Old links (?tab=feed|posts|wall|pulse) open Friends > Pulse.
 */
export default function CampusScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    tab?: string;
    sub?: string;
    id?: string;
    segment?: string;
    chatId?: string;
    chatName?: string;
    screen?: string;
  }>();

  const one = (v: unknown) => (Array.isArray(v) ? v[0] : typeof v === 'string' ? v : undefined);
  const tab = one(params.tab);
  const sub = one(params.sub);
  const id = one(params.id);
  const segment = one(params.segment);
  const chatId = one(params.chatId);
  const chatName = one(params.chatName);
  const screen = one(params.screen);

  const link = useMemo<CampusLink | null>(() => {
    // Old links used ?tab=feed / wall / posts / pulse (campus feed) and ?tab=you / profile / study.
    const isOldFeed = tab === 'feed' || tab === 'wall' || tab === 'posts' || tab === 'pulse';
    const mappedTab = isOldFeed
      ? 'friends'
      : tab === 'you' || tab === 'profile'
      ? 'me'
      : tab === 'study'
      ? 'campus'
      : tab;
    const mappedSegment =
      segment || (tab === 'wall' ? 'wall' : tab === 'posts' ? 'posts' : tab === 'pulse' ? 'pulse' : tab === 'study' ? 'study' : undefined);
    const mappedSub = isFriendsSub(sub) ? sub : isOldFeed || (mappedTab === 'friends' && mappedSegment) ? 'pulse' : undefined;
    if (!mappedTab && !chatId && !screen && !mappedSegment && !mappedSub) return null;
    return {
      tab: (['chats', 'friends', 'campus', 'me'].includes(mappedTab || '')
        ? mappedTab
        : mappedSub
        ? 'friends'
        : undefined) as CampusLink['tab'],
      sub: mappedSub,
      id,
      segment: mappedSegment,
      chatId,
      chatName,
      screen,
    };
  }, [tab, sub, id, segment, chatId, chatName, screen]);

  // Opened from a notification / deep link there may be no screen to go back to.
  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/' as any);
  };

  return <CampusShell onBack={handleBack} link={link} />;
}
