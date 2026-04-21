import { forwardRef, useImperativeHandle } from "react"
import { View } from "react-native"
import { BottomSheet, Group, Host, RNHostView } from "@expo/ui/swift-ui"
import {
  background,
  interactiveDismissDisabled,
  presentationDragIndicator,
} from "@expo/ui/swift-ui/modifiers"

import type {
  CompactModePickerSheetHandle,
  CompactModePickerSheetProps,
} from "@/components/CompactModePickerSheet.types"
import { compactModePickerSheetStyles as styles } from "@/components/compactModePickerSheetStyles"
import { GameModePickerContent } from "@/components/GameModePickerContent"

export const CompactModePickerSheet = forwardRef<
  CompactModePickerSheetHandle,
  CompactModePickerSheetProps
>(function CompactModePickerSheet(
  { visible, onVisibleChange, pulsingMode, selectedMode, pulsePhase, theme, onSelectMode },
  ref,
) {
  useImperativeHandle(
    ref,
    () => ({
      hideIfNeeded: async () => {},
    }),
    [],
  )

  return (
    <View style={styles.sheetHost} pointerEvents={visible ? "box-none" : "none"}>
      <Host style={styles.hostFill}>
        <BottomSheet isPresented={visible} onIsPresentedChange={onVisibleChange} fitToContents>
          <Group
            modifiers={[
              presentationDragIndicator("visible"),
              ...(pulsingMode ? [interactiveDismissDisabled(true)] : []),
              background(theme.backgroundColor),
            ]}
          >
            <RNHostView matchContents>
              <View
                style={[
                  styles.sheetPadding,
                  {
                    backgroundColor: theme.backgroundColor,
                    paddingTop: 24,
                    paddingBottom: 24,
                  },
                ]}
              >
                <GameModePickerContent
                  selectedMode={selectedMode}
                  pulsingMode={pulsingMode}
                  pulsePhase={pulsePhase}
                  theme={theme}
                  onSelectMode={onSelectMode}
                />
              </View>
            </RNHostView>
          </Group>
        </BottomSheet>
      </Host>
    </View>
  )
})
