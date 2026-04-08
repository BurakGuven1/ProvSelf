import { Platform } from 'react-native';

// HealthKit is only available on iOS physical devices with EAS builds.
// In Expo Go or Android, all functions gracefully return defaults.

let AppleHealthKit: any = null;
let isInitialized = false;

// Lazy-load react-native-health only on iOS (avoids crash on Android / Expo Go)
function getHealthKit(): any {
  if (AppleHealthKit !== null) return AppleHealthKit;
  if (Platform.OS !== 'ios') return null;
  try {
    AppleHealthKit = require('react-native-health').default;
    return AppleHealthKit;
  } catch {
    // Package not linked (e.g. Expo Go) — degrade gracefully
    console.warn('[HealthKit] react-native-health not available — using stubs');
    return null;
  }
}

const PERMISSIONS = {
  permissions: {
    read: [
      'StepCount',
      'DistanceWalkingRunning',
      'ActiveEnergyBurned',
      'SleepAnalysis',
      'AppleExerciseTime',
      'Water',
    ],
    write: [],
  },
};

export async function initHealthKit(): Promise<boolean> {
  const hk = getHealthKit();
  if (!hk) return false;

  return new Promise<boolean>((resolve) => {
    hk.initHealthKit(PERMISSIONS, (err: any) => {
      if (err) {
        console.error('[HealthKit] Init failed:', err);
        resolve(false);
        return;
      }
      isInitialized = true;
      resolve(true);
    });
  });
}

export async function getStepCount(date: Date): Promise<number> {
  const hk = getHealthKit();
  if (!hk || !isInitialized) return 0;

  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  return new Promise<number>((resolve) => {
    hk.getStepCount(
      { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      (err: any, results: { value: number }) => {
        if (err) {
          console.error('[HealthKit] getStepCount error:', err);
          resolve(0);
          return;
        }
        resolve(Math.round(results?.value ?? 0));
      },
    );
  });
}

export async function getDistanceWalkingRunning(date: Date): Promise<number> {
  const hk = getHealthKit();
  if (!hk || !isInitialized) return 0;

  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  return new Promise<number>((resolve) => {
    hk.getDistanceWalkingRunning(
      { startDate: startDate.toISOString(), endDate: endDate.toISOString(), unit: 'meter' },
      (err: any, results: { value: number }) => {
        if (err) {
          console.error('[HealthKit] getDistanceWalkingRunning error:', err);
          resolve(0);
          return;
        }
        resolve(Math.round(results?.value ?? 0));
      },
    );
  });
}

export async function getActiveEnergyBurned(date: Date): Promise<number> {
  const hk = getHealthKit();
  if (!hk || !isInitialized) return 0;

  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  return new Promise<number>((resolve) => {
    hk.getActiveEnergyBurned(
      { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      (err: any, results: Array<{ value: number }>) => {
        if (err) {
          console.error('[HealthKit] getActiveEnergyBurned error:', err);
          resolve(0);
          return;
        }
        const total = (results ?? []).reduce((sum, r) => sum + (r.value ?? 0), 0);
        resolve(Math.round(total));
      },
    );
  });
}

export async function getSleepHours(date: Date): Promise<number> {
  const hk = getHealthKit();
  if (!hk || !isInitialized) return 0;

  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  return new Promise<number>((resolve) => {
    hk.getSleepSamples(
      { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      (err: any, results: Array<{ startDate: string; endDate: string; value: string }>) => {
        if (err) {
          console.error('[HealthKit] getSleepSamples error:', err);
          resolve(0);
          return;
        }
        // Sum only ASLEEP samples (exclude INBED)
        let totalMinutes = 0;
        for (const sample of results ?? []) {
          if (sample.value === 'ASLEEP' || sample.value === 'INBED') {
            const start = new Date(sample.startDate).getTime();
            const end = new Date(sample.endDate).getTime();
            totalMinutes += (end - start) / (1000 * 60);
          }
        }
        resolve(Math.round((totalMinutes / 60) * 10) / 10); // 1 decimal
      },
    );
  });
}

export async function getMetricValue(metric: string, date: Date): Promise<number> {
  switch (metric) {
    case 'steps':
      return getStepCount(date);
    case 'distance':
      return getDistanceWalkingRunning(date);
    case 'active_calories':
      return getActiveEnergyBurned(date);
    case 'sleep_hours':
      return getSleepHours(date);
    case 'exercise_minutes':
      return getExerciseMinutes(date);
    case 'water_ml':
      return getWaterIntakeMl(date);
    default:
      console.warn(`[HealthKit] Unknown metric: ${metric}`);
      return 0;
  }
}

async function getExerciseMinutes(date: Date): Promise<number> {
  const hk = getHealthKit();
  if (!hk || !isInitialized) return 0;

  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  return new Promise<number>((resolve) => {
    hk.getAppleExerciseTime(
      { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      (err: any, results: Array<{ value: number }>) => {
        if (err) {
          console.error('[HealthKit] getAppleExerciseTime error:', err);
          resolve(0);
          return;
        }
        const total = (results ?? []).reduce((sum, r) => sum + (r.value ?? 0), 0);
        resolve(Math.round(total));
      },
    );
  });
}

async function getWaterIntakeMl(date: Date): Promise<number> {
  const hk = getHealthKit();
  if (!hk || !isInitialized) return 0;

  return new Promise<number>((resolve) => {
    hk.getWater(
      { date: date.toISOString(), includeManuallyAdded: true },
      (err: any, results: { value?: number }) => {
        if (err) {
          console.error('[HealthKit] getWater error:', err);
          resolve(0);
          return;
        }
        // react-native-health getWater returns liters.
        const liters = Number(results?.value ?? 0);
        if (!Number.isFinite(liters)) {
          resolve(0);
          return;
        }
        resolve(Math.round(liters * 1000));
      },
    );
  });
}
