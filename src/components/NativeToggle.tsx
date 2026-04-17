import { Platform } from "react-native"

import { UI_COLORS } from "@/theme/uiColors"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  Host,
  Toggle,
  Switch: ComposeSwitch,
} = Platform.OS === "ios"
  ? { ...require("@expo/ui/swift-ui"), Switch: undefined }
  : { ...require("@expo/ui/jetpack-compose"), Toggle: undefined }

type NativeToggleProps = {
  value: boolean
  onValueChange: (value: boolean) => void
  activeColor?: string
  inactiveColor?: string
  testID?: string
}

export function NativeToggle({
  value,
  onValueChange,
  activeColor,
  inactiveColor,
  testID,
}: NativeToggleProps) {
  if (Platform.OS === "ios") {
    return (
      <Host matchContents testID={testID}>
        <Toggle isOn={value} onIsOnChange={onValueChange} />
      </Host>
    )
  }

  return (
    <Host matchContents testID={testID}>
      <ComposeSwitch
        value={value}
        onCheckedChange={onValueChange}
        {...(activeColor && inactiveColor
          ? {
              colors: {
                checkedThumbColor: UI_COLORS.white,
                checkedTrackColor: activeColor,
                uncheckedTrackColor: inactiveColor,
              },
            }
          : {})}
      />
    </Host>
  )
}
