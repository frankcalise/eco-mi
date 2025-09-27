import { FC } from "react"
import { Text, TextStyle, View } from "react-native"

import { $styles } from "@/theme/styles"

export const GameScreen: FC = function WelcomeScreen() {
  return (
    <View style={$styles.flex1}>
      <Text style={$text}>Game Screen</Text>
    </View>
  )
}

const $text: TextStyle = {
  color: "white",
  fontSize: 20,
  textAlign: "center",
  margin: 10,
}
