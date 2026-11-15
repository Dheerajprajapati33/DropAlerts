package com.dropalert

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.os.CountDownTimer
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat

/**
 * Manages the high-priority lockscreen notification countdown, vibration,
 * and automatic emergency dispatch when a fall is detected natively.
 */
object NativeFallAlertManager {
  const val EMERGENCY_CHANNEL_ID = "dropalert_emergency_alert_channel"
  const val EMERGENCY_NOTIFICATION_ID = 9110

  const val ACTION_CANCEL_FALL = "com.dropalert.ACTION_CANCEL_FALL"
  const val ACTION_SEND_FALL_NOW = "com.dropalert.ACTION_SEND_FALL_NOW"

  private const val COUNTDOWN_TOTAL_MS = 10000L
  private const val COUNTDOWN_INTERVAL_MS = 1000L

  @Volatile
  private var activeFall: NativeFallResult? = null
  private var countDownTimer: CountDownTimer? = null
  private var isVibrating = false

  @Synchronized
  fun onFallConfirmed(context: Context, fall: NativeFallResult) {
    if (activeFall != null) {
      // Alert already in progress
      return
    }

    activeFall = fall
    createEmergencyChannel(context)
    startVibration(context)
    startCountdown(context, fall)
  }

  @Synchronized
  fun cancelFall(context: Context, reason: String = "User clicked cancel") {
    countDownTimer?.cancel()
    countDownTimer = null
    stopVibration(context)
    activeFall = null

    val notificationManager =
      context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
    val cancelledNotification = NotificationCompat.Builder(context, EMERGENCY_CHANNEL_ID)
      .setContentTitle("Fall Alert Cancelled")
      .setContentText("Marked as safe ($reason). Glad you are okay!")
      .setSmallIcon(R.mipmap.ic_launcher)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setTimeoutAfter(4000)
      .build()

    notificationManager?.notify(EMERGENCY_NOTIFICATION_ID, cancelledNotification)

    // Notify React Native JS if active
    MotionSensorHub.notifyJsFallCancelled()
  }

  @Synchronized
  fun sendNow(context: Context) {
    val fall = activeFall ?: return
    countDownTimer?.cancel()
    countDownTimer = null
    stopVibration(context)
    activeFall = null

    executeDispatch(context, fall)
  }

  private fun startCountdown(context: Context, fall: NativeFallResult) {
    val notificationManager =
      context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager

    countDownTimer?.cancel()
    countDownTimer = object : CountDownTimer(COUNTDOWN_TOTAL_MS, COUNTDOWN_INTERVAL_MS) {
      override fun onTick(millisUntilFinished: Long) {
        val seconds = (millisUntilFinished / 1000L) + 1L
        val notification = buildEmergencyNotification(context, fall, seconds.toInt())
        notificationManager?.notify(EMERGENCY_NOTIFICATION_ID, notification)
      }

      override fun onFinish() {
        stopVibration(context)
        val pending = activeFall
        activeFall = null
        if (pending != null) {
          executeDispatch(context, pending)
        }
      }
    }.start()
  }

  private fun executeDispatch(context: Context, fall: NativeFallResult) {
    val notificationManager =
      context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager

    val sendingNotification = NotificationCompat.Builder(context, EMERGENCY_CHANNEL_ID)
      .setContentTitle("🚨 Sending Emergency Alert...")
      .setContentText("High impact fall (${fall.impactForce}G) detected. Contacting emergency network.")
      .setSmallIcon(R.mipmap.ic_launcher)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .build()

    notificationManager?.notify(EMERGENCY_NOTIFICATION_ID, sendingNotification)

    NativeAlertDispatcher.dispatchFallReport(context, fall) { success, _ ->
      val resultNotification = NotificationCompat.Builder(context, EMERGENCY_CHANNEL_ID)
        .setContentTitle(if (success) "🚨 Emergency SOS Sent!" else "⚠️ Fall Alert Recorded")
        .setContentText(
          if (success) "Emergency contacts and nearby devices have been notified."
          else "Alert saved locally. Will retry when connection restores."
        )
        .setSmallIcon(R.mipmap.ic_launcher)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setAutoCancel(true)
        .build()

      notificationManager?.notify(EMERGENCY_NOTIFICATION_ID, resultNotification)
    }
  }

  private fun buildEmergencyNotification(
    context: Context,
    fall: NativeFallResult,
    secondsLeft: Int
  ): android.app.Notification {
    val cancelIntent = Intent(context, FallActionReceiver::class.java).apply {
      action = ACTION_CANCEL_FALL
    }
    val cancelPendingIntent = PendingIntent.getBroadcast(
      context,
      101,
      cancelIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val sendNowIntent = Intent(context, FallActionReceiver::class.java).apply {
      action = ACTION_SEND_FALL_NOW
    }
    val sendNowPendingIntent = PendingIntent.getBroadcast(
      context,
      102,
      sendNowIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val contentPendingIntent = PendingIntent.getActivity(
      context,
      103,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return NotificationCompat.Builder(context, EMERGENCY_CHANNEL_ID)
      .setContentTitle("🚨 Fall Detected! Are you OK?")
      .setContentText("Emergency alert will be sent in ${secondsLeft}s (${fall.impactForce}G impact)")
      .setSmallIcon(R.mipmap.ic_launcher)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setContentIntent(contentPendingIntent)
      .addAction(0, "I'M OK (CANCEL)", cancelPendingIntent)
      .addAction(0, "SEND NOW", sendNowPendingIntent)
      .build()
  }

  private fun createEmergencyChannel(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        ?: return
      val existing = manager.getNotificationChannel(EMERGENCY_CHANNEL_ID)
      if (existing != null) return

      val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

      val channel = NotificationChannel(
        EMERGENCY_CHANNEL_ID,
        "DropAlert Emergency Alerts",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Urgent alerts when a high-impact fall is detected"
        enableLights(true)
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 600, 400, 600, 400)
        setSound(alarmSound, null)
        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
      }
      manager.createNotificationChannel(channel)
    }
  }

  private fun startVibration(context: Context) {
    try {
      val pattern = longArrayOf(0, 600, 400, 600, 400)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        val vibrator = vm?.defaultVibrator
        vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
      } else {
        @Suppress("DEPRECATION")
        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
        } else {
          @Suppress("DEPRECATION")
          vibrator?.vibrate(pattern, 0)
        }
      }
      isVibrating = true
    } catch (_: Exception) {
      // Ignore vibration error on unsupported hardware
    }
  }

  private fun stopVibration(context: Context) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        vm?.defaultVibrator?.cancel()
      } else {
        @Suppress("DEPRECATION")
        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        vibrator?.cancel()
      }
      isVibrating = false
    } catch (_: Exception) {
      // Ignore
    }
  }
}
