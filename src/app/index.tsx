import { Platform } from "react-native"
import { Redirect } from "expo-router"

import { GameScreen } from "@/screens/GameScreen"
import { loadString } from "@/utils/storage"

export default function IndexRoute() {
  if (Platform.OS === "ios" && !loadString("ecomi:tracking:asked")) {
    return <Redirect href="/tracking" />
  }

  return <GameScreen />
}
