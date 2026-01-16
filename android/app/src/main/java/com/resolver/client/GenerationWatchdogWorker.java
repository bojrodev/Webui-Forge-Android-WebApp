package com.resolver.client;

import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

public class GenerationWatchdogWorker extends Worker {

    public GenerationWatchdogWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        
        // 1. Check if we EXPECT to be running (Set by Plugin)
        SharedPreferences prefs = context.getSharedPreferences("ResolverPrefs", Context.MODE_PRIVATE);
        boolean shouldBeRunning = prefs.getBoolean("should_be_generating", false);

        if (shouldBeRunning) {
            // 2. Check if we ARE running
            if (!isServiceRunning(context, ResolverForegroundService.class)) {
                // 3. RESTART SERVICE if missing
                String title = prefs.getString("last_title", "Resuming...");
                String body = prefs.getString("last_body", "Restoring connection...");
                
                Intent intent = new Intent(context, ResolverForegroundService.class);
                intent.setAction(ResolverForegroundService.ACTION_START_FOREGROUND_SERVICE);
                intent.putExtra(ResolverForegroundService.EXTRA_TITLE, title);
                intent.putExtra(ResolverForegroundService.EXTRA_BODY, body);
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent);
                } else {
                    context.startService(intent);
                }
            }
        }
        return Result.success();
    }

    private boolean isServiceRunning(Context context, Class<?> serviceClass) {
        ActivityManager manager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        for (ActivityManager.RunningServiceInfo service : manager.getRunningServices(Integer.MAX_VALUE)) {
            if (serviceClass.getName().equals(service.service.getClassName())) {
                return true;
            }
        }
        return false;
    }
}