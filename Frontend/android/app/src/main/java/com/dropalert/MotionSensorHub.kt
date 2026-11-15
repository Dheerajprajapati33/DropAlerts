package com.dropalert

import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.HandlerThread
import android.os.Process
import android.os.SystemClock
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.lang.ref.WeakReference

/**
 * Shared hardware motion sensor hub running on a dedicated background HandlerThread,
 * feeding the 5-Stage NativeFallDetector in background, and emitting throttled 50Hz
 * samples to React Native when the JS engine is active.
 */
object MotionSensorHub : SensorEventListener {
  const val EVENT_NAME = "MotionSensorData"
  const val EVENT_NATIVE_FALL_DETECTED = "NativeFallDetected"
  const val EVENT_NATIVE_FALL_CANCELLED = "NativeFallCancelled"

  const val ACTION_BROADCAST_FALL_DETECTED = "com.dropalert.NATIVE_FALL_DETECTED"
  const val ACTION_BROADCAST_FALL_CANCELLED = "com.dropalert.NATIVE_FALL_CANCELLED"

  private var sensorManager: SensorManager? = null
  private var accelerometer: Sensor? = null
  private var gyroscope: Sensor? = null
  private var reactContextRef: WeakReference<ReactApplicationContext>? = null
  private var appContextRef: WeakReference<Context>? = null

  private var sensorThread: HandlerThread? = null
  private var sensorHandler: Handler? = null

  @Volatile
  var isRunning: Boolean = false
    private set

  private var intervalMs: Long = 20L
  private var lastEmitUptimeMs: Long = 0L

  private var lastAx = 0.0
  private var lastAy = 0.0
  private var lastAz = 9.80665

  private var lastGx = 0.0
  private var lastGy = 0.0
  private var lastGz = 0.0

  private val nativeDetector = NativeFallDetector { result ->
    handleFallDetected(result)
  }

  fun attachReactContext(context: ReactApplicationContext) {
    reactContextRef = WeakReference(context)
    appContextRef = WeakReference(context.applicationContext)
  }

  fun checkAvailability(context: Context): Pair<Boolean, Boolean> {
    val manager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    val hasAccel = manager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null
    val hasGyro = manager?.getDefaultSensor(Sensor.TYPE_GYROSCOPE) != null
    return Pair(hasAccel, hasGyro)
  }

  fun updateSensitivity(sensitivity: String) {
    nativeDetector.setSensitivity(sensitivity)
  }

  @Synchronized
  fun start(context: Context, requestedIntervalMs: Int = 20): Boolean {
    appContextRef = WeakReference(context.applicationContext)
    intervalMs = requestedIntervalMs.coerceIn(10, 200).toLong()

    val currentSensitivity = DropAlertNativeConfig.getSensitivity(context)
    nativeDetector.setSensitivity(currentSensitivity)
    nativeDetector.reset()

    val manager = context.applicationContext.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
      ?: return false

    sensorManager = manager
    accelerometer = manager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    gyroscope = manager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)

    if (accelerometer == null) {
      return false
    }

    if (isRunning) {
      return true
    }

    // Start dedicated background HandlerThread so sensor events run independently of the UI main looper
    if (sensorThread == null) {
      sensorThread = HandlerThread("DropAlertSensorThread", Process.THREAD_PRIORITY_MORE_FAVORABLE).apply {
        start()
      }
      sensorHandler = Handler(sensorThread!!.looper)
    }

    val samplingPeriodUs = (intervalMs * 1000L).toInt()
    manager.registerListener(this, accelerometer, samplingPeriodUs, sensorHandler)
    gyroscope?.let { gyro ->
      manager.registerListener(this, gyro, samplingPeriodUs, sensorHandler)
    }

    lastEmitUptimeMs = 0L
    isRunning = true
    return true
  }

  @Synchronized
  fun stop() {
    if (!isRunning) return
    try {
      sensorManager?.unregisterListener(this)
    } catch (_: Exception) {
      // Ignore cleanup errors
    }
    sensorThread?.quitSafely()
    sensorThread = null
    sensorHandler = null
    nativeDetector.reset()
    isRunning = false
  }

  override fun onSensorChanged(event: SensorEvent?) {
    if (event == null || !isRunning) return

    when (event.sensor.type) {
      Sensor.TYPE_GYROSCOPE -> {
        lastGx = event.values[0].toDouble()
        lastGy = event.values[1].toDouble()
        lastGz = event.values[2].toDouble()
      }
      Sensor.TYPE_ACCELEROMETER -> {
        lastAx = event.values[0].toDouble()
        lastAy = event.values[1].toDouble()
        lastAz = event.values[2].toDouble()

        val nowMs = System.currentTimeMillis()
        val hasGyro = gyroscope != null

        // Feed native 5-stage detector in background
        nativeDetector.processSample(
          ax = lastAx,
          ay = lastAy,
          az = lastAz,
          gx = lastGx,
          gy = lastGy,
          gz = lastGz,
          hasGyroscope = hasGyro,
          timestamp = nowMs
        )

        // Throttle React Native JS emissions to ~50Hz
        val nowUptime = SystemClock.elapsedRealtime()
        if (nowUptime - lastEmitUptimeMs < intervalMs) {
          return
        }
        lastEmitUptimeMs = nowUptime
        emitSample()
      }
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
    // No-op
  }

  private fun handleFallDetected(result: NativeFallResult) {
    val ctx = appContextRef?.get() ?: return
    NativeFallAlertManager.onFallConfirmed(ctx, result)

    // Broadcast across processes so UI receives it even if in different process
    val broadcastIntent = Intent(ACTION_BROADCAST_FALL_DETECTED).apply {
      setPackage(ctx.packageName)
      putExtra("severity", result.severity)
      putExtra("impactForce", result.impactForce)
      putExtra("confidence", result.confidence)
      putExtra("timestamp", result.timestamp)
    }
    ctx.sendBroadcast(broadcastIntent)

    // Also notify direct reactContext if attached
    val reactContext = reactContextRef?.get() ?: return
    if (!reactContext.hasActiveReactInstance()) return

    val map = Arguments.createMap().apply {
      putString("severity", result.severity)
      putDouble("impactForce", result.impactForce)
      putDouble("confidence", result.confidence)
      putDouble("timestamp", result.timestamp.toDouble())
    }

    try {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT_NATIVE_FALL_DETECTED, map)
    } catch (_: Exception) {
      // Ignore JS bridge teardown
    }
  }

  fun notifyJsFallCancelled(context: Context? = null) {
    val ctx = context ?: appContextRef?.get()
    if (ctx != null) {
      val broadcastIntent = Intent(ACTION_BROADCAST_FALL_CANCELLED).apply {
        setPackage(ctx.packageName)
      }
      ctx.sendBroadcast(broadcastIntent)
    }

    val reactContext = reactContextRef?.get() ?: return
    if (!reactContext.hasActiveReactInstance()) return

    try {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT_NATIVE_FALL_CANCELLED, null)
    } catch (_: Exception) {
      // Ignore
    }
  }

  fun simulateNativeFall(context: Context) {
    val simulated = NativeFallResult(
      severity = "High",
      impactForce = 3.85,
      confidence = 0.94,
      freeFallDurationMs = 120L,
      peakRotationRad = 2.4,
      postImpactStillnessMs = 1800L,
      accelX = 16.0,
      accelY = 14.5,
      accelZ = 29.8,
      accelMag = 37.0,
      gyroX = 3.8,
      gyroY = 2.9,
      gyroZ = 1.5,
      gyroMag = 5.0,
      timestamp = System.currentTimeMillis()
    )
    handleFallDetected(simulated)
  }

  private fun emitSample() {
    val reactContext = reactContextRef?.get() ?: return
    if (!reactContext.hasActiveReactInstance()) return

    val payload = Arguments.createMap().apply {
      putDouble("ax", lastAx)
      putDouble("ay", lastAy)
      putDouble("az", lastAz)
      putDouble("gx", lastGx)
      putDouble("gy", lastGy)
      putDouble("gz", lastGz)
      putBoolean("hasGyroscope", gyroscope != null)
      putDouble("timestamp", System.currentTimeMillis().toDouble())
    }

    try {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT_NAME, payload)
    } catch (_: Exception) {
      // Ignore if JS catalyst instance is tearing down
    }
  }
}
