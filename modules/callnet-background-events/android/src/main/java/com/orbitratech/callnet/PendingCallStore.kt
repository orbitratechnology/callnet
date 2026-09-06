package com.orbitratech.callnet.backgroundevents

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

internal object PendingCallStore {
  private const val PREFERENCES = "callnet.background.events"
  private const val EVENTS_KEY = "pending_call_ended"
  private const val MAX_EVENTS = 8

  @Synchronized
  fun enqueue(context: Context, event: Map<String, String>) {
    val events = readJson(context)
    val eventId = event["eventId"] ?: return
    if (events.any { it.optString("eventId") == eventId }) return

    events += JSONObject(event)
    while (events.size > MAX_EVENTS) {
      events.removeAt(0)
    }
    writeJson(context, events)
  }

  @Synchronized
  fun read(context: Context): List<Map<String, Any>> {
    return readJson(context).map { json ->
      mapOf(
        "eventId" to json.optString("eventId"),
        "nativeCallId" to json.optString("nativeCallId"),
        "serverCallId" to json.optString("serverCallId"),
        "peerId" to json.optString("peerId"),
        "kind" to json.optString("kind", "voice"),
        "endedAt" to json.optLong("endedAt"),
      )
    }
  }

  @Synchronized
  fun remove(context: Context, eventIds: List<String>) {
    if (eventIds.isEmpty()) return
    val ids = eventIds.toSet()
    val remaining = readJson(context).filterNot { ids.contains(it.optString("eventId")) }
    writeJson(context, remaining)
  }

  private fun readJson(context: Context): MutableList<JSONObject> {
    val raw = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
      .getString(EVENTS_KEY, null)
      ?: return mutableListOf()
    return try {
      val array = JSONArray(raw)
      buildList {
        for (index in 0 until array.length()) {
          val item = array.optJSONObject(index) ?: continue
          if (item.optString("eventId").isNotBlank()) add(item)
        }
      }.toMutableList()
    } catch (_: Exception) {
      mutableListOf()
    }
  }

  private fun writeJson(context: Context, events: List<JSONObject>) {
    val array = JSONArray()
    events.forEach(array::put)
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
      .edit()
      .putString(EVENTS_KEY, array.toString())
      .commit()
  }
}
