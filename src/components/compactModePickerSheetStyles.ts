import { StyleSheet } from "react-native"

export const compactModePickerSheetStyles = StyleSheet.create({
  hostFill: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  sheetPadding: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
})
