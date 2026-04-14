import { renderHook, act } from "@testing-library/react-native"
import * as Notifications from "expo-notifications"

import {
  DAILY_CURRENT_STREAK,
  DAILY_LAST_PLAYED,
  NOTIFICATIONS_PERMISSION_ASKED,
  STATS_GAMES_PLAYED,
} from "@/config/storageKeys"
import { storage } from "@/utils/storage"

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: "date" },
}))

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
  }),
}))

// eslint-disable-next-line import/first
import { useNotifications } from "../useNotifications"

const mockGetPermissions = Notifications.getPermissionsAsync as jest.Mock
const mockRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock
const mockCancel = Notifications.cancelAllScheduledNotificationsAsync as jest.Mock
const mockSchedule = Notifications.scheduleNotificationAsync as jest.Mock

beforeEach(() => {
  storage.clearAll()
  jest.useFakeTimers()
  jest.setSystemTime(new Date("2026-04-14T15:00:00"))
  jest.clearAllMocks()

  mockGetPermissions.mockResolvedValue({ status: "granted" })
  mockRequestPermissions.mockResolvedValue({ status: "granted" })
  mockCancel.mockResolvedValue(undefined)
  mockSchedule.mockResolvedValue("notification-id")
})

afterEach(() => {
  jest.useRealTimers()
})

function todayKey() {
  return "2026-04-14"
}

describe("useNotifications", () => {
  it("does not request permission when gamesPlayed < 3", async () => {
    storage.set(STATS_GAMES_PLAYED, "2")

    renderHook(() => useNotifications())
    await act(async () => {})

    expect(mockRequestPermissions).not.toHaveBeenCalled()
    expect(mockGetPermissions).not.toHaveBeenCalled()
  })

  it("requests permission after 3+ games when not previously asked", async () => {
    storage.set(STATS_GAMES_PLAYED, "5")

    renderHook(() => useNotifications())
    await act(async () => {})

    expect(mockRequestPermissions).toHaveBeenCalled()
    expect(storage.getString(NOTIFICATIONS_PERMISSION_ASKED)).toBe("true")
  })

  it("checks existing permission if already asked", async () => {
    storage.set(STATS_GAMES_PLAYED, "5")
    storage.set(NOTIFICATIONS_PERMISSION_ASKED, "true")

    renderHook(() => useNotifications())
    await act(async () => {})

    expect(mockGetPermissions).toHaveBeenCalled()
    expect(mockRequestPermissions).not.toHaveBeenCalled()
  })

  it("cancels all existing notifications before scheduling", async () => {
    storage.set(STATS_GAMES_PLAYED, "5")

    renderHook(() => useNotifications())
    await act(async () => {})

    expect(mockCancel).toHaveBeenCalled()
  })

  it("schedules daily reminder at 19:00 if not played today (before 19:00)", async () => {
    storage.set(STATS_GAMES_PLAYED, "5")
    // No DAILY_LAST_PLAYED set — not played today

    renderHook(() => useNotifications())
    await act(async () => {})

    const dailyCall = mockSchedule.mock.calls.find(
      (call: unknown[]) => (call[0] as { content: { body: string } }).content.body === "notifications:dailyReminder",
    )
    expect(dailyCall).toBeDefined()

    const triggerDate = (dailyCall![0] as { trigger: { date: Date } }).trigger.date
    expect(triggerDate.getHours()).toBe(19)
    expect(triggerDate.getMinutes()).toBe(0)
  })

  it("skips daily reminder if already played today", async () => {
    storage.set(STATS_GAMES_PLAYED, "5")
    storage.set(DAILY_LAST_PLAYED, todayKey())

    renderHook(() => useNotifications())
    await act(async () => {})

    const dailyCall = mockSchedule.mock.calls.find(
      (call: unknown[]) => (call[0] as { content: { body: string } }).content.body === "notifications:dailyReminder",
    )
    expect(dailyCall).toBeUndefined()
  })

  it("skips daily reminder if after 19:00", async () => {
    jest.setSystemTime(new Date("2026-04-14T20:00:00"))
    storage.set(STATS_GAMES_PLAYED, "5")

    renderHook(() => useNotifications())
    await act(async () => {})

    const dailyCall = mockSchedule.mock.calls.find(
      (call: unknown[]) => (call[0] as { content: { body: string } }).content.body === "notifications:dailyReminder",
    )
    expect(dailyCall).toBeUndefined()
  })

  it("schedules streak-save at 10:00 tomorrow if streak active and played today", async () => {
    storage.set(STATS_GAMES_PLAYED, "5")
    storage.set(DAILY_CURRENT_STREAK, "5")
    storage.set(DAILY_LAST_PLAYED, todayKey())

    renderHook(() => useNotifications())
    await act(async () => {})

    const streakCall = mockSchedule.mock.calls.find(
      (call: unknown[]) =>
        ((call[0] as { content: { body: string } }).content.body as string).startsWith("notifications:streakAtRisk"),
    )
    expect(streakCall).toBeDefined()

    const triggerDate = (streakCall![0] as { trigger: { date: Date } }).trigger.date
    expect(triggerDate.getDate()).toBe(15) // tomorrow
    expect(triggerDate.getHours()).toBe(10)
  })

  it("skips streak-save if no active streak", async () => {
    storage.set(STATS_GAMES_PLAYED, "5")
    storage.set(DAILY_LAST_PLAYED, todayKey())
    // No streak set (defaults to 0)

    renderHook(() => useNotifications())
    await act(async () => {})

    const streakCall = mockSchedule.mock.calls.find(
      (call: unknown[]) =>
        ((call[0] as { content: { body: string } }).content.body as string).startsWith("notifications:streakAtRisk"),
    )
    expect(streakCall).toBeUndefined()
  })

  it("always schedules win-back notification 3 days out", async () => {
    storage.set(STATS_GAMES_PLAYED, "5")

    renderHook(() => useNotifications())
    await act(async () => {})

    const winBackCall = mockSchedule.mock.calls.find(
      (call: unknown[]) => (call[0] as { content: { body: string } }).content.body === "notifications:winBack",
    )
    expect(winBackCall).toBeDefined()

    const triggerDate = (winBackCall![0] as { trigger: { date: Date } }).trigger.date
    expect(triggerDate.getDate()).toBe(17) // 3 days from April 14
    expect(triggerDate.getHours()).toBe(12)
  })

  it("rescheduleAfterGameOver triggers new scheduling", async () => {
    storage.set(STATS_GAMES_PLAYED, "5")

    const { result } = renderHook(() => useNotifications())
    await act(async () => {})

    mockCancel.mockClear()
    mockSchedule.mockClear()

    await act(async () => {
      result.current.rescheduleAfterGameOver()
    })

    expect(mockCancel).toHaveBeenCalled()
    expect(mockSchedule).toHaveBeenCalled()
  })
})
