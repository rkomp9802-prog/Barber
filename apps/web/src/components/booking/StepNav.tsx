import type { StepId } from './types'
import styles from './Wizard.module.css'

type Props = {
  step: StepId
  canProceed: boolean
  isSubmitting: boolean
  contactsFormId: string
  onBack: () => void
  onNext: () => void
  onSubmit: () => void
}

/** Кнопки «Назад» / «Далее». На контактах «Далее» отправляет форму, на последнем шаге — создаёт запись. */
export function StepNav({ step, canProceed, isSubmitting, contactsFormId, onBack, onNext, onSubmit }: Props) {
  const isFirst = step === 'service'
  const isConfirm = step === 'confirm'
  const nextLabel = isConfirm ? (isSubmitting ? 'Записываем…' : 'Подтвердить запись') : 'Далее'

  return (
    <div className={styles.nav}>
      {!isFirst && (
        <button type="button" className={`btn btn-ghost ${styles.back}`} onClick={onBack} disabled={isSubmitting}>
          <span aria-hidden="true">←</span> Назад
        </button>
      )}
      {step === 'contacts' ? (
        <button type="submit" form={contactsFormId} className={`btn btn-primary ${styles.next}`} disabled={!canProceed}>
          {nextLabel}
        </button>
      ) : (
        <button
          type="button"
          className={`btn btn-primary ${styles.next}`}
          onClick={isConfirm ? onSubmit : onNext}
          disabled={!canProceed || isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting && <span className={styles.spinner} aria-hidden="true" />}
          {nextLabel}
        </button>
      )}
    </div>
  )
}
