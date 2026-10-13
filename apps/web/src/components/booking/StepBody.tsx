import type { Dispatch } from 'react'

import type { BarberChoice } from '@barber/shared'

import { BarberStep } from './BarberStep'
import { bookingSummary } from './bookingSummary'
import { type BookingAction, type BookingState } from './bookingState'
import type { BookingSource } from './bookingSource'
import { ConfirmStep } from './ConfirmStep'
import { ContactsStep } from './ContactsStep'
import { DateStep } from './DateStep'
import { ServiceStep } from './ServiceStep'
import { TimeStep } from './TimeStep'
import { useDays } from './useAvailability'

type Props = {
  state: BookingState
  dispatch: Dispatch<BookingAction>
  source: BookingSource
  dateKeys: readonly string[]
  todayKey: string
  contactsFormId: string
}

/** Содержимое текущего шага. Все изменения идут через редьюсер. */
export function StepBody(props: Props) {
  const { state, dispatch, contactsFormId } = props

  switch (state.step) {
    case 'service':
      return (
        <ServiceStep
          services={state.catalog.services}
          serviceIds={state.serviceIds}
          onToggle={id => dispatch({ type: 'toggleService', id })}
        />
      )
    case 'barber':
      return (
        <BarberStep
          barbers={state.catalog.barbers}
          serviceIds={state.serviceIds}
          selected={state.barber}
          onSelect={barber => dispatch({ type: 'selectBarber', barber })}
          onChangeServices={() => dispatch({ type: 'goTo', step: 'service' })}
        />
      )
    case 'date':
      return <DateBody {...props} />
    case 'time':
      return <TimeBody {...props} />
    case 'contacts':
      return (
        <ContactsStep
          formId={contactsFormId}
          name={state.name}
          phone={state.phone}
          onNameChange={name => dispatch({ type: 'setName', name })}
          onPhoneChange={phone => dispatch({ type: 'setPhone', phone })}
          onSubmit={() => dispatch({ type: 'next' })}
        />
      )
    case 'confirm':
      return (
        <ConfirmStep
          summary={bookingSummary(state)}
          barber={state.barber}
          name={state.name}
          phone={state.phone}
          error={state.submit.kind === 'error' ? state.submit.message : undefined}
        />
      )
  }
}

/** Загрузка свободных дней живёт здесь, потому что хук не может вызываться до выбора барбера. */
function DateBody(props: Props) {
  const { state, dispatch } = props
  if (state.barber === null) return null
  return (
    <DateLoader
      {...props}
      barber={state.barber}
      selected={state.dateKey}
      onSelect={dateKey => dispatch({ type: 'selectDate', dateKey })}
    />
  )
}

type DateLoaderProps = Props & {
  barber: BarberChoice
  selected: string | null
  onSelect: (dateKey: string) => void
}

function DateLoader({ source, state, dateKeys, todayKey, barber, selected, onSelect }: DateLoaderProps) {
  const { state: days } = useDays(source, {
    serviceIds: state.serviceIds,
    barber,
    from: todayKey,
    days: dateKeys.length,
  })
  return <DateStep dateKeys={dateKeys} todayKey={todayKey} selected={selected} days={days} onSelect={onSelect} />
}

function TimeBody(props: Props) {
  const { state, dispatch, source, dateKeys } = props
  if (state.barber === null || state.dateKey === null) return null
  return (
    <TimeStep
      source={source}
      barber={state.barber}
      serviceIds={state.serviceIds}
      dateKey={state.dateKey}
      dateKeys={dateKeys}
      selected={state.slot}
      onSelect={slot => dispatch({ type: 'selectSlot', slot })}
      onSelectDate={dateKey => dispatch({ type: 'selectDate', dateKey })}
      onPickAnotherDay={() => dispatch({ type: 'goTo', step: 'date' })}
    />
  )
}
