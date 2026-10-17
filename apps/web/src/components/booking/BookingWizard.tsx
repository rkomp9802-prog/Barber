'use client'

import { useEffect, useMemo, useReducer, useRef, useState, type Dispatch } from 'react'

import { formatUzPhone, nextDateKeys, type BookingDto } from '@barber/shared'

import { PendingConfirmation } from '@/components/manage/PendingConfirmation'
import { describeSubmitError } from '@/lib/apiErrors'

import { bookingReducer, createInitialState, isStepValid, toDraft, type BookingAction, type BookingState, type InitialSelection } from './bookingState'
import { bookingSummary, summaryFromBooking } from './bookingSummary'
import { pickSource, type BookingSource, type SourceMode } from './bookingSource'
import { StepBody } from './StepBody'
import { StepIndicator } from './StepIndicator'
import { StepNav } from './StepNav'
import { SuccessScreen } from './SuccessScreen'
import { MobileSummary, SummaryPanel } from './Summary'
import { STEPS, type BookingCatalog, type StepId } from './types'
import formStyles from './Form.module.css'
import styles from './Wizard.module.css'

const DAYS_AHEAD = 14
const CONTACTS_FORM_ID = 'booking-contacts'

const STEP_TITLES: Record<StepId, string> = {
  service: 'Что будем делать?',
  barber: 'Выберите мастера',
  date: 'Когда удобно прийти?',
  time: 'Выберите время',
  contacts: 'Как с вами связаться?',
  confirm: 'Проверьте запись',
}

const DEMO_NOTICE = 'Демо-режим: сервер недоступен, запись не сохранится'

type Props = {
  initialSelection: InitialSelection
  catalog: BookingCatalog
  /** live — настоящий API; demo — сервер недоступен, работаем на демо-данных. */
  mode: SourceMode
  /** Сегодняшняя дата по Ташкенту, посчитанная на сервере: одинаковая разметка на сервере и клиенте. */
  todayKey: string
  /** ?demo=error — загрузка слотов всегда падает, чтобы увидеть состояние ошибки. */
  isDemoError: boolean
}

/** Фокус на заголовок шага при переходе, чтобы скринридер и клавиатура «переехали» вместе с экраном. */
function useStepFocus(step: StepId) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    headingRef.current?.scrollIntoView({ block: 'start' })
    headingRef.current?.focus({ preventScroll: true })
  }, [step])
  return headingRef
}

function stepCounter(step: StepId): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(STEPS.indexOf(step) + 1)} — ${pad(STEPS.length)}`
}

async function submitBooking(state: BookingState, source: BookingSource, dispatch: Dispatch<BookingAction>) {
  const draft = toDraft(state)
  if (!draft || state.submit.kind === 'submitting') return
  dispatch({ type: 'submitStart' })
  try {
    const booking = await source.createBooking(draft)
    dispatch({ type: 'submitSuccess', booking })
  } catch (error: unknown) {
    const { message, step } = describeSubmitError(error)
    dispatch({ type: 'submitFailure', message, step })
  }
}

type ViewProps = {
  state: BookingState
  dispatch: Dispatch<BookingAction>
  source: BookingSource
  mode: SourceMode
  todayKey: string
}

function WizardView({ state, dispatch, source, mode, todayKey }: ViewProps) {
  const headingRef = useStepFocus(state.step)
  const dateKeys = nextDateKeys(new Date(`${todayKey}T12:00:00Z`), DAYS_AHEAD)
  const summary = bookingSummary(state)
  const isSubmitting = state.submit.kind === 'submitting'
  // Ошибку подтверждения показывает сам шаг «Подтверждение»; на остальных шагах — здесь.
  const stepError = state.submit.kind === 'error' && state.step !== 'confirm' ? state.submit.message : undefined

  return (
    <div className={styles.layout}>
      <section className={styles.main} aria-labelledby="step-title">
        <h1 className="visually-hidden">Онлайн-запись в Sharp Barbershop</h1>
        {mode === 'demo' && (
          <p className="muted" role="status">
            {DEMO_NOTICE}
          </p>
        )}
        <StepIndicator current={state.step} isLocked={isSubmitting} onGoTo={step => dispatch({ type: 'goTo', step })} />
        <header className={styles.stepHead}>
          <p className={styles.stepEyebrow}>{stepCounter(state.step)}</p>
          <h2 id="step-title" ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
            {STEP_TITLES[state.step]}
          </h2>
        </header>
        <div className={styles.body}>
          {stepError && (
            <p className={formStyles.formError} role="alert">
              {stepError}
            </p>
          )}
          <StepBody
            state={state}
            dispatch={dispatch}
            source={source}
            dateKeys={dateKeys}
            todayKey={todayKey}
            contactsFormId={CONTACTS_FORM_ID}
          />
        </div>
        <div className={styles.dock}>
          <MobileSummary summary={summary} />
          <StepNav
            step={state.step}
            canProceed={isStepValid(state, state.step)}
            isSubmitting={isSubmitting}
            contactsFormId={CONTACTS_FORM_ID}
            onBack={() => dispatch({ type: 'back' })}
            onNext={() => dispatch({ type: 'next' })}
            onSubmit={() => void submitBooking(state, source, dispatch)}
          />
        </div>
      </section>
      <aside className={styles.aside}>
        <SummaryPanel summary={summary} />
      </aside>
    </div>
  )
}

type BookingResultProps = {
  initialBooking: BookingDto
  clientName: string
  clientPhone: string
  isDemo: boolean
  onBookAgain: () => void
}

/** Запись с сайта сначала ждёт подтверждения в Telegram, затем показываем «вы записаны». */
function BookingResult({ initialBooking, clientName, clientPhone, isDemo, onBookAgain }: BookingResultProps) {
  const [booking, setBooking] = useState(initialBooking)
  if (booking.status === 'pending') {
    return (
      <div className={styles.pending}>
        <SummaryPanel summary={summaryFromBooking(booking)} />
        <PendingConfirmation booking={booking} onConfirmed={setBooking} />
      </div>
    )
  }
  return (
    <SuccessScreen
      summary={summaryFromBooking(booking)}
      booking={booking}
      clientName={clientName}
      // После подтверждения в Telegram в записи номер из Telegram — показываем его.
      clientPhone={booking.client.phone ? formatUzPhone(booking.client.phone) : clientPhone}
      isDemo={isDemo}
      onBookAgain={onBookAgain}
    />
  )
}

export function BookingWizard({ initialSelection, catalog, mode, todayKey, isDemoError }: Props) {
  const source = useMemo(() => pickSource(mode, isDemoError), [mode, isDemoError])
  const [state, dispatch] = useReducer(bookingReducer, { catalog, selection: initialSelection }, createInitialState)

  if (state.submit.kind === 'done') {
    return (
      <BookingResult
        key={state.submit.booking.id}
        initialBooking={state.submit.booking}
        clientName={state.name.trim()}
        clientPhone={state.phone}
        isDemo={mode === 'demo'}
        onBookAgain={() => dispatch({ type: 'reset' })}
      />
    )
  }
  return <WizardView state={state} dispatch={dispatch} source={source} mode={mode} todayKey={todayKey} />
}
