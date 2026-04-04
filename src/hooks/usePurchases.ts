import { useEffect, useRef, useState } from "react"
import { Platform } from "react-native"

import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  LOG_LEVEL,
} from "react-native-purchases"

import { saveString, loadString } from "@/utils/storage"

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? ""
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? ""
const REMOVE_ADS_CACHE_KEY = "ecomi:purchases:removeAds"

type UsePurchasesReturn = {
  isConfigured: boolean
  removeAds: boolean
  checkEntitlement: (entitlementId: string) => boolean
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>
  purchaseRemoveAds: () => Promise<boolean>
  restorePurchases: () => Promise<boolean>
}

export function usePurchases(): UsePurchasesReturn {
  const [isConfigured, setIsConfigured] = useState(false)
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null)
  const configuredRef = useRef(false)

  const removeAdsCached = loadString(REMOVE_ADS_CACHE_KEY) === "true"
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
    saveString(REMOVE_ADS_CACHE_KEY, hasRemoveAds.toString())
  }

  function checkEntitlement(entitlementId: string): boolean {
    if (!customerInfo) return false
    return !!customerInfo.entitlements.active[entitlementId]
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

  async function purchaseRemoveAds(): Promise<boolean> {
    try {
      const offerings = await Purchases.getOfferings()
      const pkg = offerings.current?.availablePackages.find(
        (p) => p.product.identifier === "ecomi_remove_ads",
      )
      if (!pkg) {
        console.warn("Remove Ads package not found in offerings")
        return false
      }
      return purchasePackage(pkg)
    } catch (err) {
      console.warn("Failed to get offerings:", err)
      return false
    }
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
    restorePurchases,
  }
}
