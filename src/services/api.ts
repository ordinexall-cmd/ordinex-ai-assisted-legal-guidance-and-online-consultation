// ============================================================
// Ordinex — Frontend API Client
// Centralized fetch wrapper with JWT auth and error handling.
// ============================================================

import { toUserFacingError } from '../utils/userFacingError';

const API_BASE = '/api';

/**
 * Get the stored JWT token.
 */
export function getToken(): string | null {
  return localStorage.getItem('ordinex_token');
}

/**
 * Store a JWT token.
 */
export function setToken(token: string): void {
  localStorage.setItem('ordinex_token', token);
}

/**
 * Remove the stored JWT token.
 */
export function clearToken(): void {
  localStorage.removeItem('ordinex_token');
}

/**
 * Resolve an uploaded-asset URL for use in <img src> / download links.
 * Sensitive buckets are auth-gated on the server, so we append the session
 * token as a query param (browsers can't send Authorization headers on <img>).
 * Avatars are public and external/data/blob URLs are returned untouched.
 */
export function assetUrl(url?: string | null): string {
  if (!url) return '';
  if (!url.startsWith('/uploads/')) return url;
  if (url.startsWith('/uploads/avatars/')) return url;
  const token = getToken();
  if (!token) return url;
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

const KYC_TOKEN_KEY = 'ordinex_kyc_token';

export function getKycToken(): string | null {
  return sessionStorage.getItem(KYC_TOKEN_KEY);
}

export function setKycToken(token: string): void {
  sessionStorage.setItem(KYC_TOKEN_KEY, token);
}

export function clearKycToken(): void {
  sessionStorage.removeItem(KYC_TOKEN_KEY);
}

const PANEL_DEMO_KEY = 'ordinex_panel_demo';

export function isPanelDemoSession(): boolean {
  return sessionStorage.getItem(PANEL_DEMO_KEY) === '1';
}

export function setPanelDemoSession(active: boolean): void {
  if (active) sessionStorage.setItem(PANEL_DEMO_KEY, '1');
  else sessionStorage.removeItem(PANEL_DEMO_KEY);
}

function panelDemoHeaders(): Record<string, string> {
  return isPanelDemoSession() ? { 'X-Panel-Demo': '1' } : {};
}

/**
 * API error class with status code and structured data.
 */
export class ApiError extends Error {
  status: number;
  code?: string;
  data?: Record<string, unknown>;

  constructor(message: string, status: number, code?: string, data?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/**
 * Core fetch wrapper with automatic JWT headers.
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  authMode: 'default' | 'kyc' | 'none' = 'default',
): Promise<T> {
  const token =
    authMode === 'kyc' ? getKycToken()
      : authMode === 'none' ? null
        : getToken();
  const headers: Record<string, string> = {
    ...panelDemoHeaders(),
    ...(options.headers as Record<string, string> || {}),
  };

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(
      'API server is not running. Start it with npm run server:dev (or npm run dev:all for frontend and API together).',
      0,
    );
  }

  // Handle non-JSON responses
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    if (!response.ok) {
      throw new ApiError('Something went wrong. Please try again.', response.status);
    }
    return {} as T;
  }

  const data = await response.json();

  if (!response.ok) {
    // Handle 401 — redirect to login
    if (response.status === 401) {
      clearToken();
      // Don't redirect if already on landing page
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    const fallback =
      response.status === 401
        ? 'Invalid email or password.'
        : response.status === 403
          ? 'You do not have access to do that.'
          : response.status === 404
            ? 'We could not find that.'
            : 'Something went wrong. Please try again.';

    const rawError =
      typeof data.error === 'string' && data.error.trim()
        ? data.error
        : typeof data.message === 'string' && data.message.trim()
          ? data.message
          : fallback;

    throw new ApiError(
      toUserFacingError(rawError, fallback),
      response.status,
      data.code,
      data
    );
  }

  return data as T;
}

// ======================== AUTH API ========================

export const authApi = {
  register: (body: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role?: string;
    barNumber?: string;
    specializations?: string[];
    consultationFee?: number;
    bio?: string;
    yearsOfExperience?: number;
    practiceType?: string;
    // Citizen expanded-profile fields
    dob?: string;
    gender?: string;
    address?: string;
    civilStatus?: string;
    occupation?: string;
    // Security question for password reset
    securityQuestion?: string;
    securityAnswer?: string;
  }) => request<{ message: string; phone: string; devOtp?: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  }),

  resendOtp: (body: { phone?: string; email?: string; purpose?: 'REGISTER' | 'RESET_PASSWORD' }) =>
    request<{ message: string; phone?: string; email?: string; devOtp?: string }>('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  forgotPassword: (body: { email?: string; phone?: string }) =>
    request<{
      message: string;
      securityQuestion?: string | null;
      hasSecurityQuestion?: boolean;
      requiresSecurityAnswer?: boolean;
    }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  forgotPasswordVerifySecurity: (body: { email: string; securityAnswer: string }) =>
    request<{ message: string; devOtp?: string }>('/auth/forgot-password/verify-security', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  forgotPasswordSendCode: (body: { email: string }) =>
    request<{ message: string; devOtp?: string }>('/auth/forgot-password/send-code', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  verifyOtp: (body: { phone?: string; email?: string; code: string }) =>
    request<{
      message: string;
      token?: string;
      kycToken?: string;
      kycRequired?: boolean;
      user: UserProfile;
    }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ message: string; token: string; user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  verifyResetCode: (body: { email?: string; phone?: string; code: string }) =>
    request<{
      valid: boolean;
      message: string;
      securityQuestion?: string | null;
      hasSecurityQuestion?: boolean;
    }>('/auth/verify-reset-code', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  resetPassword: (body: {
    email?: string;
    phone?: string;
    code: string;
    securityAnswer?: string;
    newPassword: string;
  }) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getProfile: () =>
    request<{ user: UserProfile }>('/auth/me'),

  updateProfile: (body: Partial<UserProfile> & { currentPassword?: string }) =>
    request<{ message: string; user: UserProfile }>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  requestChangeOtp: (body: {
    purpose: 'CHANGE_PASSWORD' | 'CHANGE_EMAIL' | 'CHANGE_PHONE';
    currentPassword?: string;
    newEmail?: string;
    newPhone?: string;
  }) =>
    request<{ message: string; devOtp?: string }>('/auth/me/request-change-otp', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  changePassword: (body: {
    securityAnswer?: string;
    code: string;
    newPassword: string;
  }) =>
    request<{ message: string; user: UserProfile }>('/auth/me/password', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  changeEmail: (body: {
    currentPassword: string;
    securityAnswer?: string;
    code: string;
    newEmail: string;
  }) =>
    request<{ message: string; user: UserProfile }>('/auth/me/email', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  changePhone: (body: {
    currentPassword: string;
    code: string;
    newPhone: string;
  }) =>
    request<{ message: string; user: UserProfile }>('/auth/me/phone', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  verifyCurrentPassword: (body: { currentPassword: string }) =>
    request<{ verified: boolean; message: string }>('/auth/me/verify-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  googleStatus: () =>
    request<{ enabled: boolean }>('/auth/google/status'),

  googleStartUrl: (role: 'CITIZEN' | 'LAWYER' = 'CITIZEN') =>
    `/api/auth/google/start?role=${role}`,

  submitCitizenVerification: (formData: FormData) =>
    request<{ message: string; user: UserProfile; ocrExtracted?: { fullName: string; idNumber: string; idType: string } }>(
      '/auth/me/citizen-verification',
      {
        method: 'POST',
        body: formData,
      },
    ),
};

// ======================== CONSULTATION API ========================

export type GuestPreviewCase = {
  name: string;
  confidenceScore: number;
  explanation: string;
  applicableLaw?: string;
};

export type GuestPreviewResult = {
  userConcernSummary: string;
  situationSummary: string;
  possibleLegalCases: GuestPreviewCase[];
  suggestedNextSteps: string[];
  libraryNextSteps?: string[];
  libraryDocuments?: string[];
  libraryCautions?: string[];
  possibleNextSteps?: string[];
  possibleDocuments?: string[];
  penalties?: string;
  outlookLevel: CourtWinLevel;
  caseHint: string;
  matchSpecialty?: string;
  lawyerSpecialty?: string;
  recommendedAgency?: string;
  costBallpark?: string;
  possibleDeadline?: string;
  cautions?: string[];
  factorsFor?: string[];
  factorsAgainst?: string[];
  missingFacts?: string[];
  disclaimer: string;
  requiresDeepSearch?: boolean;
  isComplex?: boolean;
  requiresLogin?: boolean;
  needsMoreDetail?: boolean;
  /** Full identification payload for the shared pre-guidance card. */
  analysis?: LegalAnalysisResult;
};


export const consultationApi = {
  preview: (body: { description: string; category?: string }) =>
    request<GuestPreviewResult>('/consultation/preview', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'none'),

  analyze: (formData: FormData) =>
    request<{
      message: string;
      consultation: ConsultationResult | null;
      needsMoreDetail?: boolean;
      missingFacts?: string[];
      meta?: ConsultationAnalysisMeta;
      trialsRemaining: number | string;
    }>('/consultation/analyze', {
      method: 'POST',
      body: formData,
    }),

  followUp: (id: string, question: string) =>
    request<{
      answer: string;
      followUpCount: number;
      followUpsRemaining: number | null;
      followUpLimit: number | null;
    }>(
      `/consultation/${id}/followup`,
      { method: 'POST', body: JSON.stringify({ question }) }
    ),

  getHistory: (page = 1, limit = 10, q?: string) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (q && q.trim()) params.set('q', q.trim());
    return request<{
      consultations: ConsultationResult[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/consultation/history?${params.toString()}`);
  },

  getById: (id: string) =>
    request<{ consultation: ConsultationResult }>(`/consultation/${id}`),

  rename: (id: string, title: string) =>
    request<{ message: string; consultation: { id: string; title: string } }>(
      `/consultation/${id}`,
      { method: 'PATCH', body: JSON.stringify({ title }) }
    ),

  remove: (id: string) =>
    request<{ message: string; retentionDays?: number }>(`/consultation/${id}`, { method: 'DELETE' }),

  getTrash: () =>
    request<{
      items: Array<{
        id: string;
        title: string | null;
        category: string;
        description: string;
        deletedAt: string;
        createdAt: string;
        daysRemaining: number;
      }>;
      retentionDays: number;
    }>('/consultation/trash'),

  restore: (id: string) =>
    request<{ message: string }>(`/consultation/${id}/restore`, { method: 'POST' }),

  permanentDelete: (id: string) =>
    request<{ message: string }>(`/consultation/${id}/permanent`, { method: 'DELETE' }),

  translateLanguages: () =>
    request<{ languages: { code: string; name: string }[]; available: boolean }>(
      '/consultation/translate/languages',
    ),

  translate: (id: string, targetLang: string, sourceLang?: string) =>
    request<{
      targetLang: string;
      translated: {
        userConcernSummary: string;
        penalties: string;
        courtWinOutlookSummary: string;
        possibleLegalCases: { name: string; explanation: string }[];
        suggestedNextSteps: string[];
      };
    }>(`/consultation/${id}/translate`, {
      method: 'POST',
      body: JSON.stringify({ targetLang, sourceLang }),
    }),
};

// ======================== LAWYERS API ========================

export type PaymentMethodType = 'ewallet' | 'bank';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  /** E-wallet brand, e.g. GCash, Maya */
  provider?: string;
  qrUrl?: string;
  accountName: string;
  bankName?: string;
  accountNumber?: string;
}

export interface LawyerCardSummary {
  id: string;
  name: string;
  avatarUrl?: string | null;
  bio?: string | null;
  specializations: string[];
  consultationFee: number | null;
  consultationFeeMin?: number | null;
  consultationFeeMax?: number | null;
  practiceType: 'PUBLIC' | 'PRIVATE' | null;
  yearsOfExperience: number | null;
  isVerified: boolean;
  rating: number;
  ratingCount: number;
  city?: string | null;
  province?: string | null;
  openSlots: number;
  hasAvailability: boolean;
}

export interface Credential {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  uploadedAt: string;
}

export interface LawyerProfile extends Omit<LawyerCardSummary, 'openSlots' | 'hasAvailability'> {
  barNumber?: string | null;
  paymentMethods: PaymentMethod[];
  credentials: Credential[];
  createdAt: string;
}

export interface LawyerReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  citizen: { name: string };
}

export interface AvailabilitySlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isBooked?: boolean;
}

export const lawyersApi = {
  list: (params: { search?: string; specialty?: string; practiceType?: 'PUBLIC' | 'PRIVATE'; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.specialty) qs.set('specialty', params.specialty);
    if (params.practiceType) qs.set('practiceType', params.practiceType);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    return request<{
      lawyers: LawyerCardSummary[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/lawyers?${qs.toString()}`);
  },

  getById: (id: string) =>
    request<{ lawyer: LawyerProfile; reviews: LawyerReview[] }>(`/lawyers/${id}`),

  getAvailability: (id: string, from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    return request<{ slots: AvailabilitySlot[] }>(`/lawyers/${id}/availability?${qs.toString()}`);
  },
};

export interface BriefViewer {
  lawyerId: string;
  name: string;
  viewedAt: string;
}

export interface CitizenBrief {
  id: string;
  category: string;
  summary: string;
  consultationId?: string | null;
  hasLinkedAnalysis?: boolean;
  analysisTitle?: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  city: string | null;
  province: string | null;
  displayName: string;
  anonymous?: boolean;
  status?: string;
  createdAt: string;
  updatedAt?: string;
  viewCount?: number;
  viewers?: BriefViewer[];
  myOfferStatus?: string | null;
}

export interface BriefInquiry {
  id: string;
  message: string | null;
  status: string;
  createdAt: string;
  lawyer: {
    id: string;
    name: string;
    avatarUrl: string | null;
    specializations: string | null;
    fee: number | null;
  };
}

export const briefsApi = {
  getMine: () => request<{ brief: CitizenBrief | null }>('/briefs/mine'),
  saveMine: (body: {
    category: string;
    summary: string;
    consultationId?: string | null;
    budgetMin?: number | null;
    budgetMax?: number | null;
    anonymous?: boolean;
  }) => request<{ brief: CitizenBrief }>('/briefs/mine', { method: 'PUT', body: JSON.stringify(body) }),
  closeMine: () => request<{ brief: CitizenBrief | null }>('/briefs/mine/close', { method: 'POST' }),
  listInquiries: () => request<{ inquiries: BriefInquiry[] }>('/briefs/inquiries'),
  acceptInquiry: (id: string) => request<{ lawyerId: string }>(`/briefs/inquiries/${id}/accept`, { method: 'POST' }),
  declineInquiry: (id: string) => request<{ ok: boolean }>(`/briefs/inquiries/${id}/decline`, { method: 'POST' }),
  listOpen: (params: { search?: string; category?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.category) qs.set('category', params.category);
    return request<{ briefs: CitizenBrief[] }>(`/briefs?${qs.toString()}`);
  },
  getById: (id: string) =>
    request<{
      brief: CitizenBrief;
      citizen: { displayName: string; avatarUrl: string | null };
      analysis: BookingLinkedAnalysis | null;
    }>(`/briefs/${id}`),
  offer: (id: string, message?: string) =>
    request<{ inquiry: { id: string; status: string } }>(`/briefs/${id}/offer`, {
      method: 'POST',
      body: JSON.stringify({ message: message || '' }),
    }),
};

// ======================== AVAILABILITY API (Lawyer) ========================

export const availabilityApi = {
  createBatch: (slots: { date: string; startTime: string; endTime: string }[]) =>
    request<{ message: string; slots: AvailabilitySlot[] }>('/availability', {
      method: 'POST',
      body: JSON.stringify({ slots }),
    }),

  remove: (id: string) =>
    request<{ message: string }>(`/availability/${id}`, { method: 'DELETE' }),

  getMy: (from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    return request<{ slots: AvailabilitySlot[] }>(`/availability/my?${qs.toString()}`);
  },
};

// ======================== BOOKINGS API ========================

export type BookingStatus =
  | 'REQUESTED' | 'APPROVED' | 'PAYMENT_SUBMITTED' | 'CONFIRMED'
  | 'DECLINED' | 'AUTO_CANCELLED' | 'NO_SHOW' | 'IN_PROGRESS'
  | 'COMPLETED' | 'RATED';

export interface BookingChatMessage {
  id: string;
  from: 'citizen' | 'lawyer';
  fromUserId: string;
  content: string;
  sentAt: string;
  translatedText?: string;
  translatedLang?: string;
  translatedAt?: string;
}

export interface TranscriptSegment {
  id: string;
  speaker: 'citizen' | 'lawyer' | string;
  lang: string;
  text: string;
  startMs: number;
  isFinal: boolean;
}

export interface BookingTranscript {
  plainText: string;
  segments: TranscriptSegment[];
  editedAt: string | null;
  editedBy: string | null;
}

export interface LinkedAnalysisPreview {
  title: string | null;
  category: string;
  userConcernSummary: string;
}

export interface BookingLinkedAnalysis {
  id: string;
  title: string | null;
  category: string;
  description: string;
  fileUrl?: string | null;
  aiResult: LegalAnalysisResult;
  analysisMeta?: ConsultationAnalysisMeta | null;
  createdAt: string;
}

export interface Booking {
  id: string;
  status: BookingStatus;
  feeAtBooking: number;
  quotedFee: number | null;
  platformFee: number | null;
  lawyerShare: number | null;
  approvedAt: string | null;
  paymentReference: string | null;
  paymentReceiptUrl: string | null;
  paymentSnapshot: PaymentMethod | null;
  paymentVerifiedAt: string | null;
  roomId: string | null;
  chatClosedAt: string | null;
  consultationId: string | null;
  caseDescription: string | null;
  recordingUrl: string | null;
  linkedAnalysisPreview?: LinkedAnalysisPreview | null;
  noShowParty: 'CITIZEN' | 'LAWYER' | null;
  createdAt: string;
  updatedAt: string;
  chatIsOpen: boolean;
  hasTranscript?: boolean;
  viewerRole: 'CITIZEN' | 'LAWYER';
  citizen: {
    id: string;
    name: string;
    avatarUrl: string | null;
    phone: string;
    bio?: string | null;
    isPremium?: boolean;
    createdAt?: string;
    dob?: string | null;
    gender?: string | null;
    address?: string | null;
    civilStatus?: string | null;
    occupation?: string | null;
  };
  lawyer: {
    id: string; name: string; avatarUrl: string | null;
    specializations: string[]; practiceType: 'PUBLIC' | 'PRIVATE' | null;
    paymentMethods: PaymentMethod[];
    consultationFee: number | null; rating: number; ratingCount: number;
  };
  availability: { date: string; startTime: string; endTime: string };
  review: { id: string; rating: number; comment: string | null; createdAt: string } | null;
}

export const bookingsApi = {
  create: (body: { availabilityId: string; consultationId?: string; caseDescription?: string }) =>
    request<{ booking: Booking }>('/bookings', { method: 'POST', body: JSON.stringify(body) }),

  getById: (id: string) =>
    request<{ booking: Booking }>(`/bookings/${id}`),

  getLinkedAnalysis: (id: string) =>
    request<{ analysis: BookingLinkedAnalysis }>(`/bookings/${id}/linked-analysis`),

  getMy: (params: { status?: BookingStatus; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    return request<{
      bookings: Booking[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/bookings/my?${qs.toString()}`);
  },

  removeFromHistory: (id: string) =>
    request<{ message: string; retentionDays?: number }>(`/bookings/${id}/history`, { method: 'DELETE' }),

  getTrash: () =>
    request<{
      items: Array<{
        booking: Booking;
        deletedAt: string;
        daysRemaining: number;
      }>;
      retentionDays: number;
    }>('/bookings/trash'),

  restoreFromHistory: (id: string) =>
    request<{ message: string }>(`/bookings/${id}/restore`, { method: 'POST' }),

  approve: (id: string, quotedFee?: number, paymentType?: 'ewallet' | 'bank') =>
    request<{ booking: Booking }>(`/bookings/${id}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...(quotedFee != null ? { quotedFee } : {}),
        ...(paymentType ? { paymentType } : {}),
      }),
    }),
  decline: (id: string) =>
    request<{ booking: Booking }>(`/bookings/${id}/decline`, { method: 'PATCH' }),
  confirmPayment: (id: string) =>
    request<{ booking: Booking }>(`/bookings/${id}/confirm-payment`, { method: 'PATCH' }),
  complete: (id: string) =>
    request<{ booking: Booking }>(`/bookings/${id}/complete`, { method: 'PATCH' }),
  cancelRefund: (id: string) =>
    request<{ booking: Booking; refunded: boolean }>(`/bookings/${id}/cancel-refund`, { method: 'PATCH' }),
  consultConsent: (id: string) =>
    request<{ booking: Booking; consentedAt: string }>(`/bookings/${id}/consult-consent`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  startSession: (id: string) =>
    request<{ booking: Booking }>(`/bookings/${id}/start-session`, { method: 'PATCH' }),
  noShow: (id: string) =>
    request<{ booking: Booking }>(`/bookings/${id}/no-show`, { method: 'PATCH' }),
  getTranscript: (id: string) =>
    request<{ plainText: string; segments: unknown[] }>(`/bookings/${id}/transcript`),
  downloadRecordingUrl: (id: string) => `/api/bookings/${id}/recording`,
  review: (id: string, rating: number, comment?: string) =>
    request<{ booking: Booking }>(`/bookings/${id}/review`, {
      method: 'POST', body: JSON.stringify({ rating, comment }),
    }),

  getChat: (id: string) =>
    request<{ messages: BookingChatMessage[]; isOpen: boolean }>(
      `/bookings/${id}/chat`,
    ),
  sendChat: (id: string, content: string) =>
    request<{ message: BookingChatMessage }>(`/bookings/${id}/chat`, {
      method: 'POST', body: JSON.stringify({ content }),
    }),
  closeChat: (id: string) =>
    request<{ booking: Booking }>(`/bookings/${id}/close-chat`, { method: 'PATCH' }),
  appendTranscriptSegment: (
    id: string,
    body: { text: string; lang?: string; startMs?: number; isFinal?: boolean },
  ) =>
    request<{ segment: TranscriptSegment; plainText: string }>(
      `/bookings/${id}/transcript/segment`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  patchTranscript: (id: string, plainText: string) =>
    request<BookingTranscript>(`/bookings/${id}/transcript`, {
      method: 'PATCH',
      body: JSON.stringify({ plainText }),
    }),
  uploadRecording: (id: string, file: Blob) => {
    const fd = new FormData();
    fd.append('recording', file, 'consultation-recording.webm');
    return request<{ recordingUrl: string }>(`/bookings/${id}/recording`, {
      method: 'POST',
      body: fd,
    });
  },
  appendTranscriptAudio: (id: string, audio: Blob, lang?: string) => {
    const fd = new FormData();
    fd.append('audio', audio, 'chunk.webm');
    if (lang) fd.append('lang', lang);
    return request<{ segment: TranscriptSegment | null; plainText: string; provider: string }>(
      `/bookings/${id}/transcript/audio`,
      { method: 'POST', body: fd },
    );
  },
};

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  linkTo: string | null;
  createdAt: string;
}

export const notificationsApi = {
  list: (params: { page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    return request<{
      notifications: AppNotification[];
      unreadCount: number;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/notifications?${qs.toString()}`);
  },
  markRead: (id: string) =>
    request<{ notification: AppNotification }>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () =>
    request<{ updated: number }>(`/notifications/read-all`, { method: 'PATCH' }),
};

export const reportsApi = {
  submitJson: (body: {
    reportedUserId: string;
    reason: string;
    description: string;
    bookingId?: string;
    screenshotUrl?: string;
  }) =>
    request<{ message: string; report: { id: string; reason: string; status: string; createdAt: string } }>(
      '/reports',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  submitForm: (fd: FormData) =>
    request<{ message: string; report: { id: string; reason: string; status: string; createdAt: string } }>(
      '/reports',
      { method: 'POST', body: fd },
    ),
};

// ======================== PROFILE UPLOADS ========================

export const profileApi = {
  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return request<{ message: string; avatarUrl: string; user: UserProfile }>(
      '/auth/me/avatar',
      { method: 'POST', body: fd }
    );
  },

  addCredential: (file: File, title: string, description = '') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title);
    if (description) fd.append('description', description);
    return request<{ message: string; user: UserProfile }>(
      '/auth/me/credentials',
      { method: 'POST', body: fd }
    );
  },

  removeCredential: (credId: string) =>
    request<{ message: string; user: UserProfile }>(
      `/auth/me/credentials/${credId}`,
      { method: 'DELETE' }
    ),

  uploadPaymentQr: (file: File) => {
    const fd = new FormData();
    fd.append('qr', file);
    return request<{ message: string; qrUrl: string }>('/auth/me/payment-qr', {
      method: 'POST',
      body: fd,
    });
  },
};

// ======================== LAWYER VERIFICATION (KYC) ========================

export type LawyerVerificationStatus =
  | 'NOT_STARTED'
  | 'PENDING_UPLOAD'
  | 'PROCESSING'
  | 'NEEDS_REUPLOAD'
  | 'VERIFIED'
  | 'REJECTED';

export type LawyerVerificationDecision =
  | 'PENDING'
  | 'AUTO_APPROVE'
  | 'NEEDS_REUPLOAD'
  | 'AUTO_REJECT';

export type GovIdType =
  | 'PRC' | 'IBP_ID' | 'DRIVER' | 'PASSPORT'
  | 'NBI' | 'UMID' | 'VOTER' | 'POSTAL' | 'PHL_ID';

export interface LawyerVerificationRecord {
  id: string;
  submittedFullName: string | null;
  submittedRollNumber: string | null;
  rollMatchedName: string | null;
  rollMatchHit: boolean;
  govIdType: GovIdType | null;
  govIdUrl: string | null;
  govIdOcrName: string | null;
  govIdUploadedAt: string | null;
  challengeCode: string | null;
  challengeIssuedAt: string | null;
  selfieUrl: string | null;
  selfieUploadedAt: string | null;
  faceMatchScore: number | null;
  ocrNameMatchScore: number | null;
  paymentAccountName: string | null;
  paymentNameMatchScore: number | null;
  challengeCodeMatched: boolean;
  aggregateConfidence: number;
  decision: LawyerVerificationDecision;
  decisionReason: string | null;
  decisionAt: string | null;
  attempts: number;
  lastSubmittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LawyerVerificationState {
  status: LawyerVerificationStatus;
  score: number | null;
  rejectionReason: string | null;
  cooldownUntil: string | null;
  thresholds: { high: number; medium: number };
  verification: LawyerVerificationRecord | null;
}

type LawyerKycOpts = { useKycToken?: boolean };

function kycAuth(opts?: LawyerKycOpts): 'default' | 'kyc' {
  return opts?.useKycToken ? 'kyc' : 'default';
}

export const lawyerVerificationApi = {
  getState: (opts?: LawyerKycOpts) =>
    request<LawyerVerificationState>('/auth/me/lawyer-verification', {}, kycAuth(opts)),

  start: (body: { fullName: string; rollNumber: string }, opts?: LawyerKycOpts) =>
    request<{
      ok: boolean;
      code: string;
      message: string;
      challengeCode?: string;
      challengeExpiresInHours?: number;
      verification: LawyerVerificationRecord | null;
    }>('/auth/me/lawyer-verification/start', {
      method: 'POST',
      body: JSON.stringify(body),
    }, kycAuth(opts)),

  reissue: (opts?: LawyerKycOpts) =>
    request<{
      challengeCode: string;
      challengeExpiresInHours: number;
      verification: LawyerVerificationRecord | null;
    }>('/auth/me/lawyer-verification/reissue', { method: 'POST' }, kycAuth(opts)),

  uploadId: (file: File, govIdType: GovIdType, opts?: LawyerKycOpts) => {
    const fd = new FormData();
    fd.append('idImage', file);
    fd.append('govIdType', govIdType);
    return request<{
      ok: boolean;
      ocrProvider: string;
      extractedName: string;
      verification: LawyerVerificationRecord | null;
    }>('/auth/me/lawyer-verification/id', { method: 'POST', body: fd }, kycAuth(opts));
  },

  uploadSelfie: (file: File, reportedCode: string, opts?: LawyerKycOpts) => {
    const fd = new FormData();
    fd.append('selfieImage', file);
    fd.append('reportedCode', reportedCode);
    return request<{
      ok: boolean;
      faceProvider: string;
      faceMatchScore: number;
      challengeCodeMatched: boolean;
      verification: LawyerVerificationRecord | null;
    }>('/auth/me/lawyer-verification/selfie', { method: 'POST', body: fd }, kycAuth(opts));
  },

  setPaymentName: (paymentAccountName: string, opts?: LawyerKycOpts) =>
    request<{
      ok: boolean;
      paymentNameMatchScore: number;
      verification: LawyerVerificationRecord | null;
    }>('/auth/me/lawyer-verification/payment', {
      method: 'POST',
      body: JSON.stringify({ paymentAccountName }),
    }, kycAuth(opts)),

  decide: (opts?: LawyerKycOpts) =>
    request<{
      decision: LawyerVerificationDecision;
      status: LawyerVerificationStatus;
      score: number;
      reason: string;
      cooldownUntil: string | null;
      sessionAction?: 'sign_in_required';
      user: UserProfile;
      verification: LawyerVerificationRecord | null;
    }>('/auth/me/lawyer-verification/decide', { method: 'POST' }, kycAuth(opts)),

  panelAdvance: (
    step: 'roll' | 'id' | 'selfie' | 'payment' | 'decide',
    body: { fullName?: string; rollNumber?: string; paymentAccountName?: string } = {},
    opts?: LawyerKycOpts,
  ) =>
    request<{
      ok?: boolean;
      decision?: LawyerVerificationDecision;
      status?: LawyerVerificationStatus;
      score?: number;
      reason?: string;
      sessionAction?: 'sign_in_required';
      user: UserProfile;
      verification: LawyerVerificationRecord | null;
    }>('/auth/me/lawyer-verification/panel-advance', {
      method: 'POST',
      body: JSON.stringify({ step, ...body }),
    }, kycAuth(opts)),
};

// ======================== PAYMENTS API ========================

export interface CheckoutLineItem {
  label: string;
  amount: number;
}

export interface CheckoutContext {
  merchant: string;
  type: 'booking';
  bookingId?: string;
  lawyerName?: string;
  lineItems: CheckoutLineItem[];
  total: number;
  currency: string;
  paymentsMode?: 'simulated' | 'paymongo';
  commissionRate?: number;
  preferredMethod?: string;
  holdNotice?: string;
}

export interface WalletData {
  walletBalance: number;
  walletPending: number;
  recentEarnings: Array<{
    id: string;
    status: string;
    quotedFee: number | null;
    platformFee: number | null;
    lawyerShare: number | null;
    createdAt: string;
    citizen: { name: string };
  }>;
  payoutRequests: Array<{
    id: string;
    amount: number;
    method: string;
    accountDetails: string;
    status: string;
    createdAt: string;
  }>;
}

export const paymentsApi = {
  getCheckoutContext: (type: 'booking', bookingId?: string) => {
    const qs = new URLSearchParams({ type });
    if (bookingId) qs.set('bookingId', bookingId);
    return request<CheckoutContext>(`/payments/checkout-context?${qs.toString()}`);
  },

  createSession: (bookingId: string) =>
    request<{ sessionId: string; checkoutUrl: string; preferredMethod?: string }>(
      '/payments/create-session',
      { method: 'POST', body: JSON.stringify({ bookingId }) },
    ),

  completeSession: (sessionId: string) =>
    request<{ message: string; paymentId: string; bookingId: string }>(
      '/payments/complete-session',
      { method: 'POST', body: JSON.stringify({ sessionId }) },
    ),

  confirm: (body: {
    idempotencyKey: string;
    type: 'BOOKING';
    bookingId?: string;
    method?: string;
  }) =>
    request<{
      message: string;
      paymentId: string;
    }>('/payments/confirm', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getWallet: () => request<WalletData>('/payments/wallet'),

  requestPayout: (body: {
    amount: number;
    method: 'GCASH' | 'BANK';
    accountDetails: Record<string, string>;
  }) =>
    request<{ message: string; payoutRequest: { id: string; status: string } }>(
      '/payments/payout-request',
      { method: 'POST', body: JSON.stringify(body) },
    ),
};

// ======================== TYPES ========================

export interface UserProfile {
  id: string;
  email: string;
  phone: string;
  role: 'CITIZEN' | 'LAWYER';
  name: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
  aliases?: string | null;
  language: string;
  isPremium: boolean;
  trialsUsed: number;
  isFirstLogin: boolean;
  isBanned: boolean;
  createdAt: string;
  // Lawyer fields
  barNumber?: string;
  barAdmissionYear?: number | null;
  ibpChapter?: string | null;
  ibpIdNumber?: string | null;
  mcleComplianceNo?: string | null;
  ptrNumber?: string | null;
  ptrLgu?: string | null;
  lawFirmName?: string | null;
  specializations?: string[];
  consultationFee?: number;
  consultationFeeMin?: number;
  consultationFeeMax?: number;
  acceptingBookings?: boolean;
  bio?: string;
  yearsOfExperience?: number;
  practiceType?: string;
  isVerified?: boolean;
  avatarUrl?: string;
  paymentMethods?: PaymentMethod[];
  credentials?: { id: string; title: string; description: string; fileUrl: string; uploadedAt: string }[];
  rating?: number;
  ratingCount?: number;
  // Lawyer identity verification state machine
  lawyerVerificationStatus?: LawyerVerificationStatus;
  lawyerVerificationScore?: number | null;
  lawyerVerificationRejectionReason?: string | null;
  lawyerVerificationCooldownUntil?: string | null;
  lawyerVerificationUpdatedAt?: string | null;
  lawyerVerification?: LawyerVerificationRecord | null;
  // Subscription
  subscription?: {
    status: string;
    startDate: string;
    endDate: string;
    price: number;
  } | null;
  // Citizen expanded-profile & demographics
  dob?: string | null;
  gender?: string | null;
  citizenship?: string | null;
  civilStatus?: string | null;
  occupation?: string | null;
  indigencyTier?: string | null;
  // Structured PSGC address
  region?: string | null;
  province?: string | null;
  city?: string | null;
  barangay?: string | null;
  streetAddress?: string | null;
  zipCode?: string | null;
  address?: string | null;
  // Citizen ID & emergency contact
  citizenIdType?: string | null;
  citizenIdNumber?: string | null;
  citizenIdUrl?: string | null;
  citizenIdBackUrl?: string | null;
  citizenSelfieUrl?: string | null;
  citizenVerificationStatus?: 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  emailVerified?: boolean;
  suspensionUntil?: string | null;
  suspensionReason?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyRelationship?: string | null;
  securityQuestion?: string | null;
}

export type CourtWinLevel = 'Weak' | 'Moderate' | 'Strong' | 'Uncertain';

export type LegalCaseFreshness = 'current' | 'amended' | 'stale';

export interface LegalCaseMatch {
  name: string;
  confidenceScore: number;
  explanation: string;
  applicableLaw: string;
  sourceLink?: string | null;
  sourceId?: string | null;
  /** Freshness of the underlying legal source. */
  freshness?: LegalCaseFreshness;
}

export interface CourtWinOutlook {
  level: CourtWinLevel;
  summary: string;
  factorsFor: string[];
  factorsAgainst: string[];
  missingFacts: string[];
}

export interface LegalAnalysisResult {
  userConcernSummary: string;
  extractedKeywords: string[];
  possibleLegalCases: LegalCaseMatch[];
  penalties: string;
  courtWinOutlook: CourtWinOutlook;
  suggestedNextSteps: string[];
  libraryNextSteps?: string[];
  libraryDocuments?: string[];
  libraryCautions?: string[];
  possibleNextSteps?: string[];
  possibleDocuments?: string[];
  recommendedAgency?: string;
  lawyerSpecialty?: string;
  /** Canonical English specialty for directory matching */
  matchSpecialty?: string;
  costBallpark?: string;
  possibleDeadline?: string;
  cautions?: string[];
  systemDisclaimer: string;
  _complexCase?: boolean;
  _supersededWarning?: boolean;
}

export type ConsultationOutcomeType = 'full' | 'needs_detail' | 'no_corpus';

export interface CorpusFreshnessMeta {
  total: number;
  active: number;
  amended: number;
  superseded: number;
  highPriority: number;
  oldestDays: number | null;
}

export interface CorpusHealthMeta {
  meetsMinimum: boolean;
  totalLocal: number;
  highPriority: number;
}

export interface ConsultationAnalysisMeta {
  outcomeType?: ConsultationOutcomeType;
  trialsCharged?: boolean;
  providersUsed: string[];
  corpusSource: string;
  corpusFreshness?: CorpusFreshnessMeta;
  corpusHealth?: CorpusHealthMeta;
  supersededWarning?: boolean;
  usedMock: boolean;
  retrievedSources?: Array<{ name: string; citation?: string; url?: string }>;
}

export interface ConsultationResult {
  id: string;
  title?: string;
  category: string;
  description: string;
  aiResult: LegalAnalysisResult;
  analysisMeta?: ConsultationAnalysisMeta | null;
  followUpHistory?: { role: string; content: string }[];
  followUpCount: number;
  isFree: boolean;
  trialsCharged?: boolean;
  createdAt: string;
}

export function consultationDisplayTitle(c: ConsultationResult): string {
  if (c.title?.trim()) return c.title;
  const a = c.aiResult;
  if (!a) return c.category;
  if (a.possibleLegalCases?.[0]?.name) return a.possibleLegalCases[0].name;
  if (a.userConcernSummary) return a.userConcernSummary.slice(0, 48);
  return c.category;
}
