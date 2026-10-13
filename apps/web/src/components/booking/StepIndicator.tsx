import { STEPS, STEP_LABELS, type StepId } from './types'
import styles from './Wizard.module.css'

type Props = {
  current: StepId
  isLocked: boolean
  onGoTo: (step: StepId) => void
}

function stepNumber(index: number): string {
  return String(index + 1).padStart(2, '0')
}

/** Индикатор шагов: пройденные шаги — кнопки, чтобы вернуться назад. */
export function StepIndicator({ current, isLocked, onGoTo }: Props) {
  const currentIndex = STEPS.indexOf(current)

  return (
    <nav aria-label="Шаги записи" className={styles.indicator}>
      <p className={styles.progressText}>
        Шаг {currentIndex + 1} из {STEPS.length}
      </p>
      <ol className={styles.steps}>
        {STEPS.map((step, index) => {
          const label = STEP_LABELS[step]
          if (index < currentIndex) {
            return (
              <li key={step} className={`${styles.step} ${styles.stepDone}`}>
                <button
                  type="button"
                  className={styles.stepButton}
                  onClick={() => onGoTo(step)}
                  disabled={isLocked}
                  aria-label={`${label}: вернуться к шагу`}
                >
                  <span className={styles.stepNum} aria-hidden="true">
                    ✓
                  </span>
                  <span className={styles.stepLabel}>{label}</span>
                </button>
              </li>
            )
          }
          const isCurrent = index === currentIndex
          return (
            <li key={step} className={`${styles.step} ${isCurrent ? styles.stepCurrent : ''}`}>
              <span className={styles.stepStatic} aria-current={isCurrent ? 'step' : undefined}>
                <span className={styles.stepNum} aria-hidden="true">
                  {stepNumber(index)}
                </span>
                <span className={styles.stepLabel}>{label}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
