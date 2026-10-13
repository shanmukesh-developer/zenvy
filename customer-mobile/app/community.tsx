import React from 'react';
import { Redirect } from 'expo-router';

/**
 * Community (posts, reviews, birthdays, The Wall) now lives in the Campus hub: Friends > Pulse.
 * Old links, notifications and announcements that open /community land there.
 */
export default function CommunityRedirect() {
  return <Redirect href={{ pathname: '/friends', params: { tab: 'friends', sub: 'pulse' } } as any} />;
}
