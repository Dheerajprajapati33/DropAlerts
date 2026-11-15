package com.dropalert

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action == Intent.ACTION_BOOT_COMPLETED ||
        intent?.action == Intent.ACTION_MY_PACKAGE_REPLACED) {

      val isMonitoring = DropAlertNativeConfig.isMonitoring(context)
      if (isMonitoring) {
        val serviceIntent = Intent(context, FallMonitorService::class.java).apply {
          putExtra(FallMonitorService.EXTRA_INTERVAL_MS, 20)
        }
        try {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
          } else {
            context.startService(serviceIntent)
          }
        } catch (_: Exception) {
          // Ignore if background start is restricted by manufacturer
        }
      }
    }
  }
}
