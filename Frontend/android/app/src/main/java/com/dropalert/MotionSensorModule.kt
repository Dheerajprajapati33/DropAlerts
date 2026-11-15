package com.dropalert

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * React Native bridge exposing hardware motion sensor monitoring,
 * configuration sync across processes, battery exemption, and native fall alert controls.
 */
class MotionSensorModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val fallReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent == null || !reactContext.hasActiveReactInstance()) return
      when (intent.action) {
        MotionSensorHub.ACTION_BROADCAST_FALL_DETECTED -> {
          val map = Arguments.createMap().apply {
            putString("severity", intent.getStringExtra("severity") ?: "High")
            putDouble("impactForce", intent.getDoubleExtra("impactForce", 3.0))
            putDouble("confidence", intent.getDoubleExtra("confidence", 0.95))
            putDouble("timestamp", intent.getLongExtra("timestamp", System.currentTimeMillis()).toDouble())
          }
          try {
            reactContext
              .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
              .emit(MotionSensorHub.EVENT_NATIVE_FALL_DETECTED, map)
          } catch (_: Exception) {}
        }
        MotionSensorHub.ACTION_BROADCAST_FALL_CANCELLED -> {
          try {
            reactContext
              .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
              .emit(MotionSensorHub.EVENT_NATIVE_FALL_CANCELLED, null)
          } catch (_: Exception) {}
        }
      }
    }
  }

  init {
    MotionSensorHub.attachReactContext(reactContext)
    val filter = IntentFilter().apply {
      addAction(MotionSensorHub.ACTION_BROADCAST_FALL_DETECTED)
      addAction(MotionSensorHub.ACTION_BROADCAST_FALL_CANCELLED)
    }
    ContextCompat.registerReceiver(
      reactContext,
      fallReceiver,
      filter,
      ContextCompat.RECEIVER_NOT_EXPORTED
    )
  }

  override fun onCatalystInstanceDestroy() {
    try {
      reactContext.unregisterReceiver(fallReceiver)
    } catch (_: Exception) {}
    super.onCatalystInstanceDestroy()
  }

  override fun getName(): String = "MotionSensorModule"

  @ReactMethod
  fun isAvailable(promise: Promise) {
    val (hasAccel, hasGyro) = MotionSensorHub.checkAvailability(reactContext)
    val result = Arguments.createMap().apply {
      putBoolean("accelerometer", hasAccel)
      putBoolean("gyroscope", hasGyro)
    }
    promise.resolve(result)
  }

  @ReactMethod
  fun isMonitoring(promise: Promise) {
    promise.resolve(DropAlertNativeConfig.isMonitoring(reactContext))
  }

  @ReactMethod
  fun syncConfig(config: ReadableMap, promise: Promise) {
    try {
      val token = if (config.hasKey("authToken") && !config.isNull("authToken")) config.getString("authToken") else null
      val deviceId = if (config.hasKey("deviceId") && !config.isNull("deviceId")) config.getString("deviceId") else null
      val deviceName = if (config.hasKey("deviceName") && !config.isNull("deviceName")) config.getString("deviceName") else null
      val apiBaseUrl = if (config.hasKey("apiBaseUrl") && !config.isNull("apiBaseUrl")) config.getString("apiBaseUrl") else null
      val sensitivity = if (config.hasKey("sensitivity") && !config.isNull("sensitivity")) config.getString("sensitivity") else null
      val isMonitoring = if (config.hasKey("isMonitoring")) config.getBoolean("isMonitoring") else null
      val latitude = if (config.hasKey("latitude")) config.getDouble("latitude") else null
      val longitude = if (config.hasKey("longitude")) config.getDouble("longitude") else null

      DropAlertNativeConfig.saveConfig(
        context = reactContext,
        authToken = token,
        deviceId = deviceId,
        deviceName = deviceName,
        apiBaseUrl = apiBaseUrl,
        sensitivity = sensitivity,
        isMonitoring = isMonitoring,
        latitude = latitude,
        longitude = longitude
      )

      val serviceIntent = Intent(reactContext, FallMonitorService::class.java).apply {
        action = if (isMonitoring == false) FallMonitorService.ACTION_STOP else FallMonitorService.ACTION_UPDATE_CONFIG
        token?.let { putExtra(FallMonitorService.EXTRA_TOKEN, it) }
        sensitivity?.let { putExtra(FallMonitorService.EXTRA_SENSITIVITY, it) }
        deviceId?.let { putExtra(FallMonitorService.EXTRA_DEVICE_ID, it) }
        deviceName?.let { putExtra(FallMonitorService.EXTRA_DEVICE_NAME, it) }
        apiBaseUrl?.let { putExtra(FallMonitorService.EXTRA_API_URL, it) }
        latitude?.let { putExtra(FallMonitorService.EXTRA_LATITUDE, it) }
        longitude?.let { putExtra(FallMonitorService.EXTRA_LONGITUDE, it) }
      }

      if (isMonitoring == false) {
        reactContext.stopService(serviceIntent)
      } else {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          reactContext.startForegroundService(serviceIntent)
        } else {
          reactContext.startService(serviceIntent)
        }
      }

      promise.resolve(true)
    } catch (err: Exception) {
      promise.reject("SYNC_CONFIG_ERROR", err.message, err)
    }
  }

  @ReactMethod
  fun cancelPendingFall(reason: String, promise: Promise) {
    try {
      NativeFallAlertManager.cancelFall(reactContext, reason)
      val cancelIntent = Intent(reactContext, FallMonitorService::class.java).apply {
        action = FallMonitorService.ACTION_CANCEL_FALL
      }
      reactContext.startService(cancelIntent)
      promise.resolve(true)
    } catch (err: Exception) {
      promise.reject("CANCEL_FALL_ERROR", err.message, err)
    }
  }

  @ReactMethod
  fun simulateNativeFall(promise: Promise) {
    try {
      val simIntent = Intent(reactContext, FallMonitorService::class.java).apply {
        action = FallMonitorService.ACTION_SIMULATE_FALL
      }
      reactContext.startService(simIntent)
      promise.resolve(true)
    } catch (err: Exception) {
      promise.reject("SIMULATE_FALL_ERROR", err.message, err)
    }
  }

  @ReactMethod
  fun isBatteryOptimized(promise: Promise) {
    val pm = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
    val isIgnoring = pm?.isIgnoringBatteryOptimizations(reactContext.packageName) ?: true
    promise.resolve(!isIgnoring)
  }

  @ReactMethod
  fun requestBatteryExemption(promise: Promise) {
    try {
      val pm = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
      val pkg = reactContext.packageName
      if (pm != null && !pm.isIgnoringBatteryOptimizations(pkg)) {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
          data = Uri.parse("package:$pkg")
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        reactContext.startActivity(intent)
        promise.resolve(false)
      } else {
        promise.resolve(true)
      }
    } catch (_: Exception) {
      try {
        val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        reactContext.startActivity(intent)
        promise.resolve(false)
      } catch (err: Exception) {
        promise.reject("BATTERY_ERROR", err.message, err)
      }
    }
  }

  @ReactMethod
  fun startMonitoring(intervalMs: Int, promise: Promise) {
    try {
      DropAlertNativeConfig.saveConfig(
        context = reactContext,
        authToken = null,
        deviceId = null,
        deviceName = null,
        apiBaseUrl = null,
        sensitivity = null,
        isMonitoring = true,
        latitude = null,
        longitude = null
      )
      val serviceIntent = Intent(reactContext, FallMonitorService::class.java).apply {
        action = FallMonitorService.ACTION_START
        putExtra(FallMonitorService.EXTRA_INTERVAL_MS, intervalMs)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactContext.startForegroundService(serviceIntent)
      } else {
        reactContext.startService(serviceIntent)
      }
      promise.resolve(true)
    } catch (err: Exception) {
      promise.reject("SENSOR_START_ERROR", err.message, err)
    }
  }

  @ReactMethod
  fun stopMonitoring(promise: Promise) {
    try {
      DropAlertNativeConfig.saveConfig(
        context = reactContext,
        authToken = null,
        deviceId = null,
        deviceName = null,
        apiBaseUrl = null,
        sensitivity = null,
        isMonitoring = false,
        latitude = null,
        longitude = null
      )
      val stopIntent = Intent(reactContext, FallMonitorService::class.java).apply {
        action = FallMonitorService.ACTION_STOP
      }
      reactContext.stopService(stopIntent)
      promise.resolve(true)
    } catch (err: Exception) {
      promise.reject("SENSOR_STOP_ERROR", err.message, err)
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for RN NativeEventEmitter contract
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required for RN NativeEventEmitter contract
  }
}
