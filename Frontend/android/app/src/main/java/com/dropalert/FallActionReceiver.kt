package com.dropalert

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class FallActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    when (intent?.action) {
      NativeFallAlertManager.ACTION_CANCEL_FALL -> {
        NativeFallAlertManager.cancelFall(context, "User tapped I'm OK on lockscreen")
      }
      NativeFallAlertManager.ACTION_SEND_FALL_NOW -> {
        NativeFallAlertManager.sendNow(context)
      }
    }
  }
}
