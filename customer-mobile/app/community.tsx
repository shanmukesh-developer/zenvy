import React from 'react';
import { CommunityFeed } from '../modules/campus/feed/CommunityFeed';

/**
 * Community home (the Home 💬 button): posts that expire in 48 hours, reviews, birthdays and
 * The Wall event contest, with the Friends card that opens Campus Buddy (Pulse, Forum, Tasks,
 * Connect, Spaces). The full-screen feed brings its own header, back button and tabs.
 */
export default function CommunityScreen() {
  return <CommunityFeed />;
}
