
// Production Cloud API URL (Render)
export const PROD_API_URL = 'https://hostelbites-backend-jwmt.onrender.com';

// Local / Development Port 8080 API URL
export const DEV_PORT = 8080;
export const LOCAL_API_URL = 'http://localhost:8080';

// The app always talks to the one Zenvy backend on Render. To point a dev build at a local
// backend, set EXPO_PUBLIC_API_URL (e.g. http://192.168.1.5:8080) — never a silent switch.
const getApiUrl = () => {
  const override = (process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/$/, '');
  if (override && /^https?:\/\//.test(override)) return override;
  return PROD_API_URL;
};

export const API_URL = getApiUrl();

// Official Campus Support & WhatsApp Concierge
export const ZENVY_SUPPORT_PHONE = '919391955674';
export const ZENVY_SUPPORT_WHATSAPP = '919391955674';

export const ENDPOINTS = {
  // System Health & Diagnostics
  health: `${API_URL}/api/health`,

  // Auth
  login: `${API_URL}/api/users/login`,
  register: `${API_URL}/api/users/register`,
  sendOtp: `${API_URL}/api/users/send-otp`,
  verifyOtp: `${API_URL}/api/users/verify-otp`,
  profile: `${API_URL}/api/users/profile`,
  resetPassword: `${API_URL}/api/users/reset-password`,
  // Kept for older imports: the backend route is /reset-password (there is no /forgot-password)
  forgotPassword: `${API_URL}/api/users/reset-password`,
  googleLogin: `${API_URL}/api/users/google-login`,
  googleComplete: `${API_URL}/api/users/google-complete`,
  logout: `${API_URL}/api/users/logout`,
  fcmToken: `${API_URL}/api/users/fcm-token`,
  fcmTokenRemove: `${API_URL}/api/users/fcm-token/remove`,

  // Restaurants
  restaurants: `${API_URL}/api/users/restaurants`,
  restaurantMenu: (id: string) => `${API_URL}/api/restaurants/${id}/menu`,
  restaurantClick: (id: string) => `${API_URL}/api/restaurants/${id}/click`,
  localVendors: `${API_URL}/api/restaurants/local-vendors`,
  productById: (id: string) => `${API_URL}/api/users/products/${id}`,

  // Orders
  placeOrder: `${API_URL}/api/orders`,
  myOrders: `${API_URL}/api/orders/myorders`,
  cancelOrder: (id: string) => `${API_URL}/api/orders/${id}/cancel`,
  rateOrder: (id: string) => `${API_URL}/api/orders/${id}/rate`,

  // Config
  config: `${API_URL}/api/users/config`,

  // Recommendations
  recommendations: `${API_URL}/api/features/recommendations`,

  // Support
  support: `${API_URL}/api/tickets`,

  // PG & Residences
  pgList: `${API_URL}/api/pg`,
  pgDetail: (id: string) => `${API_URL}/api/pg/${id}`,
  pgBook: (roomId: string) => `${API_URL}/api/pg/${roomId}/book`,

  // Co-Ride / Bikepool
  bikepoolPosts: `${API_URL}/api/bikepool/posts`,
  bikepoolMyRides: `${API_URL}/api/bikepool/my-rides`,
  bikepoolJoin: (id: string) => `${API_URL}/api/bikepool/posts/${id}/join`,
  bikepoolComplete: (id: string) => `${API_URL}/api/bikepool/posts/${id}/complete`,
  bikepoolCancel: (id: string) => `${API_URL}/api/bikepool/posts/${id}/cancel`,

  // Vault
  vaultList: `${API_URL}/api/vault`,
  vaultClaim: (id: string) => `${API_URL}/api/vault/claim/${id}`,

  // Challenges / BlockWars
  activeChallenge: `${API_URL}/api/features/challenges/active`,
  blockActivity: `${API_URL}/api/blocks/activity`,

  // Community / Gallery
  communityPosts: `${API_URL}/api/community`,
  communityReviews: `${API_URL}/api/community/reviews`,
  communityLike: (id: string) => `${API_URL}/api/community/${id}/like`,
  communityDelete: (id: string) => `${API_URL}/api/community/${id}`,
  uploadImage: `${API_URL}/api/upload`,
  
  // Mega Basket
  megaBasketList: `${API_URL}/api/mega-basket`,
  megaBasketCreate: `${API_URL}/api/mega-basket`,
  megaBasketApprove: (id: string) => `${API_URL}/api/mega-basket/${id}/approve`,

  // Birthdays
  birthdaysActive: `${API_URL}/api/birthdays/active`,
  birthdaysPending: `${API_URL}/api/birthdays/pending`,
  birthdaysSubmit: `${API_URL}/api/birthdays`,
  birthdaysApprove: (id: string) => `${API_URL}/api/birthdays/${id}/approve`,
  birthdaysReject: (id: string) => `${API_URL}/api/birthdays/${id}/reject`,
  birthdaysWish: (id: string) => `${API_URL}/api/birthdays/${id}/wish`,
  birthdaysWishes: (id: string) => `${API_URL}/api/birthdays/${id}/wishes`,

  // Friends & Secure Chat
  friendsList: `${API_URL}/api/friends`,
  friendsContacts: `${API_URL}/api/friends/contacts`,
  friendsRequest: `${API_URL}/api/friends/request`,
  friendsAccept: `${API_URL}/api/friends/accept`,
  friendsPending: `${API_URL}/api/friends/pending`,
  friendsTheme: (id: string) => `${API_URL}/api/friends/${id}/theme`,
  friendsSendMessage: `${API_URL}/api/friends/message`,
  friendsMessages: (convId: string) => `${API_URL}/api/friends/messages/${convId}`,
  dailyTruthDare: `${API_URL}/api/daily-content/truth-dare`,

  // The Wall Photo Contest
  wallActive: `${API_URL}/api/wall/events/active`,
  wallHistory: `${API_URL}/api/wall/events/history`,
  wallSubmit: (id: string) => `${API_URL}/api/wall/events/${id}/submit`,
  wallLike: (id: string) => `${API_URL}/api/wall/submissions/${id}/like`,
  wallLeaderboard: (id: string) => `${API_URL}/api/wall/events/${id}/leaderboard`,
  wallAdminPending: `${API_URL}/api/wall/admin/pending`,
  wallApprove: (id: string) => `${API_URL}/api/wall/admin/submissions/${id}/approve`,
  // Services & Tech Hub
  servicesBook: `${API_URL}/api/services/book`,
  servicesMyBookings: `${API_URL}/api/services/my-bookings`,
  servicesDetail: (id: string) => `${API_URL}/api/services/${id}`,
  servicesConfirmQuote: (id: string) => `${API_URL}/api/services/${id}/confirm-quote`,
  servicesCancel: (id: string) => `${API_URL}/api/services/${id}/cancel`,
  servicesRate: (id: string) => `${API_URL}/api/services/${id}/rate`,
  servicesStats: `${API_URL}/api/services/stats/overview`,
  servicesStatusUpdate: (id: string) => `${API_URL}/api/services/${id}/status`,
};

