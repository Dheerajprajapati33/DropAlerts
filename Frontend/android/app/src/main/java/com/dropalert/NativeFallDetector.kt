package com.dropalert

import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt

enum class NativeFallStage {
  NORMAL,
  FREE_FALL,
  IMPACT,
  CONFIRMATION,
  ALERT
}

data class NativeSensitivityProfile(
  val freeFallThresholdG: Double,
  val minFreeFallMs: Long,
  val freeFallTimeoutMs: Long,
  val impactThresholdG: Double,
  val gyroThresholdRad: Double,
  val impactWindowMs: Long,
  val stillnessDurationMs: Long,
  val cooldownMs: Long
)

data class NativeFallResult(
  val severity: String,
  val impactForce: Double,
  val confidence: Double,
  val freeFallDurationMs: Long,
  val peakRotationRad: Double,
  val postImpactStillnessMs: Long,
  val accelX: Double,
  val accelY: Double,
  val accelZ: Double,
  val accelMag: Double,
  val gyroX: Double,
  val gyroY: Double,
  val gyroZ: Double,
  val gyroMag: Double,
  val timestamp: Long
)

/**
 * 5-Stage Native Fall Detection Engine executing entirely in background Kotlin code.
 * Replicates the state machine:
 * 1. NORMAL       -> Baseline monitoring (~1.0G)
 * 2. FREE_FALL    -> Low G (< 0.5G) for 60-100ms
 * 3. IMPACT       -> G-Force spike (>= 2.8G) + Gyroscope rotation (>= 2.0 rad/s)
 * 4. CONFIRMATION -> 1.5-2.0s stillness validation (resets if phone picked up)
 * 5. ALERT        -> Confirmed fall event
 */
class NativeFallDetector(
  private var sensitivity: String = "Medium",
  private val onFallDetected: (NativeFallResult) -> Unit
) {
  companion object {
    private const val GRAVITY_MS2 = 9.80665

    private val PROFILES = mapOf(
      "High" to NativeSensitivityProfile(
        freeFallThresholdG = 0.55,
        minFreeFallMs = 60L,
        freeFallTimeoutMs = 900L,
        impactThresholdG = 2.2,
        gyroThresholdRad = 1.6,
        impactWindowMs = 300L,
        stillnessDurationMs = 1500L,
        cooldownMs = 10000L
      ),
      "Medium" to NativeSensitivityProfile(
        freeFallThresholdG = 0.5,
        minFreeFallMs = 80L,
        freeFallTimeoutMs = 900L,
        impactThresholdG = 2.8,
        gyroThresholdRad = 2.0,
        impactWindowMs = 300L,
        stillnessDurationMs = 1800L,
        cooldownMs = 10000L
      ),
      "Low" to NativeSensitivityProfile(
        freeFallThresholdG = 0.45,
        minFreeFallMs = 100L,
        freeFallTimeoutMs = 900L,
        impactThresholdG = 3.5,
        gyroThresholdRad = 2.5,
        impactWindowMs = 300L,
        stillnessDurationMs = 2000L,
        cooldownMs = 10000L
      )
    )

    fun deriveSeverity(gForce: Double): String = when {
      gForce >= 4.5 -> "Critical"
      gForce >= 3.2 -> "High"
      gForce >= 2.5 -> "Medium"
      else -> "Low"
    }
  }

  private var stage: NativeFallStage = NativeFallStage.NORMAL

  private var freeFallCandidateStartMs: Long? = null
  private var freeFallConfirmedMs: Long? = null
  private var freeFallDurationMs: Long = 0L

  private var impactStartMs: Long = 0L
  private var peakImpactG: Double = 0.0
  private var peakRotationRad: Double = 0.0

  private var peakAx: Double = 0.0
  private var peakAy: Double = 0.0
  private var peakAz: Double = 9.80665
  private var peakGx: Double = 0.0
  private var peakGy: Double = 0.0
  private var peakGz: Double = 0.0

  private var confirmationStartMs: Long = 0L
  private val stillnessGValues = ArrayList<Double>()
  private val stillnessGyroValues = ArrayList<Double>()
  private var activeMovementSamples: Int = 0

  private var cooldownUntilMs: Long = 0L

  fun setSensitivity(sens: String) {
    if (PROFILES.containsKey(sens)) {
      sensitivity = sens
    }
  }

  fun reset() {
    stage = NativeFallStage.NORMAL
    freeFallCandidateStartMs = null
    freeFallConfirmedMs = null
    freeFallDurationMs = 0L
    impactStartMs = 0L
    peakImpactG = 0.0
    peakRotationRad = 0.0
    confirmationStartMs = 0L
    stillnessGValues.clear()
    stillnessGyroValues.clear()
    activeMovementSamples = 0
  }

  fun processSample(
    ax: Double,
    ay: Double,
    az: Double,
    gx: Double,
    gy: Double,
    gz: Double,
    hasGyroscope: Boolean,
    timestamp: Long
  ) {
    val profile = PROFILES[sensitivity] ?: PROFILES["Medium"]!!

    if (stage == NativeFallStage.ALERT) {
      if (timestamp >= cooldownUntilMs) {
        reset()
      }
      return
    }

    if (timestamp < cooldownUntilMs) {
      return
    }

    val accelMag = sqrt(ax * ax + ay * ay + az * az)
    val gForce = accelMag / GRAVITY_MS2
    val gyroMag = sqrt(gx * gx + gy * gy + gz * gz)

    when (stage) {
      NativeFallStage.NORMAL -> {
        if (gForce <= profile.freeFallThresholdG) {
          if (freeFallCandidateStartMs == null) {
            freeFallCandidateStartMs = timestamp
            peakRotationRad = gyroMag
          } else {
            peakRotationRad = max(peakRotationRad, gyroMag)
            if (timestamp - freeFallCandidateStartMs!! >= profile.minFreeFallMs) {
              freeFallConfirmedMs = freeFallCandidateStartMs
              freeFallDurationMs = timestamp - freeFallCandidateStartMs!!
              stage = NativeFallStage.FREE_FALL
            }
          }
        } else {
          freeFallCandidateStartMs = null
          peakRotationRad = 0.0
        }
      }

      NativeFallStage.FREE_FALL -> {
        peakRotationRad = max(peakRotationRad, gyroMag)
        val candidate = freeFallConfirmedMs
        if (gForce <= profile.freeFallThresholdG && candidate != null) {
          freeFallDurationMs = timestamp - candidate
        }

        val elapsed = if (candidate != null) timestamp - candidate else 0L
        if (elapsed > profile.freeFallTimeoutMs) {
          reset()
          return
        }

        if (gForce >= profile.impactThresholdG) {
          val gyroVerified = !hasGyroscope || peakRotationRad >= profile.gyroThresholdRad
          if (!gyroVerified) {
            return
          }

          impactStartMs = timestamp
          peakImpactG = gForce
          peakAx = ax
          peakAy = ay
          peakAz = az
          peakGx = gx
          peakGy = gy
          peakGz = gz
          stage = NativeFallStage.IMPACT
        }
      }

      NativeFallStage.IMPACT -> {
        peakRotationRad = max(peakRotationRad, gyroMag)
        if (gForce > peakImpactG) {
          peakImpactG = gForce
          peakAx = ax
          peakAy = ay
          peakAz = az
          peakGx = gx
          peakGy = gy
          peakGz = gz
        }

        if (timestamp - impactStartMs >= profile.impactWindowMs) {
          confirmationStartMs = timestamp
          stillnessGValues.clear()
          stillnessGyroValues.clear()
          activeMovementSamples = 0
          stage = NativeFallStage.CONFIRMATION
        }
      }

      NativeFallStage.CONFIRMATION -> {
        val elapsed = timestamp - confirmationStartMs
        stillnessGValues.add(gForce)
        stillnessGyroValues.add(gyroMag)

        val isMovingActively = gForce > 1.55 || gForce < 0.65 || (hasGyroscope && gyroMag > 2.5)
        if (isMovingActively) {
          activeMovementSamples++
          if (activeMovementSamples >= 8) {
            reset()
            return
          }
        }

        if (elapsed < profile.stillnessDurationMs) {
          return
        }

        if (stillnessGValues.size < 5) {
          reset()
          return
        }

        val meanG = stillnessGValues.sum() / stillnessGValues.size
        val varianceG = stillnessGValues.map { (it - meanG).pow(2) }.sum() / stillnessGValues.size
        val stdDevG = sqrt(varianceG)
        val meanGyro = stillnessGyroValues.sum() / stillnessGyroValues.size

        val isStationary = meanG in 0.72..1.28 && stdDevG <= 0.25 && (!hasGyroscope || meanGyro <= 1.1)

        if (!isStationary) {
          reset()
          return
        }

        val roundedImpactG = (peakImpactG * 100).toLong() / 100.0
        val roundedRotation = (peakRotationRad * 100).toLong() / 100.0
        val gMargin = max(0.0, roundedImpactG - profile.impactThresholdG)
        val confidence = min(0.99, 0.78 + gMargin * 0.08 + if (hasGyroscope) 0.06 else 0.0)

        val result = NativeFallResult(
          severity = deriveSeverity(roundedImpactG),
          impactForce = roundedImpactG,
          confidence = (confidence * 100).toLong() / 100.0,
          freeFallDurationMs = freeFallDurationMs,
          peakRotationRad = roundedRotation,
          postImpactStillnessMs = elapsed,
          accelX = (peakAx * 1000).toLong() / 1000.0,
          accelY = (peakAy * 1000).toLong() / 1000.0,
          accelZ = (peakAz * 1000).toLong() / 1000.0,
          accelMag = sqrt(peakAx * peakAx + peakAy * peakAy + peakAz * peakAz),
          gyroX = (peakGx * 1000).toLong() / 1000.0,
          gyroY = (peakGy * 1000).toLong() / 1000.0,
          gyroZ = (peakGz * 1000).toLong() / 1000.0,
          gyroMag = sqrt(peakGx * peakGx + peakGy * peakGy + peakGz * peakGz),
          timestamp = timestamp
        )

        cooldownUntilMs = timestamp + profile.cooldownMs
        stage = NativeFallStage.ALERT
        onFallDetected(result)
      }

      NativeFallStage.ALERT -> {
        // Cooldown handled above
      }
    }
  }
}
