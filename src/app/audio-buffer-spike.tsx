/**
 * Dev-only spike: seamless looped sine (buffer + AudioBufferSourceNode) with
 * gain attack / release — no useAudioTones. Open from the Expo dev menu
 * ("Audio buffer spike"). Tree-shaking: only the dev-menu registration in
 * _layout.tsx is __DEV__; this file still ships like haptics-lab until you
 * gate the route.
 *
 * Ear-test on speaker / wired: hold the pad, release — compare pops to the
 * main game pad path when you port buffer pooling into useAudioTones.
 */
import { useEffect, useLayoutEffect, useRef } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { useNavigation } from "expo-router"
import { AudioContext, GainNode } from "react-native-audio-api"
import type { AudioBuffer, AudioBufferSourceNode } from "react-native-audio-api"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { stackHeaderOptionsFromTheme } from "@/navigation/secondaryStackHeader"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { useTheme } from "@/hooks/useTheme"
/** Hann attack (iOS + Android warm); longer Hann on Android “cold” only (see below). */
const ATTACK_S = 0.02
const ATTACK_S_ANDROID_COLD = 0.03
const RELEASE_S = 0.2
const TARGET_GAIN = 0.25
/**
 * AAudio: first block after *silence* needs more clock cushion; a long lookahead
 * on every `pressIn` is bad for rapid taps (each new voice cancels a scheduled
 * `start(t+80ms)` on the old one, which stacks retrigger + entry glitches).
 * So: cold (long gap since last `pressIn`) = generous lookahead; warm (bursts) = short.
 * iOS: single lookahead — already fine per device testing.
 */
const ATTACK_LOOKAHEAD_IOS_S = 0.04
const ATTACK_LOOKAHEAD_ANDROID_COLD_S = 0.1
const ATTACK_LOOKAHEAD_ANDROID_WARM_S = 0.012
/** Wall ms: treat as “burst” if the next down-stroke is sooner than this after the previous. */
const ANDROID_WARM_ENTRY_WINDOW_MS = 280
/** `setValueCurve` resolution — Hann window has zero derivative at start/end. */
const ENVELOPE_CURVE_POINTS = 256
/** Wall-clock delay after the curve (native graph may still be finishing blocks). */
const POST_RELEASE_DISCONNECT_MS = 120
const ORPHAN_STOP_MS = 400
const RETRIGGER_RELEASE_S = 0.01
const RETRIGGER_DISCONNECT_MS = Math.ceil(RETRIGGER_RELEASE_S * 1000) + 80
/** Slightly faster graph teardown on Android when retriggers stack (wall ms before disconnect). */
const RETRIGGER_DISCONNECT_MS_ANDROID = 48
/** Single-pad spike: same frequency as red in the default color map. */
const SPIKE_FREQ_HZ = 220

/**
 * Smallest buffer where `length * freq / sampleRate` is a whole number of
 * cycles, so looping the buffer is phase-continuous for a sine.
 */
function computeSeamlessSineLoopLength(sampleRate: number, freq: number): number {
  const maxCycles = 5000
  for (let cycles = 1; cycles < maxCycles; cycles++) {
    const length = (cycles * sampleRate) / freq
    if (Number.isInteger(length) && length > 1) {
      return length
    }
  }
  return Math.max(2, Math.round(sampleRate / freq))
}

function createLoopingSineBuffer(ctx: AudioContext, freq: number): AudioBuffer {
  const sr = ctx.sampleRate
  const length = computeSeamlessSineLoopLength(sr, freq)
  const numCycles = (length * freq) / sr
  const buffer = ctx.createBuffer(1, length, sr)
  const ch = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    ch[i] = Math.sin((2 * Math.PI * numCycles * i) / length)
  }
  return buffer
}

/**
 * Full fade from current held value to silence using a half Hann window; first/last
 * slope is 0, which avoids a release edge when disconnecting the node.
 *
 * Stops in-flight `setValueCurve` (attack, prior release) without inserting another
 * event at the same time: do **not** use `setValue` right after `cancelScheduledValues(0)` —
 * it still lies inside the old curve’s time range in implementations that resolve
 * cancellation asynchronously, and you get `NotSupportedError: SetValue... conflicts
 * with existing curve`. `cancelAndHoldAtTime` is the spec-correct “exit curve at t”.
 */
function scheduleHannRelease(g: GainNode, atTime: number, durationS: number) {
  g.gain.cancelAndHoldAtTime(atTime)
  const v0 = g.gain.value
  if (v0 < 0.0001) {
    return
  }
  const n = ENVELOPE_CURVE_POINTS
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1)
    const w = 0.5 * (1 + Math.cos(Math.PI * t))
    curve[i] = v0 * w
  }
  g.gain.setValueCurveAtTime(curve, atTime, durationS)
}

/**
 * Rising half Hann: 0 → pe with zero derivative at t=0 and t=duration, so
 * the start of a new note after silence does not fire the buffer + linear
 * ramp edge case that is harsh on Android.
 */
function scheduleHannAttack(g: GainNode, atTime: number, peak: number, durationS: number) {
  const n = ENVELOPE_CURVE_POINTS
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1)
    const w = 0.5 * (1 - Math.cos(Math.PI * t))
    curve[i] = peak * w
  }
  g.gain.setValueCurveAtTime(curve, atTime, durationS)
}

export default function AudioBufferSpikeScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { activeTheme } = useTheme()
  const soundEnabled = usePreferencesStore((s) => s.soundEnabled)
  const volume = usePreferencesStore((s) => s.volume)

  const ctxRef = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)
  const voiceRef = useRef<{
    source: AudioBufferSourceNode
    gain: GainNode
  } | null>(null)
  /** Stops the looping source *after* the release ramp has time to hit 0 in the render thread. */
  const releaseStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPressInWallMsRef = useRef(0)

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: "Audio buffer spike",
      ...stackHeaderOptionsFromTheme(activeTheme),
    })
  }, [activeTheme, navigation])

  useEffect(() => {
    const ctx = new AudioContext()
    ctxRef.current = ctx
    const master = ctx.createGain()
    master.gain.setValueAtTime(usePreferencesStore.getState().volume, ctx.currentTime)
    master.connect(ctx.destination)
    masterRef.current = master
    bufferRef.current = createLoopingSineBuffer(ctx, SPIKE_FREQ_HZ)
    void ctx.resume?.()

    return () => {
      if (releaseStopTimeoutRef.current) {
        clearTimeout(releaseStopTimeoutRef.current)
        releaseStopTimeoutRef.current = null
      }
      if (voiceRef.current) {
        try {
          voiceRef.current.source.stop()
        } catch {
          // Source may have ended.
        }
        try {
          voiceRef.current.source.disconnect()
        } catch {}
        try {
          voiceRef.current.gain.disconnect()
        } catch {}
        voiceRef.current = null
      }
      bufferRef.current = null
      masterRef.current = null
      if (ctxRef.current) {
        void ctxRef.current.close()
        ctxRef.current = null
      }
    }
  }, [])

  // Keep master in sync with Settings volume while screen is open.
  useEffect(() => {
    const ctx = ctxRef.current
    const master = masterRef.current
    if (ctx && master) {
      master.gain.setValueAtTime(volume, ctx.currentTime)
    }
  }, [volume])

  function pressIn() {
    if (!soundEnabled) return
    const ctx = ctxRef.current
    const master = masterRef.current
    const buffer = bufferRef.current
    if (!ctx || !master || !buffer) return
    void ctx.resume?.()

    if (releaseStopTimeoutRef.current) {
      clearTimeout(releaseStopTimeoutRef.current)
      releaseStopTimeoutRef.current = null
    }
    if (voiceRef.current) {
      const old = voiceRef.current
      const t = ctx.currentTime
      const s = old.source
      const g = old.gain
      scheduleHannRelease(g, t, RETRIGGER_RELEASE_S)
      const disconnectAfterMs =
        Platform.OS === "android" ? RETRIGGER_DISCONNECT_MS_ANDROID : RETRIGGER_DISCONNECT_MS
      setTimeout(
        () => {
          try {
            g.disconnect()
          } catch {}
          try {
            s.disconnect()
          } catch {}
          setTimeout(() => {
            try {
              s.stop()
            } catch {}
          }, ORPHAN_STOP_MS)
        },
        disconnectAfterMs,
      )
      voiceRef.current = null
    }

    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    /* Default AudioParam is 1; pin silent before the graph is scheduled. */
    gain.gain.setValueAtTime(0, ctx.currentTime)
    source.buffer = buffer
    source.loop = true
    source.connect(gain)
    gain.connect(master)

    const now = ctx.currentTime
    const wall = Date.now()
    const isAndroidWarm =
      Platform.OS === "android" &&
      lastPressInWallMsRef.current > 0 &&
      wall - lastPressInWallMsRef.current < ANDROID_WARM_ENTRY_WINDOW_MS
    const attackLookaheadS =
      Platform.OS === "android"
        ? isAndroidWarm
          ? ATTACK_LOOKAHEAD_ANDROID_WARM_S
          : ATTACK_LOOKAHEAD_ANDROID_COLD_S
        : ATTACK_LOOKAHEAD_IOS_S
    const attackDurationS =
      Platform.OS === "android" && !isAndroidWarm ? ATTACK_S_ANDROID_COLD : ATTACK_S
    const tStart = now + attackLookaheadS
    scheduleHannAttack(gain, tStart, TARGET_GAIN, attackDurationS)
    source.start(tStart)

    lastPressInWallMsRef.current = wall
    voiceRef.current = { source, gain }
  }

  function pressOut() {
    const ctx = ctxRef.current
    const voice = voiceRef.current
    if (!ctx || !voice) return

    if (releaseStopTimeoutRef.current) {
      clearTimeout(releaseStopTimeoutRef.current)
      releaseStopTimeoutRef.current = null
    }

    const now = ctx.currentTime
    const { source: src, gain: g } = voice
    scheduleHannRelease(g, now, RELEASE_S)

    // Do not `stop` the source here: native AUGraph/AAudio in react-native-audio-api
    // can click when a looping `AudioBufferSource` is stopped, even with gain=0.
    // Break the path to the destination, then `stop` later so the source does not
    // run unbounded in the void.
    const postRampMs = RELEASE_S * 1000 + POST_RELEASE_DISCONNECT_MS
    releaseStopTimeoutRef.current = setTimeout(() => {
      releaseStopTimeoutRef.current = null
      if (voiceRef.current?.source !== src) return
      try {
        g.disconnect()
      } catch {}
      try {
        src.disconnect()
      } catch {}
      if (voiceRef.current?.source === src) {
        voiceRef.current = null
      }
      setTimeout(() => {
        try {
          src.stop()
        } catch {}
      }, ORPHAN_STOP_MS)
    }, postRampMs)
  }

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: activeTheme.backgroundColor, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Text style={[styles.body, { color: activeTheme.secondaryTextColor }]}>
        Hold the pad — looped {SPIKE_FREQ_HZ} Hz sine in an{" "}
        <Text style={styles.mono}>AudioBuffer</Text>. Android: cold entry (≥ {ANDROID_WARM_ENTRY_WINDOW_MS}
        ms since last &ldquo;press in&rdquo;) = {(ATTACK_LOOKAHEAD_ANDROID_COLD_S * 1000).toFixed(0)} ms
        lookahead + {ATTACK_S_ANDROID_COLD * 1000} ms Hann; warm bursts ={" "}
        {(ATTACK_LOOKAHEAD_ANDROID_WARM_S * 1000).toFixed(0)} ms lookahead + {ATTACK_S * 1000} ms Hann.
        iOS: {(ATTACK_LOOKAHEAD_IOS_S * 1000).toFixed(0)} ms + {ATTACK_S * 1000} ms. Release:{" "}
        {RELEASE_S * 1000} ms; teardown: <Text style={styles.mono}>disconnect</Text> then late{" "}
        <Text style={styles.mono}>stop</Text>. Does not use <Text style={styles.mono}>useAudioTones</Text>.
        Mute: Settings.
      </Text>

      <Text style={[styles.hint, { color: activeTheme.textColor }]}>
        {soundEnabled ? "Sound on" : "Sound muted (Settings) — no output"}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hold to play buffer spike"
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={({ pressed }) => [
          styles.pad,
          {
            borderColor: activeTheme.borderColor,
            backgroundColor: pressed ? "#b91c1c" : "#dc2626",
            opacity: soundEnabled ? 1 : 0.45,
          },
        ]}
      >
        <Text style={styles.padLabel}>Hold (red tone)</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  mono: {
    fontFamily: "Menlo",
    fontSize: 13,
  },
  hint: {
    fontSize: 14,
    marginBottom: 20,
  },
  pad: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 2,
    height: 120,
    justifyContent: "center",
    maxWidth: 280,
  },
  padLabel: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
})
