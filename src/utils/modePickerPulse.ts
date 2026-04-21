import {
  MODE_PICKER_DISMISS_DELAY_MS,
  MODE_PICKER_PULSE_COUNT,
  MODE_PICKER_PULSE_DURATION_MS,
} from "@/config/modePickerTiming"

/**
 * Appends dim/bright pulse timeouts and a final completion timeout to `pulseTimersRef`.
 * Call after clearing prior timers and setting phase to `"bright"`.
 */
export function scheduleModePickerPulseSequence(
  pulseTimersRef: { current: ReturnType<typeof setTimeout>[] },
  setPulsePhase: (phase: "bright" | "dim") => void,
  onComplete: () => void,
): void {
  let delay = 0
  for (let i = 0; i < MODE_PICKER_PULSE_COUNT; i++) {
    pulseTimersRef.current.push(
      setTimeout(() => setPulsePhase("dim"), delay + MODE_PICKER_PULSE_DURATION_MS),
    )
    if (i < MODE_PICKER_PULSE_COUNT - 1) {
      pulseTimersRef.current.push(
        setTimeout(() => setPulsePhase("bright"), delay + MODE_PICKER_PULSE_DURATION_MS * 2),
      )
    }
    delay += MODE_PICKER_PULSE_DURATION_MS * 2
  }
  pulseTimersRef.current.push(setTimeout(onComplete, delay + MODE_PICKER_DISMISS_DELAY_MS))
}
