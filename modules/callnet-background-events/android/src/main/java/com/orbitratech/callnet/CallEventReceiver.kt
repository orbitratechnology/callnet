package com.orbitratech.callnet.backgroundevents

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONObject

class CallEventReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_CALL_EVENT || intent.getStringExtra(EXTRA_EVENT_NAME) != EVENT_CALL_ENDED) {
      return
    }

    val payload = intent.getStringExtra(EXTRA_PAYLOAD)?.let {
      runCatching { JSONObject(it) }.getOrNull()
    } ?: return
    val session = payload.optJSONObject("session") ?: return
    val incoming = session.optJSONObject("incomingCallEvent") ?: return
    val serverCallId = incoming.optString("serverCallId").takeIf(String::isNotBlank) ?: return
    val peerId = incoming.optJSONObject("caller")?.optString("id")?.takeIf(String::isNotBlank) ?: return
    val nativeCallId = payload.optString("id").takeIf(String::isNotBlank) ?: return
    val endedAt = parseTimestamp(payload) ?: System.currentTimeMillis()
    val eventId = "$serverCallId:$nativeCallId:$endedAt"
    val kind = if (incoming.optBoolean("hasVideo", false)) "video" else "voice"

    PendingCallStore.enqueue(
      context.applicationContext,
      mapOf(
        "eventId" to eventId,
        "nativeCallId" to nativeCallId,
        "serverCallId" to serverCallId,
        "peerId" to peerId,
        "kind" to kind,
        "endedAt" to endedAt.toString(),
      ),
    )
  }

  private fun parseTimestamp(payload: JSONObject): Long? {
    val timestamp = payload.optJSONObject("meta")?.optString("timestamp") ?: return null
    return runCatching { java.time.Instant.parse(timestamp).toEpochMilli() }.getOrNull()
  }

  private companion object {
    const val ACTION_CALL_EVENT = "expo.modules.callkittelecom.ACTION_CALL_EVENT"
    const val EXTRA_EVENT_NAME = "eventName"
    const val EXTRA_PAYLOAD = "payload"
    const val EVENT_CALL_ENDED = "onCallEnded"
  }
}
