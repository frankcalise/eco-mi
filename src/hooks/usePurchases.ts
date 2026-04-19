import { useEffect, useRef, useState } from "react"
import { Platform } from "react-native"
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  LOG_LEVEL,
} from "react-native-purchases"

import { PURCHASES_ENTITLEMENT_PREFIX, PURCHASES_REMOVE_ADS } from "@/config/storageKeys"
import { saveString, loadString } from "@/utils/storage"

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? ""
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? ""

const THEME_ENTITLEMENT_MAP: Record<string, string> = {
  neon: "theme_neon",
  retro: "theme_retro",
  pastel: "theme_pastel",
}

const SOUND_ENTITLEMENT_MAP: Record<string, string[]> = {
  // Canonical entitlement IDs + legacy aliases for backward compatibility.
  square: ["sound_square", "sound_retro"],
  sawtooth: ["sound_sawtooth", "sound_buzzy"],
  triangle: ["sound_triangle", "sound_mellow"],
}

const THEME_PRODUCT_MAP: Record<string, string> = {
  neon: "ecomi_theme_neon",
  retro: "ecomi_theme_retro",
  pastel: "ecomi_theme_pastel",
}

const SOUND_PRODUCT_MAP: Record<string, string> = {
  square: "ecomi_sound_square",
  sawtooth: "ecomi_sound_sawtooth",
  triangle: "ecomi_sound_triangle",
}

type UsePurchasesReturn = {
  isConfigured: boolean
  removeAds: boolean
  checkEntitlement: (entitlementId: string) => boolean
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>
  purchaseRemoveAds: () => Promise<boolean>
  purchaseProduct: (productId: string) => Promise<boolean>
  restorePurchases: () => Promise<boolean>
  ownsTheme: (themeId: string) => boolean
  ownsSoundPack: (packId: string) => boolean
  getThemeProductId: (themeId: string) => string | undefined
  getSoundProductId: (packId: string) => string | undefined
}

export function usePurchases(): UsePurchasesReturn {
  const [isConfigured, setIsConfigured] = useState(false)
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null)
  const configuredRef = useRef(false)

  const removeAdsCached = loadString(PURCHASES_REMOVE_ADS) === "true"
  const removeAds = customerInfo
    ? !!customerInfo.entitlements.active["remove_ads"]
    : removeAdsCached

  useEffect(() => {
    configure()
  }, [])

  async function configure() {
    const apiKey = Platform.select({
      ios: REVENUECAT_IOS_KEY,
      android: REVENUECAT_ANDROID_KEY,
      default: "",
    })

    if (!apiKey || configuredRef.current) return

    try {
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG)
      }
      Purchases.configure({ apiKey })
      configuredRef.current = true
      setIsConfigured(true)

      const info = await Purchases.getCustomerInfo()
      setCustomerInfo(info)
      cacheEntitlements(info)
    } catch (err) {
      console.warn("RevenueCat configure failed:", err)
    }
  }

  function cacheEntitlements(info: CustomerInfo) {
    const hasRemoveAds = !!info.entitlements.active["remove_ads"]
    saveString(PURCHASES_REMOVE_ADS, hasRemoveAds.toString())

    const allEntitlements = [
      ...Object.values(THEME_ENTITLEMENT_MAP),
      ...Object.values(SOUND_ENTITLEMENT_MAP).flat(),
    ]
    for (const entId of allEntitlements) {
      const owned = !!info.entitlements.active[entId]
      saveString(`${PURCHASES_ENTITLEMENT_PREFIX}${entId}`, owned.toString())
    }
  }

  function checkEntitlement(entitlementId: string): boolean {
    if (customerInfo) {
      return !!customerInfo.entitlements.active[entitlementId]
    }
    return loadString(`${PURCHASES_ENTITLEMENT_PREFIX}${entitlementId}`) === "true"
  }

  function ownsTheme(themeId: string): boolean {
    if (themeId === "classic") return true
    const entId = THEME_ENTITLEMENT_MAP[themeId]
    if (!entId) return false
    return checkEntitlement(entId)
  }

  function ownsSoundPack(packId: string): boolean {
    if (packId === "sine") return true
    const entIds = SOUND_ENTITLEMENT_MAP[packId]
    if (!entIds) return false
    return entIds.some((entId) => checkEntitlement(entId))
  }

  function getThemeProductId(themeId: string): string | undefined {
    return THEME_PRODUCT_MAP[themeId]
  }

  function getSoundProductId(packId: string): string | undefined {
    return SOUND_PRODUCT_MAP[packId]
  }

  async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
    try {
      const { customerInfo: newInfo } = await Purchases.purchasePackage(pkg)
      setCustomerInfo(newInfo)
      cacheEntitlements(newInfo)
      return true
    } catch (err: unknown) {
      const error = err as { userCancelled?: boolean }
      if (error.userCancelled) return false
      console.warn("Purchase failed:", err)
      return false
    }
  }

  async function purchaseProduct(productId: string): Promise<boolean> {
    try {
      const offerings = await Purchases.getOfferings()
      const allPackages = offerings.current?.availablePackages ?? []
      const pkg = allPackages.find((p) => p.product.identifier === productId)
      if (!pkg) {
        console.warn(`Package not found for product: ${productId}`)
        return false
      }
      return purchasePackage(pkg)
    } catch (err) {
      console.warn("Failed to get offerings:", err)
      return false
    }
  }

  async function purchaseRemoveAds(): Promise<boolean> {
    return purchaseProduct("ecomi_remove_ads")
  }

  async function restorePurchases(): Promise<boolean> {
    try {
      const info = await Purchases.restorePurchases()
      setCustomerInfo(info)
      cacheEntitlements(info)
      return true
    } catch (err) {
      console.warn("Restore purchases failed:", err)
      return false
    }
  }

  return {
    isConfigured,
    removeAds,
    checkEntitlement,
    purchasePackage,
    purchaseRemoveAds,
    purchaseProduct,
    restorePurchases,
    ownsTheme,
    ownsSoundPack,
    getThemeProductId,
    getSoundProductId,
  }
}
