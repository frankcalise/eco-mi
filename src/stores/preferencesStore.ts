import { create } from "zustand"

import {
  SETTINGS_COLORBLIND_PATTERNS_ENABLED,
  SETTINGS_HAPTICS_ENABLED,
  SETTINGS_NOTIFY_DAILY,
  SETTINGS_NOTIFY_STREAK,
  SETTINGS_NOTIFY_WINBACK,
  SETTINGS_SOUND_ENABLED,
  SETTINGS_SOUND_VOLUME,
} from "@/config/storageKeys"
import { loadString, saveString } from "@/utils/storage"

type PreferencesState = {
  hapticsEnabled: boolean
  setHapticsEnabled: (value: boolean) => void
  soundEnabled: boolean
  setSoundEnabled: (value: boolean) => void
  volume: number
  setVolume: (value: number) => void
  notifyDaily: boolean
  setNotifyDaily: (value: boolean) => void
  notifyStreak: boolean
  setNotifyStreak: (value: boolean) => void
  notifyWinback: boolean
  setNotifyWinback: (value: boolean) => void
  colorblindPatternsEnabled: boolean
  setColorblindPatternsEnabled: (value: boolean) => void
}

// Defaults to true unless MMKV holds the literal string "false".
function loadBoolPref(key: string): boolean {
  return loadString(key) !== "false"
}

// Defaults to false unless MMKV holds the literal string "true".
function loadBoolPrefFalse(key: string): boolean {
  return loadString(key) === "true"
}

function loadVolume(): number {
  const raw = loadString(SETTINGS_SOUND_VOLUME)
  if (raw == null) return 1.0
  const v = parseFloat(raw)
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1.0
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 1.0
  return Math.max(0, Math.min(1, value))
}

/**
 * Reactive source of truth for user preference flags. Settings screen writes
 * through this store so other parts of the app (e.g. useHaptics, useGameEngine,
 * useAudioTones) re-render immediately when a toggle flips — MMKV-only reads
 * snapshot at mount and miss in-session changes.
 */
export const usePreferencesStore = create<PreferencesState>((set) => ({
  hapticsEnabled: loadBoolPref(SETTINGS_HAPTICS_ENABLED),
  setHapticsEnabled: (value) => {
    saveString(SETTINGS_HAPTICS_ENABLED, value ? "true" : "false")
    set({ hapticsEnabled: value })
  },
  soundEnabled: loadBoolPref(SETTINGS_SOUND_ENABLED),
  setSoundEnabled: (value) => {
    saveString(SETTINGS_SOUND_ENABLED, value ? "true" : "false")
    set({ soundEnabled: value })
  },
  volume: loadVolume(),
  setVolume: (value) => {
    const clamped = clampVolume(value)
    saveString(SETTINGS_SOUND_VOLUME, String(clamped))
    set({ volume: clamped })
  },
  notifyDaily: loadBoolPref(SETTINGS_NOTIFY_DAILY),
  setNotifyDaily: (value) => {
    saveString(SETTINGS_NOTIFY_DAILY, value ? "true" : "false")
    set({ notifyDaily: value })
  },
  notifyStreak: loadBoolPref(SETTINGS_NOTIFY_STREAK),
  setNotifyStreak: (value) => {
    saveString(SETTINGS_NOTIFY_STREAK, value ? "true" : "false")
    set({ notifyStreak: value })
  },
  notifyWinback: loadBoolPref(SETTINGS_NOTIFY_WINBACK),
  setNotifyWinback: (value) => {
    saveString(SETTINGS_NOTIFY_WINBACK, value ? "true" : "false")
    set({ notifyWinback: value })
  },
  colorblindPatternsEnabled: loadBoolPrefFalse(SETTINGS_COLORBLIND_PATTERNS_ENABLED),
  setColorblindPatternsEnabled: (value) => {
    saveString(SETTINGS_COLORBLIND_PATTERNS_ENABLED, value ? "true" : "false")
    set({ colorblindPatternsEnabled: value })
  },
}))
