import { renderHook, act } from "@testing-library/react-native"
import * as GoogleMobileAds from "react-native-google-mobile-ads"

// Mock factory is self-contained (jest hoists it above imports). Arrays of
// created ad instances are exposed on the module itself so the test can
// introspect and drive events.
jest.mock("react-native-google-mobile-ads", () => {
  function createMockAd() {
    const listeners: Map<string, Array<() => void>> = new Map()
    return {
      load: jest.fn(),
      show: jest.fn(),
      addAdEventListener: jest.fn((event: string, listener: () => void) => {
        const list = listeners.get(event) ?? []
        list.push(listener)
        listeners.set(event, list)
        return () => {
          const current = listeners.get(event) ?? []
          listeners.set(
            event,
            current.filter((l) => l !== listener),
          )
        }
      }),
      _listeners: listeners,
      emit(event: string) {
        const list = listeners.get(event) ?? []
        for (const l of [...list]) l()
      },
    }
  }

  const interstitialInstances: ReturnType<typeof createMockAd>[] = []
  const rewardedInstances: ReturnType<typeof createMockAd>[] = []

  return {
    __esModule: true,
    AdEventType: {
      LOADED: "loaded",
      CLOSED: "closed",
      ERROR: "error",
      OPENED: "opened",
      CLICKED: "clicked",
    },
    RewardedAdEventType: {
      LOADED: "rewarded_loaded",
      EARNED_REWARD: "rewarded_earned",
    },
    AdsConsentStatus: { UNKNOWN: 0, REQUIRED: 1, NOT_REQUIRED: 2, OBTAINED: 3 },
    TestIds: { INTERSTITIAL: "test-interstitial", REWARDED: "test-rewarded" },
    AdsConsent: {
      requestInfoUpdate: jest.fn().mockResolvedValue(undefined),
      loadAndShowConsentFormIfRequired: jest.fn().mockResolvedValue(undefined),
      getConsentInfo: jest.fn().mockResolvedValue({ status: 2 }),
      getPurposeConsents: jest.fn().mockResolvedValue("1111"),
    },
    InterstitialAd: {
      createForAdRequest: jest.fn(() => {
        const ad = createMockAd()
        interstitialInstances.push(ad)
        return ad
      }),
    },
    RewardedAd: {
      createForAdRequest: jest.fn(() => {
        const ad = createMockAd()
        rewardedInstances.push(ad)
        return ad
      }),
    },
    // Test hooks (prefixed `__` to signal test-only).
    __interstitialInstances: interstitialInstances,
    __rewardedInstances: rewardedInstances,
  }
})

// eslint-disable-next-line import/first
import { useAds } from "../useAds"

type MockAdInstance = {
  load: jest.Mock
  show: jest.Mock
  emit: (event: string) => void
}

function getInterstitials(): MockAdInstance[] {
  return (GoogleMobileAds as unknown as { __interstitialInstances: MockAdInstance[] })
    .__interstitialInstances
}

function getRewardeds(): MockAdInstance[] {
  return (GoogleMobileAds as unknown as { __rewardedInstances: MockAdInstance[] })
    .__rewardedInstances
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  getInterstitials().length = 0
  getRewardeds().length = 0
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe("useAds ERROR retry", () => {
  it("schedules a debounced reload for the interstitial after an ERROR event", async () => {
    renderHook(() => useAds())
    await flushPromises()

    const interstitials = getInterstitials()
    expect(interstitials.length).toBe(1)
    expect(interstitials[0].load).toHaveBeenCalledTimes(1)

    act(() => {
      interstitials[0].emit("error")
    })

    // No immediate reload — only after the debounce window.
    expect(interstitials.length).toBe(1)

    act(() => {
      jest.advanceTimersByTime(30_000)
    })
    await flushPromises()

    expect(interstitials.length).toBe(2)
    expect(interstitials[1].load).toHaveBeenCalledTimes(1)
  })

  it("schedules a debounced reload for the rewarded ad after an ERROR event", async () => {
    renderHook(() => useAds())
    await flushPromises()

    const rewardeds = getRewardeds()
    expect(rewardeds.length).toBe(1)

    act(() => {
      rewardeds[0].emit("error")
    })

    expect(rewardeds.length).toBe(1)

    act(() => {
      jest.advanceTimersByTime(30_000)
    })
    await flushPromises()

    expect(rewardeds.length).toBe(2)
    expect(rewardeds[1].load).toHaveBeenCalledTimes(1)
  })

  it("clears a pending retry on unmount so no reload fires after teardown", async () => {
    const { unmount } = renderHook(() => useAds())
    await flushPromises()

    const interstitials = getInterstitials()
    act(() => {
      interstitials[0].emit("error")
    })

    unmount()

    act(() => {
      jest.advanceTimersByTime(30_000)
    })
    await flushPromises()

    expect(interstitials.length).toBe(1)
  })
})

describe("useAds return shape", () => {
  it("does not expose consentReady", async () => {
    const { result } = renderHook(() => useAds())
    await flushPromises()

    expect(Object.prototype.hasOwnProperty.call(result.current, "consentReady")).toBe(false)
  })
})
