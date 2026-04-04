import { Platform } from "react-native"

const fonts = {
  oxanium: {
    regular: "Oxanium-Regular",
    medium: "Oxanium-Medium",
    semiBold: "Oxanium-SemiBold",
    bold: "Oxanium-Bold",
  },
  helveticaNeue: {
    thin: "HelveticaNeue-Thin",
    light: "HelveticaNeue-Light",
    normal: "Helvetica Neue",
    medium: "HelveticaNeue-Medium",
  },
  courier: {
    normal: "Courier",
  },
  sansSerif: {
    thin: "sans-serif-thin",
    light: "sans-serif-light",
    normal: "sans-serif",
    medium: "sans-serif-medium",
  },
  monospace: {
    normal: "monospace",
  },
}

export const typography = {
  fonts,
  primary: fonts.oxanium,
  secondary: Platform.select({ ios: fonts.helveticaNeue, android: fonts.sansSerif }),
  code: Platform.select({ ios: fonts.courier, android: fonts.monospace }),
}
