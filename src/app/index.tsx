import { Platform } from "react-native"
import { Redirect } from "expo-router"

import { TRACKING_ASKED } from "@/config/storageKeys"
import { GameScreen } from "@/screens/GameScreen"
import { loadString } from "@/utils/storage"

export default function IndexRoute() {
  if (Platform.OS === "ios" && !loadString(TRACKING_ASKED)) {
    return <Redirect href="/tracking" />
  }

  return <GameScreen />
}
