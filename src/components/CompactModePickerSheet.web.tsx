import { forwardRef, useImperativeHandle } from "react"

import type {
  CompactModePickerSheetHandle,
  CompactModePickerSheetProps,
} from "@/components/CompactModePickerSheet.types"

/** GameScreen does not mount native sheets on web; stub keeps imports safe for web bundles. */
export const CompactModePickerSheet = forwardRef<
  CompactModePickerSheetHandle,
  CompactModePickerSheetProps
>(function CompactModePickerSheet(_props, ref) {
  useImperativeHandle(
    ref,
    () => ({
      hideIfNeeded: async () => {},
    }),
    [],
  )

  return null
})
