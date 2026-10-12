package com.anonymous.restaurantmobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.speech.tts.TextToSpeech
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.util.Locale

// Source of truth: restaurant-mobile/plugins/kitchen-service/. The config plugin (withKitchenService.js)
// copies this file into android/ on every `expo prebuild`, so edit it there, not in android/.
class KitchenForegroundService : Service(), TextToSpeech.OnInitListener {
    private var wakeLock: PowerManager.WakeLock? = null
    private var tts: TextToSpeech? = null
    private var isTtsReady = false
    private var isForeground = false

    companion object {
        const val CHANNEL_ID = "zenvy_kitchen_live_channel"
        const val ALERT_CHANNEL_ID = "zenvy_order_alert_channel"
        const val NOTIFICATION_ID = 9991
        const val ACTION_START = "ACTION_START"
        const val ACTION_STOP = "ACTION_STOP"
        const val ACTION_SPEAK = "ACTION_SPEAK"
        const val EXTRA_TEXT = "EXTRA_TEXT"
        const val EXTRA_ORDER_NUM = "EXTRA_ORDER_NUM"
        const val EXTRA_AMOUNT = "EXTRA_AMOUNT"
        const val EXTRA_TITLE = "EXTRA_TITLE"
        const val EXTRA_BODY = "EXTRA_BODY"
        private const val WAKELOCK_MS = 24 * 60 * 60 * 1000L

        @Volatile
        var isRunning = false

        /** One stable notification id per order, so a re-ring replaces the old heads-up instead of stacking. */
        fun alertIdFor(orderNum: String): Int = 100000 + (orderNum.hashCode() and 0x7fffffff) % 100000

        fun cancelOrderAlert(context: Context, orderNum: String) {
            if (orderNum.isEmpty()) return
            try { NotificationManagerCompat.from(context).cancel(alertIdFor(orderNum)) } catch (e: Exception) {}
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
        tts = TextToSpeech(applicationContext, this)

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ZenvyKitchen::WakeLock").apply {
            setReferenceCounted(false)
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            configureTts(tts)
            isTtsReady = true
        }
    }

    private fun configureTts(engine: TextToSpeech?) {
        val result = engine?.setLanguage(Locale("te", "IN"))
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            engine?.setLanguage(Locale("te"))
        }
        engine?.setSpeechRate(0.88f)
        engine?.setPitch(1.02f)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == ACTION_STOP) {
            stopKitchenForeground()
            return START_NOT_STICKY
        }
        // Every other start path (ACTION_START, ACTION_SPEAK, or a sticky restart with a null intent) may
        // have come from startForegroundService, so go foreground before anything else. ACTION_START also
        // re-runs it on purpose: that renews the wakelock each time the app comes back.
        if (!isForeground || action == ACTION_START) startKitchenForeground()
        if (intent != null && action == ACTION_SPEAK && isForeground) {
            handleOrderAlert(
                intent.getStringExtra(EXTRA_TEXT) ?: "",
                intent.getStringExtra(EXTRA_ORDER_NUM) ?: "",
                intent.getStringExtra(EXTRA_AMOUNT) ?: "",
                intent.getStringExtra(EXTRA_TITLE),
                intent.getStringExtra(EXTRA_BODY),
            )
        }
        return START_STICKY
    }

    private fun startKitchenForeground() {
        isRunning = true
        try {
            wakeLock?.acquire(WAKELOCK_MS)
        } catch (e: Exception) {}

        val notification = createPersistentNotification()
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val serviceType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC or ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                } else {
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                }
                startForeground(NOTIFICATION_ID, notification, serviceType)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            isForeground = true
        } catch (e: Exception) {
            // e.g. ForegroundServiceStartNotAllowedException, or the daily dataSync limit is used up: stop
            // cleanly instead of crashing. The app starts the service again the next time it is opened.
            stopKitchenForeground()
        }
    }

    private fun stopKitchenForeground() {
        isRunning = false
        isForeground = false
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (e: Exception) {}
        try { stopForeground(STOP_FOREGROUND_REMOVE) } catch (e: Exception) {}
        stopSelf()
    }

    /**
     * Android 15+: the dataSync foreground-service type has a daily time limit. When it runs out the system
     * calls this, and kills the app if the service does not stop within seconds. Stop cleanly; the app
     * starts the service again on its next resume.
     */
    override fun onTimeout(startId: Int, fgsType: Int) {
        stopKitchenForeground()
    }

    private fun handleOrderAlert(text: String, orderNum: String, amount: String, title: String?, body: String?) {
        // 1. Wake up screen and CPU so user sees and hears alert outside app
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            @Suppress("DEPRECATION")
            val screenLock = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "ZenvyKitchen::OrderWakeup"
            )
            screenLock.acquire(15000L)
        } catch (e: Exception) {}

        // 2. Strong PhonePe-style vibration
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator.vibrate(
                    VibrationEffect.createWaveform(longArrayOf(0, 400, 200, 400, 200, 600), -1)
                )
            } else {
                @Suppress("DEPRECATION")
                val v = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 400, 200, 400, 200, 600), -1))
                } else {
                    @Suppress("DEPRECATION")
                    v.vibrate(longArrayOf(0, 400, 200, 400, 200, 600), -1)
                }
            }
        } catch (e: Exception) {}

        // 3. Heads-up notification, one per order: a re-ring replaces it (and alerts again), and the app
        //    removes it once the order is accepted / rejected / silenced / cancelled.
        try {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val intent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                this, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
            )

            val alertNotification = NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(if (!title.isNullOrEmpty()) title else "🔔 జెన్వీ కొత్త ఆర్డర్! (₹$amount)")
                .setContentText(if (!body.isNullOrEmpty()) body else "రసీదు నంబర్ #${orderNum}. త్వరగా కిచెన్‌లో తయారు చేయండి!")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setOnlyAlertOnce(false)
                .setVibrate(longArrayOf(0, 400, 200, 400, 200, 600))
                .build()

            val id = if (orderNum.isNotEmpty()) alertIdFor(orderNum) else (System.currentTimeMillis() % 10000).toInt()
            notificationManager.notify(id, alertNotification)
        } catch (e: Exception) {}

        // 4. Speak Telugu announcement through device speaker
        if (text.isNotEmpty()) {
            if (isTtsReady) {
                tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "ZENVY_ORDER_${System.currentTimeMillis()}")
            } else {
                // The engine has not initialised (or failed to): replace it, shutting the old one down so
                // repeated rings never leak TextToSpeech instances.
                try { tts?.shutdown() } catch (e: Exception) {}
                var fresh: TextToSpeech? = null
                fresh = TextToSpeech(applicationContext) { status ->
                    if (status == TextToSpeech.SUCCESS) {
                        configureTts(fresh)
                        isTtsReady = true
                        fresh?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "ZENVY_ORDER_${System.currentTimeMillis()}")
                    }
                }
                tts = fresh
            }
        }
    }

    private fun createPersistentNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🛎️ Zenvy కిచెన్ ఆన్‌లైన్")
            .setContentText("కొత్త ఆర్డర్ల కోసం వేచి ఉంది • లైవ్ డిస్పాచ్ యాక్టివ్")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val liveChannel = NotificationChannel(
                CHANNEL_ID,
                "Zenvy Kitchen Status",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows continuous live kitchen connection status"
            }
            notificationManager.createNotificationChannel(liveChannel)

            val audioAttr = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build()

            val alertChannel = NotificationChannel(
                ALERT_CHANNEL_ID,
                "Zenvy Incoming Orders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Plays loud Telugu voice and chime on incoming orders"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 400, 200, 400, 200, 600)
                setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), audioAttr)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(alertChannel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        tts?.stop()
        tts?.shutdown()
        tts = null
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        } catch (e: Exception) {}
        isRunning = false
        isForeground = false
    }
}
