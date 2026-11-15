package com.dropalert

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat

/**
 * Dedicated standalone foreground daemon service running in the isolated
 * `:fallmonitor` process with `stopWithTask="false"`.
 * Continues running 24/7 even if the user swipes away the main application.
 */
class FallMonitorService : Service() {
  companion object {
    const val CHANNEL_ID = "dropalert_fall_monitor_channel"
    const val NOTIFICATION_ID = 4102

    const val EXTRA_INTERVAL_MS = "intervalMs"
    const val EXTRA_TOKEN = "authToken"
    const val EXTRA_SENSITIVITY = "sensitivity"
    const val EXTRA_DEVICE_ID = "deviceId"
    const val EXTRA_DEVICE_NAME = "deviceName"
    const val EXTRA_API_URL = "apiUrl"
    const val EXTRA_LATITUDE = "latitude"
    const val EXTRA_LONGITUDE = "longitude"

    const val ACTION_START = "com.dropalert.ACTION_START_FALL_MONITOR"
    const val ACTION_STOP = "com.dropalert.ACTION_STOP_FALL_MONITOR"
    const val ACTION_UPDATE_CONFIG = "com.dropalert.ACTION_UPDATE_CONFIG"
    const val ACTION_SIMULATE_FALL = "com.dropalert.ACTION_SIMULATE_FALL"
    const val ACTION_CANCEL_FALL = "com.dropalert.ACTION_CANCEL_FALL"
  }

  private var wakeLock: PowerManager.WakeLock? = null

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val action = intent?.action

    if (action == ACTION_STOP) {
      DropAlertNativeConfig.saveConfig(
        context = this,
        authToken = null,
        deviceId = null,
        deviceName = null,
        apiBaseUrl = null,
        sensitivity = null,
        isMonitoring = false,
        latitude = null,
        longitude = null
      )
      stopSelf()
      return START_NOT_STICKY
    }

    if (action == ACTION_CANCEL_FALL) {
      NativeFallAlertManager.cancelFall(this, "Cancelled from app UI")
      return START_STICKY
    }

    if (action == ACTION_SIMULATE_FALL) {
      MotionSensorHub.simulateNativeFall(this)
      return START_STICKY
    }

    if (action == ACTION_UPDATE_CONFIG) {
      val token = intent.getStringExtra(EXTRA_TOKEN)
      val sens = intent.getStringExtra(EXTRA_SENSITIVITY)
      val devId = intent.getStringExtra(EXTRA_DEVICE_ID)
      val devName = intent.getStringExtra(EXTRA_DEVICE_NAME)
      val apiUrl = intent.getStringExtra(EXTRA_API_URL)
      val lat = if (intent.hasExtra(EXTRA_LATITUDE)) intent.getDoubleExtra(EXTRA_LATITUDE, 0.0) else null
      val lng = if (intent.hasExtra(EXTRA_LONGITUDE)) intent.getDoubleExtra(EXTRA_LONGITUDE, 0.0) else null

      DropAlertNativeConfig.saveConfig(
        context = this,
        authToken = token,
        deviceId = devId,
        deviceName = devName,
        apiBaseUrl = apiUrl,
        sensitivity = sens,
        isMonitoring = true,
        latitude = lat,
        longitude = lng
      )

      sens?.let { MotionSensorHub.updateSensitivity(it) }
    }

    val intervalMs = intent?.getIntExtra(EXTRA_INTERVAL_MS, 20) ?: 20
    val notification = buildNotification()

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH or ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        )
      } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        )
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (_: Exception) {
      // Fallback
      startForeground(NOTIFICATION_ID, notification)
    }

    acquireWakeLock()
    MotionSensorHub.start(this, intervalMs)

    return START_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    super.onTaskRemoved(rootIntent)
    // Main UI was swiped away from Recents, but this service in :fallmonitor continues running.
    // Set an AlarmManager heartbeat just in case OS tries to freeze this process.
    scheduleWatchdogAlarm(this)
  }

  override fun onDestroy() {
    MotionSensorHub.stop()
    releaseWakeLock()

    // If monitoring is still enabled, schedule an automatic restart
    if (DropAlertNativeConfig.isMonitoring(this)) {
      scheduleWatchdogAlarm(this)
    }

    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun scheduleWatchdogAlarm(context: Context) {
    try {
      val restartIntent = Intent(context.applicationContext, FallMonitorService::class.java).apply {
        action = ACTION_START
        putExtra(EXTRA_INTERVAL_MS, 20)
      }
      val pendingIntent = PendingIntent.getService(
        context.applicationContext,
        4103,
        restartIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
      alarmManager?.setAndAllowWhileIdle(
        AlarmManager.RTC_WAKEUP,
        System.currentTimeMillis() + 1000L,
        pendingIntent
      )
    } catch (_: Exception) {
      // Ignore
    }
  }

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) return
    val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DropAlert::FallMonitorWakeLock").apply {
      setReferenceCounted(false)
      // Safety timeout
      acquire(12 * 60 * 60 * 1000L)
    }
  }

  private fun releaseWakeLock() {
    try {
      if (wakeLock?.isHeld == true) {
        wakeLock?.release()
      }
    } catch (_: Exception) {
      // Ignore
    }
    wakeLock = null
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
      val existing = manager.getNotificationChannel(CHANNEL_ID)
      if (existing != null) return

      val channel = NotificationChannel(
        CHANNEL_ID,
        "Fall Protection Monitoring",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Keeps motion sensors active to detect sudden drops and falls 24/7."
        setShowBadge(false)
      }
      manager.createNotificationChannel(channel)
    }
  }

  private fun buildNotification(): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("DropAlert Protection Active")
      .setContentText("Continuous 24/7 fall detection running in background")
      .setSmallIcon(R.mipmap.ic_launcher)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setContentIntent(pendingIntent)
      .build()
  }
}
