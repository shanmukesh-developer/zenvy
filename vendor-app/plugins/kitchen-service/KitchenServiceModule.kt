package com.anonymous.restaurantmobile

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Copied from restaurant-mobile/plugins/kitchen-service/ (vendor-app keeps its own copy) (copied into android/ by expo prebuild).
class KitchenServiceModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "KitchenServiceModule"

    @ReactMethod
    fun startKitchenService(promise: Promise) {
        try {
            val intent = Intent(reactContext, KitchenForegroundService::class.java).apply {
                action = KitchenForegroundService.ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopKitchenService(promise: Promise) {
        try {
            val intent = Intent(reactContext, KitchenForegroundService::class.java).apply {
                action = KitchenForegroundService.ACTION_STOP
            }
            reactContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_SERVICE_ERROR", e.message, e)
        }
    }

    /** Older signature, kept for compatibility: Telugu notification text. */
    @ReactMethod
    fun speakOrder(text: String, orderNum: String, amount: String, promise: Promise) {
        sendOrderAlert(text, orderNum, amount, "", "", false, promise)
    }

    /** New-order alert with the notification title / body in the owner's chosen language. */
    @ReactMethod
    fun alertOrder(text: String, orderNum: String, amount: String, title: String, body: String, promise: Promise) {
        sendOrderAlert(text, orderNum, amount, title, body, false, promise)
    }

    /**
     * Same, with `silent`: the heads-up is posted without its own sound / vibration because the app's ring
     * already played (otherwise every re-ring sounds twice).
     */
    @ReactMethod
    fun alertOrderV2(text: String, orderNum: String, amount: String, title: String, body: String, silent: Boolean, promise: Promise) {
        sendOrderAlert(text, orderNum, amount, title, body, silent, promise)
    }

    /** Removes the heads-up notification of an order that was accepted, rejected, silenced or cancelled. */
    @ReactMethod
    fun cancelOrderAlert(orderNum: String, promise: Promise) {
        KitchenForegroundService.cancelOrderAlert(reactContext, orderNum)
        promise.resolve(true)
    }

    private fun sendOrderAlert(text: String, orderNum: String, amount: String, title: String, body: String, silent: Boolean, promise: Promise) {
        try {
            val intent = Intent(reactContext, KitchenForegroundService::class.java).apply {
                action = KitchenForegroundService.ACTION_SPEAK
                putExtra(KitchenForegroundService.EXTRA_TEXT, text)
                putExtra(KitchenForegroundService.EXTRA_ORDER_NUM, orderNum)
                putExtra(KitchenForegroundService.EXTRA_AMOUNT, amount)
                putExtra(KitchenForegroundService.EXTRA_TITLE, title)
                putExtra(KitchenForegroundService.EXTRA_BODY, body)
                putExtra(KitchenForegroundService.EXTRA_SILENT, silent)
            }
            // Service already in the foreground: a plain startService is allowed (the app holds a foreground
            // service) and carries no startForeground() deadline. Otherwise startForegroundService; the
            // service calls startForeground() first for every start path.
            if (KitchenForegroundService.isRunning || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                reactContext.startService(intent)
            } else {
                reactContext.startForegroundService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SPEAK_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isServiceRunning(promise: Promise) {
        promise.resolve(KitchenForegroundService.isRunning)
    }
}
