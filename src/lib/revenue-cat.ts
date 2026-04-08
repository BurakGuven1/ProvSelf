import Constants from 'expo-constants';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from 'react-native-purchases';

export type { CustomerInfo, PurchasesOfferings, PurchasesPackage, PurchasesStoreProduct };

const extra =
  Constants.expoConfig?.extra ??
  (Constants as unknown as { manifest2?: { extra?: Record<string, unknown> } }).manifest2?.extra ??
  (Constants as unknown as { manifest?: { extra?: Record<string, unknown> } }).manifest?.extra ??
  {};
const API_KEY = typeof extra.revenueCatApiKey === 'string' ? extra.revenueCatApiKey : '';
// `storeClient` = Expo Go. TestFlight/App Store builds should not be blocked.
const isExpoGo = Constants.executionEnvironment === 'storeClient';

let isConfigured = false;

export async function configureRevenueCat() {
  if (isExpoGo) {
    console.warn('[RevenueCat] Skipped — running in Expo Go. Use EAS dev build for IAP.');
    return;
  }
  if (isConfigured || !API_KEY) return;

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  Purchases.configure({ apiKey: API_KEY });
  isConfigured = true;
}

export async function loginRevenueCat(userId: string) {
  if (isExpoGo || !isConfigured) return;
  try {
    await Purchases.logIn(userId);
  } catch (err) {
    console.error('[RevenueCat] Login failed:', err);
  }
}

export async function logoutRevenueCat() {
  if (isExpoGo || !isConfigured) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    console.error('[RevenueCat] Logout failed:', err);
  }
}

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  if (isExpoGo || !isConfigured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (err) {
    console.error('[RevenueCat] getOfferings failed:', err);
    return null;
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function purchaseProduct(productId: string): Promise<CustomerInfo> {
  const products = await Purchases.getProducts([productId]);
  if (products.length === 0) {
    throw new Error(`Product not found: ${productId}`);
  }
  const { customerInfo } = await Purchases.purchaseStoreProduct(products[0]);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (isExpoGo || !isConfigured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (err) {
    console.error('[RevenueCat] getCustomerInfo failed:', err);
    return null;
  }
}

export function isProSubscriber(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return info.entitlements.active['pro'] !== undefined;
}

export function isRevenueCatConfigured(): boolean {
  return isConfigured;
}
