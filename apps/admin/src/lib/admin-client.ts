import {
  type AdminLoginInput,
  type AdminMeDto,
  type AdminSettingsDto,
  type AdminServiceDto,
  type AdminBarberDto,
  type AdminBookingDto,
  type AdminReviewDto,
  type Paginated,
  ADMIN_CSRF_HEADER,
  ADMIN_CSRF_VALUE,
  ADMIN_API_PREFIX,
} from '@barber/shared/admin-api'

type ApiErrorResponse = {
  error?: string
  details?: Record<string, unknown>
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(`API Error ${status}: ${code}`)
    this.name = 'ApiError'
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

async function fetchApi<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = new URL(path, API_URL)
  const headers = new Headers(options?.headers)

  // Add CSRF header for all state-changing requests
  if (options?.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
    headers.set(ADMIN_CSRF_HEADER, ADMIN_CSRF_VALUE)
  }

  headers.set('Content-Type', 'application/json')

  const response = await fetch(url.toString(), {
    ...options,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    const errorData = (await response.json()) as ApiErrorResponse
    throw new ApiError(response.status, errorData.error, errorData.details)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export const adminClient = {
  /* Auth */
  login: (input: AdminLoginInput) =>
    fetchApi<AdminMeDto>(`${ADMIN_API_PREFIX}/login`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  logout: () =>
    fetchApi(`${ADMIN_API_PREFIX}/logout`, { method: 'POST' }),
  getMe: () =>
    fetchApi<AdminMeDto>(`${ADMIN_API_PREFIX}/me`),

  /* Services */
  getServices: () =>
    fetchApi<AdminServiceDto[]>(`${ADMIN_API_PREFIX}/services`),
  createService: (input: Parameters<typeof createService>[0]) =>
    fetchApi<AdminServiceDto>(`${ADMIN_API_PREFIX}/services`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateService: (id: string, input: Parameters<typeof updateService>[1]) =>
    fetchApi<AdminServiceDto>(`${ADMIN_API_PREFIX}/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteService: (id: string) =>
    fetchApi(`${ADMIN_API_PREFIX}/services/${id}`, { method: 'DELETE' }),

  /* Barbers */
  getBarbers: () =>
    fetchApi<AdminBarberDto[]>(`${ADMIN_API_PREFIX}/barbers`),
  getBarber: (id: string) =>
    fetchApi<AdminBarberDto>(`${ADMIN_API_PREFIX}/barbers/${id}`),
  createBarber: (input: Parameters<typeof createBarber>[0]) =>
    fetchApi<AdminBarberDto>(`${ADMIN_API_PREFIX}/barbers`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateBarber: (id: string, input: Parameters<typeof updateBarber>[1]) =>
    fetchApi<AdminBarberDto>(`${ADMIN_API_PREFIX}/barbers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteBarber: (id: string) =>
    fetchApi(`${ADMIN_API_PREFIX}/barbers/${id}`, { method: 'DELETE' }),
  updateBarberServices: (id: string, input: any) =>
    fetchApi<AdminBarberDto>(`${ADMIN_API_PREFIX}/barbers/${id}/services`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  updateBarberSchedule: (id: string, input: any) =>
    fetchApi<AdminBarberDto>(`${ADMIN_API_PREFIX}/barbers/${id}/schedule`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  uploadFile: (input: any) =>
    fetchApi(`${ADMIN_API_PREFIX}/uploads`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  /* Bookings */
  getBookings: (query: any) => {
    const params = new URLSearchParams()
    Object.entries(query).forEach(([key, value]) => {
      if (value != null) {
        params.append(key, String(value))
      }
    })
    return fetchApi<Paginated<AdminBookingDto>>(
      `${ADMIN_API_PREFIX}/bookings?${params}`
    )
  },
  getBooking: (id: string) =>
    fetchApi<AdminBookingDto>(`${ADMIN_API_PREFIX}/bookings/${id}`),
  createBooking: (input: any) =>
    fetchApi<AdminBookingDto>(`${ADMIN_API_PREFIX}/bookings`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateBooking: (id: string, input: any) =>
    fetchApi<AdminBookingDto>(`${ADMIN_API_PREFIX}/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  /* Reviews */
  getReviews: (query: any) => {
    const params = new URLSearchParams()
    Object.entries(query).forEach(([key, value]) => {
      if (value != null) {
        params.append(key, String(value))
      }
    })
    return fetchApi<Paginated<AdminReviewDto>>(
      `${ADMIN_API_PREFIX}/reviews?${params}`
    )
  },
  updateReview: (id: string, input: any) =>
    fetchApi<AdminReviewDto>(`${ADMIN_API_PREFIX}/reviews/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  /* Settings */
  getSettings: () =>
    fetchApi<AdminSettingsDto>(`${ADMIN_API_PREFIX}/settings`),
  updateSettings: (input: any) =>
    fetchApi<AdminSettingsDto>(`${ADMIN_API_PREFIX}/settings`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
}

// Type helpers (stub implementations for schema inference)
function createService(_: any) {}
function updateService(_: any, __: any) {}
function createBarber(_: any) {}
function updateBarber(_: any, __: any) {}
