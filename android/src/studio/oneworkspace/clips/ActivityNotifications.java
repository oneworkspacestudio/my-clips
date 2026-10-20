package studio.oneworkspace.clips;

import android.app.*;
import android.app.job.*;
import android.content.*;
import android.os.Build;
import android.webkit.CookieManager;
import org.json.*;
import javax.net.ssl.HttpsURLConnection;
import java.net.*;
import java.io.*;

/** Opt-in, generic notifications. No third-party analytics or push broker. */
public final class ActivityNotifications extends JobService {
    private volatile Thread worker;
    @Override public boolean onStartJob(JobParameters params){
        worker=new Thread(()->{try{check();}catch(Exception ignored){}finally{jobFinished(params,false);}});
        worker.start();return true;
    }
    @Override public boolean onStopJob(JobParameters params){if(worker!=null)worker.interrupt();return true;}
    private String get(String base,String route)throws Exception{
        URI uri=new URI(base+route);if(!"https".equals(uri.getScheme())||uri.getUserInfo()!=null)throw new IOException();
        HttpsURLConnection c=(HttpsURLConnection)uri.toURL().openConnection();c.setInstanceFollowRedirects(false);c.setConnectTimeout(8000);c.setReadTimeout(8000);
        String cookie=CookieManager.getInstance().getCookie(base);
        if(cookie==null||cookie.isEmpty())throw new IOException();
        c.setRequestProperty("Cookie",cookie);
        try{if(c.getResponseCode()!=200)throw new IOException();try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] b=new byte[4096];int n,total=0;while((n=in.read(b))!=-1){total+=n;if(total>512*1024)throw new IOException();out.write(b,0,n);}return out.toString("UTF-8");
        }}finally{c.disconnect();}
    }
    private void check()throws Exception{
        android.content.SharedPreferences prefs=getSharedPreferences("connection",MODE_PRIVATE);
        if(!prefs.getBoolean("notifications",false))return;
        if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)return;
        String base=prefs.getString("url","");if(base.isEmpty())return;
        JSONObject me=new JSONObject(get(base,"api/me"));String account=me.getJSONObject("user").getString("id");
        JSONObject options=new JSONObject(get(base,"api/preferences"));
        String now=options.optString("serverTime");if(now.length()!=5)return;
        String start=options.optString("quietStart"),end=options.optString("quietEnd");
        if(!start.isEmpty()&&!end.isEmpty()&&((start.compareTo(end)<0&&now.compareTo(start)>=0&&now.compareTo(end)<0)||(start.compareTo(end)>0&&(now.compareTo(start)>=0||now.compareTo(end)<0))))return;
        JSONArray items=new JSONArray(get(base,"api/notifications"));long prior=prefs.getLong("last:"+account,0),latest=prior;boolean unread=false;
        for(int i=0;i<items.length();i++){JSONObject x=items.getJSONObject(i);long id=x.getLong("id");latest=Math.max(latest,id);if(id>prior&&!x.optBoolean("seen"))unread=true;}
        // Fence an account switch between the identity and activity requests.
        String current=new JSONObject(get(base,"api/me")).getJSONObject("user").getString("id");if(!account.equals(current))return;
        if(unread){
            NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
            manager.createNotificationChannel(new NotificationChannel("activity","Private activity",NotificationManager.IMPORTANCE_DEFAULT));
            PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            Notification n=new Notification.Builder(this,"activity").setSmallIcon(getApplicationInfo().icon).setContentTitle("My Clips").setContentText("You have new activity. Open My Clips to view it.").setVisibility(Notification.VISIBILITY_PRIVATE).setContentIntent(open).setAutoCancel(true).build();manager.notify(1,n);
        }
        prefs.edit().putLong("last:"+account,latest).apply();
    }
}
