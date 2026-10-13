import type {
  AdminBarberCreateInput,
  AdminBarberDto,
  AdminBarberLinkCodeDto,
  AdminBarberServicesInput,
  AdminBarberUpdateInput,
  AdminDeleteResult,
  AdminPortfolioCreateInput,
  AdminPortfolioItemDto,
  AdminPortfolioOrderInput,
  AdminScheduleInput,
  AdminServiceCreateInput,
  AdminServiceDto,
  AdminServiceUpdateInput,
  AdminTimeOffCreateInput,
  AdminTimeOffDto,
  AdminTimeOffQuery,
  AdminTimeOffResultDto,
  AdminTimeOffUpdateInput,
} from '@barber/shared'

import { adminJson, adminVoid, toQueryString } from './request'

/*
 * Админский API каталога: услуги, барберы (+ услуги, график, портфолио, код привязки)
 * и исключения. Пути и типы — по packages/shared/src/admin-api/{catalog,operations}.ts.
 */

const enc = encodeURIComponent

/* ---------- Услуги ---------- */

export function listServices(): Promise<AdminServiceDto[]> {
  return adminJson<AdminServiceDto[]>('/services')
}

export function createService(input: AdminServiceCreateInput): Promise<AdminServiceDto> {
  return adminJson<AdminServiceDto>('/services', { method: 'POST', body: input })
}

export function updateService(id: string, input: AdminServiceUpdateInput): Promise<AdminServiceDto> {
  return adminJson<AdminServiceDto>(`/services/${enc(id)}`, { method: 'PATCH', body: input })
}

export function deleteService(id: string): Promise<AdminDeleteResult> {
  return adminJson<AdminDeleteResult>(`/services/${enc(id)}`, { method: 'DELETE' })
}

/* ---------- Барберы ---------- */

export function listBarbers(): Promise<AdminBarberDto[]> {
  return adminJson<AdminBarberDto[]>('/barbers')
}

export function getBarber(id: string): Promise<AdminBarberDto> {
  return adminJson<AdminBarberDto>(`/barbers/${enc(id)}`)
}

export function createBarber(input: AdminBarberCreateInput): Promise<AdminBarberDto> {
  return adminJson<AdminBarberDto>('/barbers', { method: 'POST', body: input })
}

export function updateBarber(id: string, input: AdminBarberUpdateInput): Promise<AdminBarberDto> {
  return adminJson<AdminBarberDto>(`/barbers/${enc(id)}`, { method: 'PATCH', body: input })
}

export function deleteBarber(id: string): Promise<AdminDeleteResult> {
  return adminJson<AdminDeleteResult>(`/barbers/${enc(id)}`, { method: 'DELETE' })
}

export function setBarberServices(id: string, input: AdminBarberServicesInput): Promise<AdminBarberDto> {
  return adminJson<AdminBarberDto>(`/barbers/${enc(id)}/services`, { method: 'PUT', body: input })
}

export function setBarberSchedule(id: string, input: AdminScheduleInput): Promise<AdminBarberDto> {
  return adminJson<AdminBarberDto>(`/barbers/${enc(id)}/schedule`, { method: 'PUT', body: input })
}

export function createBarberLinkCode(id: string): Promise<AdminBarberLinkCodeDto> {
  return adminJson<AdminBarberLinkCodeDto>(`/barbers/${enc(id)}/link-code`, { method: 'POST' })
}

/* ---------- Портфолио ---------- */

export function addPortfolioItem(barberId: string, input: AdminPortfolioCreateInput): Promise<AdminPortfolioItemDto> {
  return adminJson<AdminPortfolioItemDto>(`/barbers/${enc(barberId)}/portfolio`, { method: 'POST', body: input })
}

export function deletePortfolioItem(id: string): Promise<void> {
  return adminVoid(`/portfolio/${enc(id)}`, { method: 'DELETE' })
}

export function reorderPortfolio(barberId: string, input: AdminPortfolioOrderInput): Promise<AdminPortfolioItemDto[]> {
  return adminJson<AdminPortfolioItemDto[]>(`/barbers/${enc(barberId)}/portfolio/order`, { method: 'PUT', body: input })
}

/* ---------- Исключения ---------- */

export function listTimeOff(query: AdminTimeOffQuery): Promise<AdminTimeOffDto[]> {
  return adminJson<AdminTimeOffDto[]>('/time-off', { query: toQueryString(query) })
}

export function createTimeOff(input: AdminTimeOffCreateInput): Promise<AdminTimeOffResultDto> {
  return adminJson<AdminTimeOffResultDto>('/time-off', { method: 'POST', body: input })
}

export function updateTimeOff(id: string, input: AdminTimeOffUpdateInput): Promise<AdminTimeOffResultDto> {
  return adminJson<AdminTimeOffResultDto>(`/time-off/${enc(id)}`, { method: 'PATCH', body: input })
}

export function deleteTimeOff(id: string): Promise<void> {
  return adminVoid(`/time-off/${enc(id)}`, { method: 'DELETE' })
}
