import {
  type BarberDto,
  formatDuration,
  formatUzPhone,
  formatPrice,
  plural,
  type ServiceDto,
  toE164UzPhone,
  totalDurationMin,
  totalPrice,
} from '@barber/shared'
import { useEffect, useReducer, useState } from 'react'

import { api } from '../client'
import { BarberStep } from '../components/BarberStep'
import { BottomBar } from '../components/BottomBar'
import { ConfirmStep } from '../components/ConfirmStep'
import { ContactsStep } from '../components/ContactsStep'
import { DatePicker } from '../components/DatePicker'
import { Screen } from '../components/Screen'
import { ServiceStep } from '../components/ServiceStep'
import { ErrorState, Notice, Skeleton } from '../components/Status'
import { SuccessView } from '../components/SuccessView'
import { TimePicker } from '../components/TimePicker'
import { errorCode, errorMessage } from '../errors'
import {
  canProceed,
  createInitialFlow,
  eligibleBarbers,
  type FlowAction,
  flowReducer,
  type FlowState,
  type FlowStep,
  stepNumber,
} from '../flow'
import type { RequestResult } from '../hooks/useRequest'
import { type PhoneState, useVerifiedPhone } from '../hooks/useVerifiedPhone'
import type { MainAction } from '../hooks/useMainButton'
import { getTelegramFirstName, hapticNotify, hapticSelection } from '../telegram'

export type Catalog = { services: ServiceDto[]; barbers: BarberDto[] }

type Props = {
  catalog: RequestResult<Catalog>
  onExit: () => void
  onMyBookings: () => void
}

const STEP_TITLES: Readonly<Record<FlowStep, string>> = {
  services: 'Выберите услуги',
  barber: 'Выберите барбера',
  date: 'Выберите дату',
  time: 'Выберите время',
  contacts: 'Ваши контакты',
  confirm: 'Проверьте запись',
  success: 'Вы записаны',
}

/** Ошибки, после которых нужно выбрать другое время. */
const RETRY_TIME_CODES = new Set(['SLOT_TAKEN', 'TOO_SOON', 'OUTSIDE_WORKING_HOURS'])

type StepBodyProps = {
  state: FlowState
  catalog: Catalog
  dispatch: (action: FlowAction) => void
  submitError: string | null
  onMyBookings: () => void
  phoneState: PhoneState
  onRequestPhone: () => void
}

function StepBody({ state, catalog, dispatch, submitError, onMyBookings, phoneState, onRequestPhone }: StepBodyProps) {
  const { draft } = state
  const select = (action: FlowAction): void => {
    hapticSelection()
    dispatch(action)
  }
  const chosen = catalog.services.filter(service => draft.serviceIds.includes(service.id))
  switch (state.step) {
    case 'services':
      return <ServiceStep services={catalog.services} selectedIds={draft.serviceIds} onToggle={id => select({ type: 'toggleService', serviceId: id })} />
    case 'barber':
      return <BarberStep barbers={eligibleBarbers(catalog.barbers, draft.serviceIds)} selectedId={draft.barberId} onSelect={id => select({ type: 'selectBarber', barberId: id })} />
    case 'date':
      return draft.barberId && <DatePicker serviceIds={draft.serviceIds} barberId={draft.barberId} selected={draft.date} onSelect={date => select({ type: 'selectDate', date })} />
    case 'time':
      return draft.barberId && draft.date && <TimePicker serviceIds={draft.serviceIds} barberId={draft.barberId} date={draft.date} selected={draft.slot} version={state.slotsVersion} onSelect={slot => select({ type: 'selectSlot', slot })} />
    case 'contacts':
      return <ContactsStep name={draft.name} phone={draft.phone} phoneState={phoneState} onNameChange={name => dispatch({ type: 'setName', name })} onPhoneChange={phone => dispatch({ type: 'setPhone', phone })} onRequestPhone={onRequestPhone} />
    case 'confirm':
      return draft.barberId && draft.date && draft.slot && <ConfirmStep services={chosen} barbers={catalog.barbers} barberId={draft.barberId} date={draft.date} slot={draft.slot} name={draft.name} phone={draft.phone} error={submitError} />
    case 'success':
      return state.booking && <SuccessView booking={state.booking} onMyBookings={onMyBookings} />
  }
}

function SelectionSummary({ services }: { services: readonly ServiceDto[] }) {
  if (services.length === 0) return null
  const count = `${services.length} ${plural(services.length, ['услуга', 'услуги', 'услуг'])}`
  return (
    <span aria-live="polite">
      {count} · {formatDuration(totalDurationMin(services))} · <strong>{formatPrice(totalPrice(services))}</strong>
    </span>
  )
}

function useSubmit(state: FlowState, dispatch: (action: FlowAction) => void) {
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function submit(): Promise<void> {
    const { draft } = state
    if (!draft.slot || !draft.barberId || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const booking = await api.createBooking({
        serviceIds: [...draft.serviceIds],
        barberId: draft.barberId,
        startsAt: draft.slot.startsAt,
        client: { name: draft.name.trim(), phone: toE164UzPhone(draft.phone) },
      })
      hapticNotify('success')
      dispatch({ type: 'booked', booking })
    } catch (error: unknown) {
      hapticNotify('error')
      const code = errorCode(error)
      if (RETRY_TIME_CODES.has(code)) dispatch({ type: 'slotTaken', message: errorMessage(error) })
      else setSubmitError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return { submit, submitting, submitError, clearError: () => setSubmitError(null) }
}

export function BookingFlow({ catalog, onExit, onMyBookings }: Props) {
  const [state, dispatch] = useReducer(flowReducer, getTelegramFirstName(), createInitialFlow)
  const { submit, submitting, submitError, clearError } = useSubmit(state, dispatch)
  const phone = useVerifiedPhone()
  const verifiedPhone = phone.state.status === 'verified' ? formatUzPhone(phone.state.phone) : null

  // Подтверждённый номер подставляем в форму: в запись сервер всё равно возьмёт его.
  useEffect(() => {
    if (verifiedPhone && state.draft.phone !== verifiedPhone) dispatch({ type: 'setPhone', phone: verifiedPhone })
  }, [verifiedPhone, state.draft.phone])
  const { step } = state
  const ready = catalog.status === 'success'
  const chosen = ready ? catalog.data.services.filter(s => state.draft.serviceIds.includes(s.id)) : []

  const goBack = (): void => {
    clearError()
    if (step === 'services' || step === 'success') onExit()
    else dispatch({ type: 'back' })
  }

  const action: MainAction | null = !ready
    ? null
    : step === 'success'
      ? { text: 'Готово', onClick: onExit }
      : step === 'confirm'
        ? { text: 'Записаться', onClick: () => void submit(), loading: submitting }
        : { text: 'Далее', onClick: () => dispatch({ type: 'next' }), disabled: !canProceed(state) }

  const { current, total } = stepNumber(step)
  return (
    <Screen
      title={STEP_TITLES[step]}
      subtitle={step === 'success' ? undefined : `Шаг ${current} из ${total}`}
      onBack={goBack}
      footer={<BottomBar summary={step === 'success' ? null : <SelectionSummary services={chosen} />} action={action} />}
    >
      {state.notice && (
        <Notice onDismiss={() => dispatch({ type: 'dismissNotice' })}>{state.notice}</Notice>
      )}
      {catalog.status === 'loading' && <Skeleton rows={5} label="Загружаем услуги…" />}
      {catalog.status === 'error' && <ErrorState error={catalog.error} onRetry={catalog.reload} />}
      {ready && (
        <StepBody
          state={state}
          catalog={catalog.data}
          dispatch={dispatch}
          submitError={submitError}
          onMyBookings={onMyBookings}
          phoneState={phone.state}
          onRequestPhone={() => void phone.request()}
        />
      )}
    </Screen>
  )
}
