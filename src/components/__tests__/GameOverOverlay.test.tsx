import { render, fireEvent } from "@testing-library/react-native"

import type { GameTheme } from "@/config/themes"

jest.mock("react-native-ease", () => {
  const React = require("react")
  const RN = require("react-native")
  return {
    EaseView: ({ children, testID, style, ...rest }: any) =>
      React.createElement(RN.View, { testID, style, ...rest }, children),
  }
})

jest.mock("lottie-react-native", () => {
  const React = require("react")
  const RN = require("react-native")
  return {
    __esModule: true,
    default: (props: any) => React.createElement(RN.View, { testID: "lottie-view", ...props }),
  }
})

jest.mock("@expo/vector-icons", () => {
  const React = require("react")
  const RN = require("react-native")
  return {
    Ionicons: ({ name, ...rest }: any) =>
      React.createElement(RN.Text, { testID: `icon-${name}`, ...rest }, name),
  }
})

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
  }),
}))

// eslint-disable-next-line import/first
import { GameOverOverlay } from "../GameOverOverlay"

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

const baseProps = {
  visible: true,
  score: 10,
  level: 3,
  highScore: 15,
  isNewHighScore: false,
  theme: classicTheme,
  onPlayAgain: jest.fn(),
}

describe("GameOverOverlay", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns null when not visible", () => {
    const { toJSON } = render(<GameOverOverlay {...baseProps} visible={false} />)
    expect(toJSON()).toBeNull()
  })

  it("shows gameOver title when not new high score", () => {
    const { getByText } = render(<GameOverOverlay {...baseProps} />)
    expect(getByText("game:gameOver")).toBeTruthy()
  })

  it("shows newHighScore title when isNewHighScore", () => {
    const { getAllByText } = render(
      <GameOverOverlay {...baseProps} isNewHighScore={true} highScore={10} />,
    )
    // Title + badge both show "game:newHighScore"
    expect(getAllByText("game:newHighScore").length).toBeGreaterThanOrEqual(1)
  })

  it("shows PB delta when isNewHighScore with previousHighScore > 0", () => {
    const { getByText } = render(
      <GameOverOverlay
        {...baseProps}
        isNewHighScore={true}
        score={15}
        previousHighScore={10}
        highScore={15}
      />,
    )
    expect(getByText('game:pbDelta {"delta":5}')).toBeTruthy()
  })

  it("does not show PB delta when previousHighScore is 0", () => {
    const { queryByText } = render(
      <GameOverOverlay
        {...baseProps}
        isNewHighScore={true}
        score={15}
        previousHighScore={0}
        highScore={15}
      />,
    )
    expect(queryByText(/game:pbDelta/)).toBeNull()
  })

  it("shows near-miss text when within 5 points of high score", () => {
    const { getByText } = render(
      <GameOverOverlay {...baseProps} score={18} highScore={20} isNewHighScore={false} />,
    )
    expect(getByText('game:nearMiss {"delta":2}')).toBeTruthy()
  })

  it("does not show near-miss when gap > 5", () => {
    const { queryByText } = render(
      <GameOverOverlay {...baseProps} score={10} highScore={20} isNewHighScore={false} />,
    )
    expect(queryByText(/game:nearMiss/)).toBeNull()
  })

  it("does not show near-miss when score equals high score", () => {
    const { queryByText } = render(
      <GameOverOverlay {...baseProps} score={20} highScore={20} isNewHighScore={false} />,
    )
    expect(queryByText(/game:nearMiss/)).toBeNull()
  })

  it("shows share button when onShare provided", () => {
    const { getByTestId } = render(
      <GameOverOverlay {...baseProps} onShare={jest.fn()} />,
    )
    expect(getByTestId("btn-share")).toBeTruthy()
  })

  it("does not show share button when onShare not provided", () => {
    const { queryByTestId } = render(<GameOverOverlay {...baseProps} />)
    expect(queryByTestId("btn-share")).toBeNull()
  })

  it("shows continue button when showContinue is true", () => {
    const { getByTestId } = render(
      <GameOverOverlay {...baseProps} showContinue={true} onContinue={jest.fn()} />,
    )
    expect(getByTestId("btn-continue")).toBeTruthy()
  })

  it("shows remove ads button when showRemoveAds is true", () => {
    const { getByTestId } = render(
      <GameOverOverlay {...baseProps} showRemoveAds={true} onRemoveAds={jest.fn()} />,
    )
    expect(getByTestId("btn-remove-ads")).toBeTruthy()
  })

  it("shows trophy celebration when isNewHighScore", () => {
    const { getByTestId } = render(
      <GameOverOverlay {...baseProps} isNewHighScore={true} highScore={10} />,
    )
    expect(getByTestId("lottie-view")).toBeTruthy()
  })

  it("fires onPlayAgain callback when pressed", () => {
    const onPlayAgain = jest.fn()
    const { getByTestId } = render(
      <GameOverOverlay {...baseProps} onPlayAgain={onPlayAgain} />,
    )
    fireEvent.press(getByTestId("btn-play-again"))
    expect(onPlayAgain).toHaveBeenCalledTimes(1)
  })
})
