/**
 * Zenvy Friends > Connect (/api/campus/connect). Contract: backend_contract.md "Friends (connect)".
 *
 * Privacy: another person only ever appears as a Connect profile id + card (no account id, real name,
 * contact, avatar or location). Photos are private and come as 1-hour signed links; only admin-approved
 * photos are shown to others (D5). Connect has no calls (D6) and no GPS.
 */
import { friendsRequest } from './core';
import { updateCampusProfile } from '../../campusApi';

// ── Types ─────────────────────────────────────────────────────────────────────
export type ConnectLookingFor = 'dating' | 'friends' | 'study' | 'event';
export const CONNECT_LOOKING_FOR: ConnectLookingFor[] = ['dating', 'friends', 'study', 'event'];

export type ConnectStage = 'age' | 'consent' | 'liveness' | 'removed' | 'profile' | 'paused' | 'ready';

export type ConnectReason =
  | 'DOB_REQUIRED'
  | 'NOT_ADULT'
  | 'CONSENT_REQUIRED'
  | 'AGE_DECLARATION_REQUIRED'
  | 'LIVENESS_REQUIRED'
  | 'LIVENESS_NOT_CONFIGURED'
  | 'PROFILE_REMOVED'
  | 'PROFILE_INCOMPLETE'
  | 'PROFILE_NOT_ACTIVE'
  | 'PAUSED';

export type LivenessStatus = 'none' | 'pending' | 'passed' | 'failed';

export interface ConnectLiveness {
  required: boolean;
  configured: boolean;
  mode: string | null;
  status: LivenessStatus;
  note: string | null;
  submittedAt: string | null;
  checkedAt: string | null;
  challenge: { text: string; expiresAt: string } | null;
}

export type ConnectPhotoStatus = 'pending' | 'approved' | 'rejected';

export interface ConnectMyPhoto {
  id: string;
  position: number;
  status: ConnectPhotoStatus;
  rejectReason: string | null;
  /** 1-hour signed link (null once the bytes were deleted). */
  url: string | null;
  createdAt: string;
}

export interface ConnectMyProfile {
  profileId: string;
  status: 'setup' | 'active' | 'paused';
  underReview: boolean;
  removed: boolean;
  displayName: string;
  bio: string;
  interests: string[];
  lookingFor: ConnectLookingFor[];
  showYear: boolean;
  showBranch: boolean;
  hiddenBranches: string[];
  hiddenYears: number[];
  /** From the verified campus profile (what others would see when shown). */
  age: number | null;
  year: number | null;
  branch: string | null;
  photos: ConnectMyPhoto[];
  liveness: ConnectLiveness;
  consentVersion: number | null;
  consentAt: string | null;
  ageDeclaredAt: string | null;
  activatedAt: string | null;
  pausedAt: string | null;
}

export interface ConnectHelpline {
  name: string;
  phone?: string;
  url?: string;
  note?: string;
}

export interface ConnectLimits {
  interestsMax: number;
  bioMax: number;
  displayNameMax: number;
  photosMax: number;
  hiddenBranchesMax: number;
  likesPerDay: number;
  swipesPerDay: number;
}

export interface ConnectStatus {
  eligible: boolean;
  reasons: ConnectReason[];
  stage: ConnectStage;
  profile: ConnectMyProfile | null;
  consent: { version: number; accepted: boolean; acceptedVersion: number | null; ageDeclared: boolean };
  dob: { set: boolean; locked: boolean };
  liveness: ConnectLiveness;
  policy: { version: number; url: string | null; inApp: boolean };
  policyUrl: string | null;
  consentVersion: number;
  helplines: ConnectHelpline[];
  guidance: string[];
  lookingForOptions: { key: ConnectLookingFor; label: string }[];
  limits: ConnectLimits;
  callsEnabled: false;
}

export interface ConnectPolicy {
  version: number;
  text: string;
  updatedAt: string | null;
  url: string | null;
  consentVersion: number;
  helplines: ConnectHelpline[];
  guidance: string[];
}

/** Another student, as Connect shows them. */
export interface ConnectCard {
  profileId: string;
  displayName: string;
  age: number | null;
  year?: number;
  branch?: string;
  bio: string;
  interests: string[];
  lookingFor: ConnectLookingFor[];
  photos: { id: string; url: string | null }[];
}

export interface ConnectUnavailableCard {
  profileId: string | null;
  displayName: string;
  photos: [];
  unavailable: true;
}

export interface ConnectMatch {
  id: string;
  status: 'active';
  matchedAt: string;
  conversationId: string | null;
  profile: ConnectCard | ConnectUnavailableCard;
  spark: { date: string; prompt: string } | null;
  callsEnabled: false;
}

export interface ConnectProfilePatch {
  displayName?: string;
  bio?: string | null;
  interests?: string[];
  lookingFor?: ConnectLookingFor[];
  showYear?: boolean;
  showBranch?: boolean;
  hiddenBranches?: string[];
  hiddenYears?: number[];
}

export interface ConnectDiscoverFilters {
  interests?: string[];
  year?: number | null;
  branch?: string | null;
  lookingFor?: ConnectLookingFor[];
}

export interface ConnectSwipeResult {
  action: 'like' | 'pass';
  duplicate: boolean;
  matched: boolean;
  matchId?: string;
  conversationId?: string;
}

export interface ConnectLivenessStart {
  mode: 'manual' | 'provider';
  challenge?: string;
  instructions?: string[];
  expiresAt?: string;
  sessionUrl?: string;
  uploadPurpose: 'liveness_selfie';
}

export interface ConnectDeleteResult {
  deleted: true;
  summary: Record<string, number>;
  retained: string[];
}

export interface ConnectMyData {
  profile: Record<string, any> | null;
  photos: ConnectMyPhoto[];
  swipes: { likesGiven: number; passesGiven: number; likesReceived: number };
  matches: { id: string; status: string; matchedAt: string; endedAt: string | null }[];
  consents: { kind: string; version: number; acceptedAt: string; withdrawnAt: string | null }[];
  selfieStored: boolean;
  location: string;
}

export const isUnavailableCard = (p: ConnectMatch['profile']): p is ConnectUnavailableCard => !!(p as any)?.unavailable;

// ── Status, policy, consent ───────────────────────────────────────────────────
export const fetchConnectStatus = () => friendsRequest<ConnectStatus>('/connect/status', { fallback: "Couldn't load Connect right now." });

export const fetchConnectPolicy = () => friendsRequest<ConnectPolicy>('/connect/policy', { fallback: "Couldn't load the Connect privacy notice." });

export const acceptConnectConsent = (version: number, opts: { livenessConsent?: boolean } = {}) =>
  friendsRequest<{ accepted: true; version: number; duplicate: boolean; profile: ConnectMyProfile }>('/connect/consent', {
    method: 'POST',
    body: { version, ageConfirmed: true, ...(opts.livenessConsent ? { livenessConsent: true } : {}) },
    fallback: "Couldn't save your consent. Please try again.",
  });

/**
 * Date of birth lives on the campus profile (PUT /api/campus/profile). Connect computes the age from it on
 * every request; once Connect consent is given it is locked (DOB_LOCKED).
 */
export const saveDateOfBirth = (isoDate: string) => updateCampusProfile({ dob: isoDate });

// ── Profile ───────────────────────────────────────────────────────────────────
export const updateConnectProfile = (patch: ConnectProfilePatch) =>
  friendsRequest<{ profile: ConnectMyProfile; underReview: boolean }>('/connect/profile', {
    method: 'PATCH',
    body: patch,
    fallback: "Couldn't save your Connect profile. Please try again.",
  });

export const activateConnect = (patch: ConnectProfilePatch = {}) =>
  friendsRequest<{ profile: ConnectMyProfile; duplicate: boolean }>('/connect/activate', {
    method: 'POST',
    body: patch,
    fallback: "Couldn't turn on Connect. Please try again.",
  });

export const pauseConnect = () =>
  friendsRequest<{ status: 'paused'; duplicate: boolean }>('/connect/pause', { method: 'POST', fallback: "Couldn't pause Connect. Please try again." });

export const resumeConnect = () =>
  friendsRequest<{ status: 'active'; duplicate: boolean }>('/connect/resume', { method: 'POST', fallback: "Couldn't resume Connect. Please try again." });

export const deleteConnectProfile = () =>
  friendsRequest<ConnectDeleteResult>('/connect/profile', { method: 'DELETE', fallback: "Couldn't delete your Connect data. Please try again." });

export const fetchConnectMyData = () => friendsRequest<ConnectMyData>('/connect/me/data', { fallback: "Couldn't load your Connect data." });

// ── Photos ────────────────────────────────────────────────────────────────────
/** Upload first with purpose `connect` (private), then attach. An occupied position is replaced. */
export const addConnectPhoto = (mediaId: string, position?: number) =>
  friendsRequest<{ photo: ConnectMyPhoto; replaced: boolean; profile: ConnectMyProfile }>('/connect/photos', {
    method: 'POST',
    body: { mediaId, ...(position !== undefined ? { position } : {}) },
    fallback: "Couldn't add the photo. Please try again.",
  });

export const deleteConnectPhoto = (photoId: string) =>
  friendsRequest<{ deleted: true }>(`/connect/photos/${encodeURIComponent(photoId)}`, { method: 'DELETE', fallback: "Couldn't remove the photo." });

// ── Selfie check ──────────────────────────────────────────────────────────────
export const startLiveness = (consent: boolean) =>
  friendsRequest<ConnectLivenessStart>('/connect/liveness/start', {
    method: 'POST',
    body: consent ? { consent: true } : {},
    fallback: "Couldn't start the selfie check. Please try again.",
  });

export const submitLivenessSelfie = (mediaId: string) =>
  friendsRequest<{ liveness: ConnectLiveness }>('/connect/liveness/manual', {
    method: 'POST',
    body: { mediaId },
    fallback: "Couldn't send your selfie. Please try again.",
  });

// ── Discovery and matches ─────────────────────────────────────────────────────
export const fetchDiscover = (filters: ConnectDiscoverFilters = {}, cursor?: string | null) =>
  friendsRequest<{ items: ConnectCard[]; nextCursor: string | null }>('/connect/discover', {
    query: {
      interests: filters.interests && filters.interests.length ? filters.interests.join(',') : undefined,
      lookingFor: filters.lookingFor && filters.lookingFor.length ? filters.lookingFor.join(',') : undefined,
      year: filters.year || undefined,
      branch: filters.branch || undefined,
      cursor: cursor || undefined,
    },
    fallback: "Couldn't load people right now.",
  });

export const swipeConnect = (profileId: string, action: 'like' | 'pass') =>
  friendsRequest<ConnectSwipeResult>('/connect/swipe', {
    method: 'POST',
    body: { profileId, action },
    fallback: "Couldn't save that. Please try again.",
  });

export const fetchConnectMatches = (cursor?: string | null) =>
  friendsRequest<{ items: ConnectMatch[]; nextCursor: string | null }>('/connect/matches', {
    query: { cursor: cursor || undefined },
    fallback: "Couldn't load your matches.",
  });

export const fetchConnectMatch = async (id: string) =>
  (await friendsRequest<{ match: ConnectMatch }>(`/connect/matches/${encodeURIComponent(id)}`, { fallback: "Couldn't load this match." })).match;

export const unmatchConnect = (id: string) =>
  friendsRequest<{ unmatched: true; duplicate: boolean }>(`/connect/matches/${encodeURIComponent(id)}/unmatch`, {
    method: 'POST',
    fallback: "Couldn't unmatch. Please try again.",
  });

export const blockConnectMatch = (id: string) =>
  friendsRequest<{ blocked: true }>(`/connect/matches/${encodeURIComponent(id)}/block`, { method: 'POST', fallback: "Couldn't block. Please try again." });

export const blockConnectProfile = (profileId: string) =>
  friendsRequest<{ blocked: true }>('/connect/block', { method: 'POST', body: { profileId }, fallback: "Couldn't block. Please try again." });
