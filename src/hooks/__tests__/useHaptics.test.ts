import * as Haptics from "expo-haptics"
import { renderHook, act } from "@testing-library/react-native"

import { SETTINGS_HAPTICS_ENABLED } from "@/config/storageKeys"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { storage } from "@/utils/storage"

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}))

jest.mock("expo-device", () => ({
  isDevice: true,
}))

// eslint-disable-next-line import/first
import { useHaptics } from "../useHaptics"

const mockImpact = Haptics.impactAsync as jest.Mock
const mockNotification = Haptics.notificationAsync as jest.Mock

beforeEach(() => {
  storage.clearAll()
  jest.clearAllMocks()
  jest.useFakeTimers()
  // Reset store to defaults (hapticsEnabled: true) before each test.
  usePreferencesStore.setState({ hapticsEnabled: true })
})

afterEach(() => {
  jest.useRealTimers()
})

describe("useHaptics", () => {
  it("fires Medium impact for buttonPress", () => {
    const { result } = renderHook(() => useHaptics())
    act(() => {
      result.current.play("buttonPress")
    })
    expect(mockImpact).toHaveBeenCalledWith("medium")
  })

  it("fires Light impact for menuTap and sequenceFlash", () => {
    const { result } = renderHook(() => useHaptics())
    act(() => {
      result.current.play("menuTap")
      result.current.play("sequenceFlash")
    })
    expect(mockImpact).toHaveBeenCalledTimes(2)
    expect(mockImpact).toHaveBeenNthCalledWith(1, "light")
    expect(mockImpact).toHaveBeenNthCalledWith(2, "light")
  })

  it("maps countdownTick urgency to Heavy/Medium/Light", () => {
    const { result } = renderHook(() => useHaptics())
    act(() => {
      result.current.play("countdownTick", { urgency: "high" })
      result.current.play("countdownTick", { urgency: "medium" })
      result.current.play("countdownTick", { urgency: "low" })
    })
    expect(mockImpact).toHaveBeenNthCalledWith(1, "heavy")
    expect(mockImpact).toHaveBeenNthCalledWith(2, "medium")
    expect(mockImpact).toHaveBeenNthCalledWith(3, "light")
  })

  it("fires Success notification for newHighScore", () => {
    const { result } = renderHook(() => useHaptics())
    act(() => {
      result.current.play("newHighScore")
    })
    expect(mockNotification).toHaveBeenCalledWith("success")
  })

  it("fires Error notification for gameOver (single pulse)", () => {
    const { result } = renderHook(() => useHaptics())
    act(() => {
      result.current.play("gameOver")
    })
    expect(mockNotification).toHaveBeenCalledTimes(1)
    expect(mockNotification).toHaveBeenCalledWith("error")
  })

  it("fires Error notification twice for wrongButton", () => {
    const { result } = renderHook(() => useHaptics())
    act(() => {
      result.current.play("wrongButton")
    })
    expect(mockNotification).toHaveBeenCalledTimes(1)
    act(() => {
      jest.advanceTimersByTime(150)
    })
    expect(mockNotification).toHaveBeenCalledTimes(2)
    expect(mockNotification).toHaveBeenNthCalledWith(1, "error")
    expect(mockNotification).toHaveBeenNthCalledWith(2, "error")
  })

  it("no-ops when hapticsEnabled is false", () => {
    usePreferencesStore.setState({ hapticsEnabled: false })
    const { result } = renderHook(() => useHaptics())
    act(() => {
      result.current.play("buttonPress")
      result.current.play("newHighScore")
      result.current.play("wrongButton")
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(mockImpact).not.toHaveBeenCalled()
    expect(mockNotification).not.toHaveBeenCalled()
  })

  it("reacts to preference changes between renders", () => {
    const { result, rerender } = renderHook(() => useHaptics())

    act(() => {
      result.current.play("buttonPress")
    })
    expect(mockImpact).toHaveBeenCalledTimes(1)

    // User flips the toggle off mid-session.
    act(() => {
      usePreferencesStore.getState().setHapticsEnabled(false)
    })
    rerender({})

    act(() => {
      result.current.play("buttonPress")
    })
    expect(mockImpact).toHaveBeenCalledTimes(1) // still 1 — the second call was suppressed
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
