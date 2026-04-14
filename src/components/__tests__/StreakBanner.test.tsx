import { render } from "@testing-library/react-native"

import { DAILY_CURRENT_STREAK, DAILY_LAST_PLAYED } from "@/config/storageKeys"
import type { GameTheme } from "@/config/themes"
import { storage } from "@/utils/storage"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
  }),
}))

// eslint-disable-next-line import/first
import { StreakBanner } from "../StreakBanner"

const classicTheme: GameTheme = {
  id: "classic",
  name: "Classic",
  free: true,
  buttonColors: {
    red: { color: "#ef4444", activeColor: "#fca5a5" },
    blue: { color: "#3b82f6", activeColor: "#93c5fd" },
    green: { color: "#22c55e", activeColor: "#86efac" },
    yellow: { color: "#eab308", activeColor: "#fde047" },
  },
  backgroundColor: "#1a1a2e",
  textColor: "#ffffff",
  secondaryTextColor: "#a0a0a0",
  statusBarStyle: "light",
  surfaceColor: "rgba(0, 0, 0, 0.3)",
  borderColor: "rgba(255, 255, 255, 0.2)",
  accentColor: "#22c55e",
  destructiveColor: "#ef4444",
  warningColor: "#fbbf24",
  linkColor: "#3b82f6",
}

beforeEach(() => {
  storage.clearAll()
  jest.useFakeTimers()
  jest.setSystemTime(new Date("2026-04-14T12:00:00"))
})

afterEach(() => {
  jest.useRealTimers()
})

describe("StreakBanner", () => {
  it("returns null when no streak", () => {
    const { toJSON } = render(<StreakBanner theme={classicTheme} />)
    expect(toJSON()).toBeNull()
  })

  it("returns null when streak > 0 but already played today", () => {
    storage.set(DAILY_CURRENT_STREAK, "3")
    storage.set(DAILY_LAST_PLAYED, "2026-04-14")

    const { toJSON } = render(<StreakBanner theme={classicTheme} />)
    expect(toJSON()).toBeNull()
  })

  it("shows banner when streak > 0 and not played today", () => {
    storage.set(DAILY_CURRENT_STREAK, "3")
    storage.set(DAILY_LAST_PLAYED, "2026-04-13")

    const { getByText } = render(<StreakBanner theme={classicTheme} />)
    expect(getByText('game:streakAtRisk {"count":3}')).toBeTruthy()
  })
})
