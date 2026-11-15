package com.dropalert

import android.content.Context
import android.content.SharedPreferences

/**
 * Persistent storage in Android SharedPreferences for credentials and fall monitoring configuration.
 * Accessible even when the React Native runtime is killed or the phone is rebooted.
 */
object DropAlertNativeConfig {
  private const val PREFS_NAME = "dropalert_native_prefs"

  private const val KEY_AUTH_TOKEN = "auth_token"
  private const val KEY_DEVICE_ID = "device_id"
  private const val KEY_DEVICE_NAME = "device_name"
  private const val KEY_API_BASE_URL = "api_base_url"
  private const val KEY_SENSITIVITY = "sensitivity"
  private const val KEY_IS_MONITORING = "is_monitoring"
  private const val KEY_LATITUDE = "last_latitude"
  private const val KEY_LONGITUDE = "last_longitude"

  const val DEFAULT_BASE_URL = "https://bouncy-ember-enlisted.ngrok-free.dev/api/v1"

  private fun prefs(context: Context): SharedPreferences =
    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun saveConfig(
    context: Context,
    authToken: String?,
    deviceId: String?,
    deviceName: String?,
    apiBaseUrl: String?,
    sensitivity: String?,
    isMonitoring: Boolean?,
    latitude: Double?,
    longitude: Double?
  ) {
    val editor = prefs(context).edit()
    authToken?.let { editor.putString(KEY_AUTH_TOKEN, it) }
    deviceId?.let { editor.putString(KEY_DEVICE_ID, it) }
    deviceName?.let { editor.putString(KEY_DEVICE_NAME, it) }
    apiBaseUrl?.let { editor.putString(KEY_API_BASE_URL, it) }
    sensitivity?.let { editor.putString(KEY_SENSITIVITY, it) }
    isMonitoring?.let { editor.putBoolean(KEY_IS_MONITORING, it) }
    latitude?.let { editor.putFloat(KEY_LATITUDE, it.toFloat()) }
    longitude?.let { editor.putFloat(KEY_LONGITUDE, it.toFloat()) }
    editor.apply()
  }

  fun clearAuthToken(context: Context) {
    prefs(context).edit().remove(KEY_AUTH_TOKEN).apply()
  }

  fun getAuthToken(context: Context): String? =
    prefs(context).getString(KEY_AUTH_TOKEN, null)

  fun getDeviceId(context: Context): String =
    prefs(context).getString(KEY_DEVICE_ID, null) ?: "android-native-device"

  fun getDeviceName(context: Context): String =
    prefs(context).getString(KEY_DEVICE_NAME, null) ?: "Current Phone"

  fun getApiBaseUrl(context: Context): String =
    prefs(context).getString(KEY_API_BASE_URL, null) ?: DEFAULT_BASE_URL

  fun getSensitivity(context: Context): String =
    prefs(context).getString(KEY_SENSITIVITY, "Medium") ?: "Medium"

  fun isMonitoring(context: Context): Boolean =
    prefs(context).getBoolean(KEY_IS_MONITORING, true)

  fun getLastLocation(context: Context): Pair<Double, Double>? {
    val sp = prefs(context)
    if (!sp.contains(KEY_LATITUDE) || !sp.contains(KEY_LONGITUDE)) return null
    val lat = sp.getFloat(KEY_LATITUDE, 0f).toDouble()
    val lng = sp.getFloat(KEY_LONGITUDE, 0f).toDouble()
    return if (lat != 0.0 || lng != 0.0) Pair(lat, lng) else null
  }
}
