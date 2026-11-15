package com.dropalert

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Native Android Geolocation module providing real hardware GPS and Network-assisted location.
 * Directly integrates with DropAlertNativeConfig so background fall services always have real coords.
 */
class LocationModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var activeWatcherListener: LocationListener? = null
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun getName(): String = "LocationModule"

  private fun hasLocationPermission(): Boolean {
    val fine = ContextCompat.checkSelfPermission(
      reactContext,
      Manifest.permission.ACCESS_FINE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
    val coarse = ContextCompat.checkSelfPermission(
      reactContext,
      Manifest.permission.ACCESS_COARSE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
    return fine || coarse
  }

  private fun getLocationManager(): LocationManager? =
    reactContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager

  private fun locationToMap(location: Location): WritableMap =
    Arguments.createMap().apply {
      putDouble("latitude", location.latitude)
      putDouble("longitude", location.longitude)
      putDouble("accuracy", location.accuracy.toDouble())
      putDouble("altitude", location.altitude)
      putDouble("speed", location.speed.toDouble())
      putDouble("timestamp", location.time.toDouble())
    }

  private fun getBestLastKnownLocation(manager: LocationManager): Location? {
    if (!hasLocationPermission()) return null
    var bestLocation: Location? = null
    val providers = listOf(
      LocationManager.GPS_PROVIDER,
      LocationManager.NETWORK_PROVIDER,
      LocationManager.PASSIVE_PROVIDER
    )
    for (provider in providers) {
      try {
        if (!manager.isProviderEnabled(provider)) continue
        val loc = manager.getLastKnownLocation(provider) ?: continue
        if (bestLocation == null ||
            loc.accuracy < bestLocation.accuracy ||
            (loc.time > bestLocation.time && loc.accuracy <= bestLocation.accuracy * 1.5)) {
          bestLocation = loc
        }
      } catch (_: SecurityException) {
      } catch (_: Exception) {
      }
    }
    return bestLocation
  }

  @ReactMethod
  fun isLocationEnabled(promise: Promise) {
    val manager = getLocationManager()
    if (manager == null) {
      promise.resolve(false)
      return
    }
    val gps = try { manager.isProviderEnabled(LocationManager.GPS_PROVIDER) } catch (_: Exception) { false }
    val network = try { manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) } catch (_: Exception) { false }
    promise.resolve(gps || network)
  }

  @ReactMethod
  fun openLocationSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      }
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (err: Exception) {
      promise.reject("OPEN_SETTINGS_ERROR", err.message, err)
    }
  }

  @ReactMethod
  fun getLastKnownLocation(promise: Promise) {
    if (!hasLocationPermission()) {
      promise.reject("PERMISSION_DENIED", "Location permission is not granted.")
      return
    }
    val manager = getLocationManager()
    if (manager == null) {
      promise.reject("NO_LOCATION_SERVICE", "Location service unavailable.")
      return
    }
    val loc = getBestLastKnownLocation(manager)
    if (loc != null) {
      promise.resolve(locationToMap(loc))
    } else {
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun getCurrentLocation(options: ReadableMap?, promise: Promise) {
    if (!hasLocationPermission()) {
      promise.reject("PERMISSION_DENIED", "Location permission is not granted.")
      return
    }

    val manager = getLocationManager()
    if (manager == null) {
      promise.reject("NO_LOCATION_SERVICE", "Location service unavailable.")
      return
    }

    val timeoutMs = if (options != null && options.hasKey("timeout")) options.getInt("timeout").toLong() else 12000L
    val maxAgeMs = if (options != null && options.hasKey("maximumAge")) options.getInt("maximumAge").toLong() else 15000L

    val lastKnown = getBestLastKnownLocation(manager)
    if (lastKnown != null && (System.currentTimeMillis() - lastKnown.time) <= maxAgeMs) {
      DropAlertNativeConfig.saveConfig(
        context = reactContext,
        authToken = null,
        deviceId = null,
        deviceName = null,
        apiBaseUrl = null,
        sensitivity = null,
        isMonitoring = null,
        latitude = lastKnown.latitude,
        longitude = lastKnown.longitude
      )
      promise.resolve(locationToMap(lastKnown))
      return
    }

    val gpsEnabled = try { manager.isProviderEnabled(LocationManager.GPS_PROVIDER) } catch (_: Exception) { false }
    val networkEnabled = try { manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) } catch (_: Exception) { false }

    if (!gpsEnabled && !networkEnabled) {
      if (lastKnown != null) {
        promise.resolve(locationToMap(lastKnown))
      } else {
        promise.reject("LOCATION_DISABLED", "Device location is turned off. Please turn on GPS.")
      }
      return
    }

    mainHandler.post {
      val isResolved = AtomicBoolean(false)
      var timeoutRunnable: Runnable? = null

      val singleListener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
          if (isResolved.compareAndSet(false, true)) {
            timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
            try {
              manager.removeUpdates(this)
            } catch (_: Exception) {}

            DropAlertNativeConfig.saveConfig(
              context = reactContext,
              authToken = null,
              deviceId = null,
              deviceName = null,
              apiBaseUrl = null,
              sensitivity = null,
              isMonitoring = null,
              latitude = location.latitude,
              longitude = location.longitude
            )
            promise.resolve(locationToMap(location))
          }
        }

        @Deprecated("Deprecated in Java")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
      }

      timeoutRunnable = Runnable {
        if (isResolved.compareAndSet(false, true)) {
          try {
            manager.removeUpdates(singleListener)
          } catch (_: Exception) {}

          val fallback = getBestLastKnownLocation(manager)
          if (fallback != null) {
            promise.resolve(locationToMap(fallback))
          } else {
            promise.reject("TIMEOUT", "Location request timed out. Please ensure GPS has satellite reception.")
          }
        }
      }

      mainHandler.postDelayed(timeoutRunnable, timeoutMs)

      try {
        if (gpsEnabled) {
          manager.requestLocationUpdates(
            LocationManager.GPS_PROVIDER,
            0L,
            0f,
            singleListener,
            Looper.getMainLooper()
          )
        }
        if (networkEnabled) {
          manager.requestLocationUpdates(
            LocationManager.NETWORK_PROVIDER,
            0L,
            0f,
            singleListener,
            Looper.getMainLooper()
          )
        }
      } catch (err: SecurityException) {
        if (isResolved.compareAndSet(false, true)) {
          timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
          promise.reject("SECURITY_EXCEPTION", err.message, err)
        }
      } catch (err: Exception) {
        if (isResolved.compareAndSet(false, true)) {
          timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
          promise.reject("REQUEST_LOCATION_ERROR", err.message, err)
        }
      }
    }
  }

  @ReactMethod
  fun startLocationUpdates(minIntervalMs: Int, minDistanceMeters: Double, promise: Promise) {
    if (!hasLocationPermission()) {
      promise.reject("PERMISSION_DENIED", "Location permission is not granted.")
      return
    }

    val manager = getLocationManager()
    if (manager == null) {
      promise.reject("NO_LOCATION_SERVICE", "Location service unavailable.")
      return
    }

    mainHandler.post {
      try {
        activeWatcherListener?.let {
          try { manager.removeUpdates(it) } catch (_: Exception) {}
        }

        val listener = object : LocationListener {
          override fun onLocationChanged(location: Location) {
            DropAlertNativeConfig.saveConfig(
              context = reactContext,
              authToken = null,
              deviceId = null,
              deviceName = null,
              apiBaseUrl = null,
              sensitivity = null,
              isMonitoring = null,
              latitude = location.latitude,
              longitude = location.longitude
            )
            if (reactContext.hasActiveReactInstance()) {
              try {
                reactContext
                  .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                  .emit("onLocationChange", locationToMap(location))
              } catch (_: Exception) {}
            }
          }

          @Deprecated("Deprecated in Java")
          override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
          override fun onProviderEnabled(provider: String) {}
          override fun onProviderDisabled(provider: String) {}
        }

        val minTime = if (minIntervalMs > 0) minIntervalMs.toLong() else 10000L
        val minDist = if (minDistanceMeters >= 0) minDistanceMeters.toFloat() else 15f

        var registered = false
        if (manager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
          manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, minTime, minDist, listener, Looper.getMainLooper())
          registered = true
        }
        if (manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
          manager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, minTime, minDist, listener, Looper.getMainLooper())
          registered = true
        }

        if (registered) {
          activeWatcherListener = listener
          promise.resolve(true)
        } else {
          promise.reject("NO_PROVIDERS", "Neither GPS nor Network location provider is enabled.")
        }
      } catch (err: Exception) {
        promise.reject("START_WATCH_ERROR", err.message, err)
      }
    }
  }

  @ReactMethod
  fun stopLocationUpdates(promise: Promise) {
    mainHandler.post {
      try {
        val manager = getLocationManager()
        activeWatcherListener?.let {
          manager?.removeUpdates(it)
          activeWatcherListener = null
        }
        promise.resolve(true)
      } catch (err: Exception) {
        promise.reject("STOP_WATCH_ERROR", err.message, err)
      }
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for RN NativeEventEmitter
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required for RN NativeEventEmitter
  }
}
