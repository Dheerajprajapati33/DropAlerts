package com.dropalert

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Dispatches emergency fall reports directly to the backend over HTTP
 * from background Kotlin code, even if React Native is destroyed.
 */
object NativeAlertDispatcher {
  private const val TAG = "NativeAlertDispatcher"
  private val executor = Executors.newSingleThreadExecutor()
  private val mainHandler = Handler(Looper.getMainLooper())

  fun dispatchFallReport(
    context: Context,
    fall: NativeFallResult,
    onComplete: ((success: Boolean, responseMessage: String) -> Unit)? = null
  ) {
    executor.execute {
      var success = false
      var message = ""
      try {
        val baseUrl = DropAlertNativeConfig.getApiBaseUrl(context).trimEnd('/')
        val endpointUrl = "$baseUrl/falls/report"
        val token = DropAlertNativeConfig.getAuthToken(context)
        val deviceId = DropAlertNativeConfig.getDeviceId(context)
        val deviceName = DropAlertNativeConfig.getDeviceName(context)

        val loc = DropAlertNativeConfig.getLastLocation(context)
        val locationStr = if (loc != null) "${loc.first}, ${loc.second}" else null

        val sensorDataJson = JSONObject().apply {
          put("accelerometer", JSONObject().apply {
            put("x", fall.accelX)
            put("y", fall.accelY)
            put("z", fall.accelZ)
            put("magnitude", fall.accelMag)
          })
          put("gyroscope", JSONObject().apply {
            put("x", fall.gyroX)
            put("y", fall.gyroY)
            put("z", fall.gyroZ)
            put("magnitude", fall.gyroMag)
          })
          put("freeFallDurationMs", fall.freeFallDurationMs)
          put("peakImpactG", fall.impactForce)
          put("peakRotationRad", fall.peakRotationRad)
          put("postImpactStillnessMs", fall.postImpactStillnessMs)
          put("stagesCompleted", JSONArray().apply {
            put("normal")
            put("free_fall")
            put("impact")
            put("confirmation")
            put("alert")
          })
          put("timestamp", fall.timestamp)
        }

        val bodyJson = JSONObject().apply {
          put("deviceId", deviceId)
          put("deviceName", deviceName)
          put("severity", fall.severity)
          put("impactForce", fall.impactForce)
          put("confidence", fall.confidence)
          if (locationStr != null) {
            put("location", locationStr)
          }
          put("sensorData", sensorDataJson)
        }

        val url = URL(endpointUrl)
        val connection = (url.openConnection() as HttpURLConnection).apply {
          requestMethod = "POST"
          doOutput = true
          connectTimeout = 15000
          readTimeout = 15000
          setRequestProperty("Content-Type", "application/json")
          setRequestProperty("Accept", "application/json")
          setRequestProperty("ngrok-skip-browser-warning", "true")
          setRequestProperty("x-device-id", deviceId)
          if (!token.isNullOrBlank()) {
            setRequestProperty("Authorization", "Bearer $token")
          }
        }

        OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer ->
          writer.write(bodyJson.toString())
          writer.flush()
        }

        val statusCode = connection.responseCode
        val stream = if (statusCode in 200..299) connection.inputStream else connection.errorStream
        val responseBody = BufferedReader(InputStreamReader(stream ?: connection.inputStream)).use {
          it.readText()
        }

        if (statusCode in 200..299) {
          success = true
          message = "Fall report successfully delivered to server (HTTP $statusCode)"
          Log.i(TAG, message)
        } else {
          message = "Server returned error (HTTP $statusCode): $responseBody"
          Log.w(TAG, message)
        }
      } catch (err: Exception) {
        message = "Network error reporting fall: ${err.message}"
        Log.e(TAG, message, err)
      }

      val finalSuccess = success
      val finalMessage = message
      mainHandler.post {
        onComplete?.invoke(finalSuccess, finalMessage)
      }
    }
  }
}
