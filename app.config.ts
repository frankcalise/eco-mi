import { ExpoConfig, ConfigContext } from "@expo/config"

const IS_DEV = process.env.APP_VARIANT === "development"
const ADMOB_TEST_ANDROID = "ca-app-pub-3940256099942544~3347511713"
const ADMOB_TEST_IOS = "ca-app-pub-3940256099942544~1458002511"

const ADMOB_ANDROID_APP_ID = IS_DEV ? ADMOB_TEST_ANDROID : process.env.ADMOB_APP_ID_ANDROID
const ADMOB_IOS_APP_ID = IS_DEV ? ADMOB_TEST_IOS : process.env.ADMOB_APP_ID_IOS

module.exports = ({ config }: ConfigContext): Partial<ExpoConfig> => {
  return {
    ...config,
    name: "Eco Mi",
    slug: "EcoMi",
    scheme: "ecomi",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    icon: "./assets/images/app-icon-all.png",
    updates: {
      fallbackToCacheTimeout: 0,
    },
    assetBundlePatterns: ["**/*"],
    android: {
      icon: "./assets/images/app-icon-android-legacy.png",
      package: "com.frankcalise.ecomi",
      adaptiveIcon: {
        foregroundImage: "./assets/images/app-icon-android-adaptive-foreground.png",
        backgroundImage: "./assets/images/app-icon-android-adaptive-background.png",
      },
      allowBackup: false,
    },
    ios: {
      icon: "./assets/images/app-icon-ios.png",
      supportsTablet: false,
      bundleIdentifier: "com.frankcalise.ecomi",
      privacyManifests: {
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
            NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
          },
        ],
      },
    },
    web: {
      favicon: "./assets/images/app-icon-web-favicon.png",
      bundler: "metro" as const,
    },
    plugins: [
      "expo-localization",
      [
        "expo-font",
        {
          fonts: [
            "./assets/fonts/Oxanium-Bold.ttf",
            "./assets/fonts/Oxanium-Medium.ttf",
            "./assets/fonts/Oxanium-Regular.ttf",
            "./assets/fonts/Oxanium-SemiBold.ttf",
          ],
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/app-icon-android-adaptive-foreground.png",
          imageWidth: 300,
          resizeMode: "contain",
          backgroundColor: "#191015",
        },
      ],
      [
        "react-native-edge-to-edge",
        {
          android: {
            parentTheme: "Light",
            enforceNavigationBarContrast: false,
          },
        },
      ],
      "expo-router",
      [
        "react-native-audio-api",
        {
          androidPermissions: ["android.permission.MODIFY_AUDIO_SETTINGS"],
        },
      ],
      "expo-tracking-transparency",
      "expo-sharing",
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: ADMOB_ANDROID_APP_ID,
          iosAppId: ADMOB_IOS_APP_ID,
        },
      ],
    ],
    experiments: {
      tsconfigPaths: true,
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      ignite: {
        version: "11.1.3",
      },
      router: {},
      eas: {
        projectId: "a7ae3db1-a5a2-4deb-ba44-ffa09d58aead",
      },
    },
  }
}
