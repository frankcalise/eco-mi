import { renderHook, act } from "@testing-library/react-native"
import { Presets, usePatternComposer } from "react-native-pulsar"

import { SPIRAL_PATTERN, VICTORY_PATTERN } from "@/config/hapticPatterns"
import { SETTINGS_HAPTICS_ENABLED } from "@/config/storageKeys"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { storage } from "@/utils/storage"

jest.mock("react-native-pulsar", () => ({
  Presets: {
    System: {
      impactLight: jest.fn(),
      impactMedium: jest.fn(),
      impactHeavy: jest.fn(),
      impactSoft: jest.fn(),
      impactRigid: jest.fn(),
      notificationSuccess: jest.fn(),
      notificationWarning: jest.fn(),
      notificationError: jest.fn(),
      selection: jest.fn(),
    },
  },
  usePatternComposer: jest.fn(),
}))

jest.mock("expo-device", () => ({
  isDevice: true,
}))

// eslint-disable-next-line import/first
import { useHaptics } from "../useHaptics"

const mockImpactLight = Presets.System.impactLight as unknown as jest.Mock
const mockImpactMedium = Presets.System.impactMedium as unknown as jest.Mock
const mockImpactHeavy = Presets.System.impactHeavy as unknown as jest.Mock
const mockNotificationError = Presets.System.notificationError as unknown as jest.Mock
const mockUsePatternComposer = usePatternComposer as unknown as jest.Mock

// Separate play spies per authored pattern so assertions can distinguish
// which composer fired without leaning on call-order brittleness.
const mockVictoryPlay = jest.fn()
const mockSpiralPlay = jest.fn()

function makeComposer(play: jest.Mock) {
  return { play, stop: jest.fn(), parse: jest.fn(), isParsed: jest.fn(() => true) }
}

beforeEach(() => {
  storage.clearAll()
  jest.clearAllMocks()
  jest.useFakeTimers()
  usePreferencesStore.setState({ hapticsEnabled: true })
  mockUsePatternComposer.mockImplementation((pattern) => {
    if (pattern === VICTORY_PATTERN) return makeComposer(mockVictoryPlay)
    if (pattern === SPIRAL_PATTERN) return makeComposer(mockSpiralPlay)
    return makeComposer(jest.fn())
  })
})

afterEach(() => {
  jest.useRealTimers()
})

describe("useHaptics", () => {
  it("fires impactMedium for buttonPress", () => {
    const { result } = renderHook(() => useHaptics())
    act(() => {
      result.current.play("buttonPress")
    })
    expect(mockImpactMedium).toHaveBeenCalledTimes(1)
  })

  it("fires impactLight for menuTap and sequenceFlash", () => {
    const { result } = renderHook(() => useHaptics())
    act(() => {
      result.current.play("menuTap")
      result.current.play("sequenceFlash")
    })
    expect(mockImpactLight).toHaveBeenCalledTimes(2)
  })

  it("maps countdownTick urgency to Heavy/Medium/Light", () => {
    const { result } = renderHook(() => useHaptics())
    act(() => {
      result.current.play("countdownTick", { urgency: "high" })
      result.current.play("countdownTick", { urgency: "medium" })
      result.current.play("countdownTick", { urgency: "low" })
    })
    expect(mockImpactHeavy).toHaveBeenCalledTimes(1)
    expect(mockImpactMedium).toHaveBeenCalledTimes(1)
    expect(mockImpactLight).toHaveBeenCalledTimes(1)
  })

  it("plays VICTORY_PATTERN composer for newHighScore", () => {
    const { result } = renderHook(() => useHaptics())
    act(() => {
      result.current.play("newHighScore")
    })
    expect(mockVictoryPlay).toHaveBeenCalledTimes(1)
    expect(mockSpiralPlay).not.toHaveBeenCalled()
  })

  it("plays SPIRAL_PATTERN composer for gameOver", () => {
    const { result } = renderHook(() => useHaptics())
    act(() => {
      result.current.play("gameOver")
    })
    expect(mockSpiralPlay).toHaveBeenCalledTimes(1)
    expect(mockVictoryPlay).not.toHaveBeenCalled()
  })

  it("fires notificationError once for wrongButton (Pulsar preset handles double-pulse natively)", () => {
    const { result } = renderHook(() => useHaptics())
    act(() => {
      result.current.play("wrongButton")
    })
    expect(mockNotificationError).toHaveBeenCalledTimes(1)
  })

  it("no-ops when hapticsEnabled is false", () => {
    usePreferencesStore.setState({ hapticsEnabled: false })
    const { result } = renderHook(() => useHaptics())
    act(() => {
      result.current.play("buttonPress")
      result.current.play("newHighScore")
      result.current.play("gameOver")
      result.current.play("wrongButton")
    })
    expect(mockImpactMedium).not.toHaveBeenCalled()
    expect(mockVictoryPlay).not.toHaveBeenCalled()
    expect(mockSpiralPlay).not.toHaveBeenCalled()
    expect(mockNotificationError).not.toHaveBeenCalled()
  })

  it("reacts to preference changes between renders", () => {
    const { result, rerender } = renderHook(() => useHaptics())

    act(() => {
      result.current.play("buttonPress")
    })
    expect(mockImpactMedium).toHaveBeenCalledTimes(1)

    act(() => {
      usePreferencesStore.getState().setHapticsEnabled(false)
    })
    rerender({})

    act(() => {
      result.current.play("buttonPress")
    })
    expect(mockImpactMedium).toHaveBeenCalledTimes(1)
  })

  it("persists hapticsEnabled changes to MMKV via setHapticsEnabled", () => {
    act(() => {
      usePreferencesStore.getState().setHapticsEnabled(false)
    })
    expect(storage.getString(SETTINGS_HAPTICS_ENABLED)).toBe("false")

    act(() => {
      usePreferencesStore.getState().setHapticsEnabled(true)
    })
    expect(storage.getString(SETTINGS_HAPTICS_ENABLED)).toBe("true")
  })
})
