import { useEffect } from "react"
import type { PropsWithChildren } from "react"
import * as ScreenOrientation from "expo-screen-orientation"

import { useBreakpoints } from "@/utils/layoutBreakpoints"

export function OrientationLockProvider({ children }: PropsWithChildren) {
  const { isCompact, isTablet } = useBreakpoints()

  useEffect(() => {
    if (process.env.EXPO_OS === "web") {
      return
    }

    const timer = setTimeout(() => {
      const syncOrientation = async () => {
        try {
          if (isCompact) {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
            return
          }

          if (isTablet) {
            await ScreenOrientation.unlockAsync()
          }
        } catch (error) {
          console.error("orientation lock failed", error)
        }
      }

      void syncOrientation()
    }, 200)

    return () => clearTimeout(timer)
  }, [isCompact, isTablet])

  return children
}
