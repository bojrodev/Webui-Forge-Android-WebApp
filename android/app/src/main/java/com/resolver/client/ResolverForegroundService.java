package com.resolver.client;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class ResolverForegroundService extends Service {
    
    private static final String CHANNEL_ID = "RESOLVER_FG_CHANNEL";
    private static final int NOTIFICATION_ID = 1002;
    
    // Actions for Intents
    public static final String ACTION_START_FOREGROUND_SERVICE = "ACTION_START_FOREGROUND_SERVICE";
    public static final String ACTION_STOP_FOREGROUND_SERVICE = "ACTION_STOP_FOREGROUND_SERVICE";
    public static final String ACTION_UPDATE_PROGRESS = "ACTION_UPDATE_PROGRESS";
    
    // Data Keys
    public static final String EXTRA_TITLE = "EXTRA_TITLE";
    public static final String EXTRA_PROGRESS = "EXTRA_PROGRESS";
    
    // --- Public Service Control Methods ---
    
    public static void startOrUpdateService(Context context, String title, int progress) {
        Intent intent = new Intent(context, ResolverForegroundService.class);
        
        // Determine action: START if 0, UPDATE otherwise
        if (progress == 0) {
            intent.setAction(ACTION_START_FOREGROUND_SERVICE);
        } else {
            intent.setAction(ACTION_UPDATE_PROGRESS);
        }
        
        intent.putExtra(EXTRA_TITLE, title);
        intent.putExtra(EXTRA_PROGRESS, progress);
        
        // Start the service for immediate execution
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

    // --- Service Lifecycle ---

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            
            if (action != null) {
                switch (action) {
                    case ACTION_START_FOREGROUND_SERVICE:
                        startForeground(NOTIFICATION_ID, buildNotification("Generation Started", 0));
                        break;
                    case ACTION_UPDATE_PROGRESS:
                        String title = intent.getStringExtra(EXTRA_TITLE);
                        int progress = intent.getIntExtra(EXTRA_PROGRESS, 0);
                        updateNotification(title, progress);
                        break;
                    case ACTION_STOP_FOREGROUND_SERVICE:
                        stopForeground(true);
                        stopSelf();
                        break;
                }
            }
        }
        return START_STICKY; // Service should be restarted if system kills it
    }

    // --- Notification Management ---

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Resolver Background",
                    NotificationManager.IMPORTANCE_LOW // Low importance prevents constant pop-ups
            );
            channel.setDescription("Background generation status.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification(String title, int progress) {
        createNotificationChannel();
        
        // This is the key: The progress bar.
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText("Step count in progress...") // Static text
                .setSmallIcon(R.mipmap.ic_launcher) // Use your existing app icon
                .setProgress(100, progress, false) // Max 100, current progress, false=not indeterminate
                .setOnlyAlertOnce(true) // Crucial: prevents sound/vibration on update
                .setOngoing(true) // Crucial: makes it static and cannot be swiped away easily
                .setPriority(NotificationCompat.PRIORITY_LOW) // Low priority helps reduce interruption
                .build();
    }
    
    private void updateNotification(String title, int progress) {
        Notification notification = buildNotification(title, progress);
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        manager.notify(NOTIFICATION_ID, notification);
    }
    
    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}