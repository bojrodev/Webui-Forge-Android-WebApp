package com.resolver.client;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class ResolverForegroundService extends Service {
    
    private static final String CHANNEL_ID = "RESOLVER_FG_CHANNEL";
    private static final int NOTIFICATION_ID = 1002;
    
    // Actions
    public static final String ACTION_START_FOREGROUND_SERVICE = "ACTION_START_FOREGROUND_SERVICE";
    public static final String ACTION_STOP_FOREGROUND_SERVICE = "ACTION_STOP_FOREGROUND_SERVICE";
    public static final String ACTION_UPDATE_PROGRESS = "ACTION_UPDATE_PROGRESS";
    
    // Extras
    public static final String EXTRA_TITLE = "EXTRA_TITLE";
    public static final String EXTRA_BODY = "EXTRA_BODY";
    public static final String EXTRA_PROGRESS = "EXTRA_PROGRESS";
    
    // Locks (To keep CPU/WiFi alive)
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    
    // --- Public Service Control Methods ---
    
    public static void startOrUpdateService(Context context, String title, String body, int progress) {
        Intent intent = new Intent(context, ResolverForegroundService.class);
        
        if (progress == 0) {
            intent.setAction(ACTION_START_FOREGROUND_SERVICE);
        } else {
            intent.setAction(ACTION_UPDATE_PROGRESS);
        }
        
        intent.putExtra(EXTRA_TITLE, title);
        intent.putExtra(EXTRA_BODY, body);
        intent.putExtra(EXTRA_PROGRESS, progress);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }
    
    public static void stopService(Context context) {
        Intent intent = new Intent(context, ResolverForegroundService.class);
        intent.setAction(ACTION_STOP_FOREGROUND_SERVICE);
        context.startService(intent);
    }

    // --- Service Lifecycle & Lock Management ---

    @Override
    public void onCreate() {
        super.onCreate();
        // 1. Setup the WakeLock (Keeps CPU running)
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Resolver:ServiceWakeLock");
            wakeLock.setReferenceCounted(false);
        }

        // 2. Setup the WifiLock (Keeps Internet active)
        WifiManager wifiManager = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wifiManager != null) {
            wifiLock = wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "Resolver:ServiceWifiLock");
            wifiLock.setReferenceCounted(false);
        }
    }

    private void acquireLocks() {
        if (wakeLock != null && !wakeLock.isHeld()) wakeLock.acquire();
        if (wifiLock != null && !wifiLock.isHeld()) wifiLock.acquire();
    }

    private void releaseLocks() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // CRITICAL: Acquire locks immediately when the service runs
        acquireLocks();

        if (intent != null) {
            String action = intent.getAction();
            
            if (action != null) {
                String title = intent.getStringExtra(EXTRA_TITLE);
                String body = intent.getStringExtra(EXTRA_BODY);
                if (title == null) title = "Processing";
                if (body == null) body = "Initializing...";

                switch (action) {
                    case ACTION_START_FOREGROUND_SERVICE:
                        startForegroundServiceCompat(title, body, 0);
                        break;
                    case ACTION_UPDATE_PROGRESS:
                        int progress = intent.getIntExtra(EXTRA_PROGRESS, 0);
                        updateNotification(title, body, progress);
                        break;
                    case ACTION_STOP_FOREGROUND_SERVICE:
                        // Release locks when we explicitly stop
                        releaseLocks();
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                            stopForeground(STOP_FOREGROUND_REMOVE);
                        } else {
                            stopForeground(true);
                        }
                        stopSelf();
                        break;
                }
            }
        }
        return START_REDELIVER_INTENT; 
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        releaseLocks(); 
    }

    // --- Notification Management ---

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Resolver Background",
                    NotificationManager.IMPORTANCE_LOW 
            );
            channel.setDescription("Background generation status.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification(String title, String body, int progress) {
        createNotificationChannel();
        
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(body) 
                .setSmallIcon(R.mipmap.ic_launcher) 
                .setProgress(100, progress, false) 
                .setOnlyAlertOnce(true) 
                .setOngoing(true) 
                .setPriority(NotificationCompat.PRIORITY_LOW) 
                .build();
    }
    
    private void startForegroundServiceCompat(String title, String body, int progress) {
        Notification notification = buildNotification(title, body, progress);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // CHANGE: Using MEDIA_PLAYBACK type (matches your Manifest)
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }
    
    private void updateNotification(String title, String body, int progress) {
        Notification notification = buildNotification(title, body, progress);
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, notification);
        }
    }
    
    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}