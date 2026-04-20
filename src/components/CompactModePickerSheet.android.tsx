import { forwardRef, useImperativeHandle, useRef } from "react"
import { View } from "react-native"

import {
  Host,
  ModalBottomSheet,
  RNHostView,
  type ModalBottomSheetRef,
} from "@expo/ui/jetpack-compose"

import { GameModePickerContent } from "@/components/GameModePickerContent"
import { compactModePickerSheetStyles as styles } from "@/components/compactModePickerSheetStyles"
import type {
  CompactModePickerSheetHandle,
  CompactModePickerSheetProps,
} from "@/components/CompactModePickerSheet.types"

export const CompactModePickerSheet = forwardRef<
  CompactModePickerSheetHandle,
  CompactModePickerSheetProps
>(function CompactModePickerSheet(
  {
    visible,
    onVisibleChange,
    pulsingMode,
    selectedMode,
    pulsePhase,
    theme,
    onSelectMode,
  },
  ref,
) {
  const sheetRef = useRef<ModalBottomSheetRef>(null)

  useImperativeHandle(ref, () => ({
    hideIfNeeded: async () => {
      await sheetRef.current?.hide()
    },
  }))

  const blockDismiss = Boolean(pulsingMode)

  return (
    <View
      style={styles.sheetHost}
      pointerEvents={visible ? "box-none" : "none"}
    >
      <Host matchContents style={styles.hostFill}>
        {visible ? (
          <ModalBottomSheet
            ref={sheetRef}
            onDismissRequest={() => {
              if (!blockDismiss) onVisibleChange(false)
            }}
            skipPartiallyExpanded
            containerColor={theme.backgroundColor}
            contentColor={theme.textColor}
            scrimColor="#73000000"
            sheetGesturesEnabled={!blockDismiss}
            properties={{
              shouldDismissOnBackPress: !blockDismiss,
              shouldDismissOnClickOutside: !blockDismiss,
            }}
          >
            <RNHostView matchContents>
              <View style={[styles.sheetPadding, { backgroundColor: theme.backgroundColor }]}>
                <GameModePickerContent
                  selectedMode={selectedMode}
                  pulsingMode={pulsingMode}
                  pulsePhase={pulsePhase}
                  theme={theme}
                  onSelectMode={onSelectMode}
                />
              </View>
            </RNHostView>
          </ModalBottomSheet>
        ) : null}
      </Host>
    </View>
  )
})
