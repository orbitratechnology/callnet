package com.orbitratech.callnet.backgroundevents

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CallnetBackgroundEventsModule : Module() {
  private val context
    get() = requireNotNull(appContext.reactContext).applicationContext

  override fun definition() = ModuleDefinition {
    Name("CallnetBackgroundEvents")

    Function("getPendingCallEvents") {
      PendingCallStore.read(context)
    }

    Function("acknowledgePendingCallEvents") { eventIds: List<String> ->
      PendingCallStore.remove(context, eventIds)
    }
  }
}
