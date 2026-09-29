/** sampleFriends.ts — drop-in demo data so you can render the grove immediately. */
import type { Friend } from './friendTree';

const hrsAgo = (h: number) => Date.now() - h * 3.6e6;

export const sampleFriends: Friend[] = [
  { id: 'f1', name: 'Karthik Nair',   streak: 11, daysSinceContact: 0, unread: 2, mutuals: ['f3'],
    stories: [{ id: 's1', postedAt: hrsAgo(1), seen: false, caption: 'made it to the top before sunrise', hue: 24 },
              { id: 's2', postedAt: hrsAgo(5), seen: false, caption: 'chai + rain', hue: 190 }] },
  { id: 'f2', name: 'Sneha Roy',       streak: 19, daysSinceContact: 1, mutuals: ['f4'],
    stories: [{ id: 's3', postedAt: hrsAgo(9), seen: true, caption: 'new track', hue: 300 }] },
  { id: 'f3', name: 'Priya Sharma',    streak: 6,  daysSinceContact: 0, unread: 1, mutuals: ['f1'],
    stories: [{ id: 's4', postedAt: hrsAgo(0.4), seen: false, caption: 'this dog followed me home', hue: 140 }] },
  { id: 'f4', name: 'Aarav Malhotra',  streak: 34, daysSinceContact: 0, mutuals: ['f2'],
    stories: [{ id: 's5', postedAt: hrsAgo(3),  seen: false, caption: 'first day at the new place', hue: 45 },
              { id: 's6', postedAt: hrsAgo(20), seen: false, caption: 'finally fixed the bike', hue: 12 }] },
  { id: 'f5', name: 'Vikram Reddy',    streak: 4,  daysSinceContact: 3, mutuals: [], stories: [] },
  { id: 'f6', name: 'Meera Iyer',      streak: 0,  daysSinceContact: 26, mutuals: [], stories: [] },
];
