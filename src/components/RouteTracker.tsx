import { useEffect } from "react"
import { useGlobalSearchParams, usePathname } from "expo-router"
import { usePostHog } from "posthog-react-native"

export function RouteTracker() {
  const posthog = usePostHog()
  const pathname = usePathname()
  const params = useGlobalSearchParams()

  useEffect(() => {
    if (!pathname || !posthog) return
    posthog.screen(pathname, params)
    posthog.register({ $pathname: pathname })
  }, [pathname, params, posthog])

  return null
}
