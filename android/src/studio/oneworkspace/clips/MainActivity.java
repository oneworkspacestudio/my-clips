package studio.oneworkspace.clips;

import android.Manifest;
import android.app.*;
import android.app.job.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.net.URI;
import java.util.*;

/** Small native client. The server owns identity; no JavaScript/native bridge. */
public final class MainActivity extends Activity {
    private WebView web;
    private String origin = "", appURL = "";
    private ValueCallback<Uri[]> files;
    private PermissionRequest media;
    private String[] requestedResources = new String[0];
    private android.content.SharedPreferences prefs;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences("connection", MODE_PRIVATE);
        getWindow().setStatusBarColor(Color.rgb(16,16,20));
        getWindow().setNavigationBarColor(Color.rgb(16,16,20));
        String saved=prefs.getString("url", "");
        if (!saved.isEmpty() && configure(saved)) openApp(); else connection();
    }
    private boolean configure(String value) {
        try {
            URI u = new URI(value.trim());
            if (!"https".equals(u.getScheme()) || u.getHost()==null || u.getUserInfo()!=null || u.getQuery()!=null || u.getFragment()!=null) return false;
            if (u.getPort()!=-1 && u.getPort()!=443) return false;
            origin="https://"+u.getHost().toLowerCase(Locale.ROOT);
            String path=u.getPath();if(path==null||path.isEmpty()||"/".equals(path))path="/clips/";
            if(!path.endsWith("/"))path+="/";
            if(path.contains("..")||path.contains("%"))return false;
            appURL=origin+path;
            return true;
        }catch(Exception e){return false;}
    }
    private boolean sameOrigin(Uri u) {
        return "https".equals(u.getScheme()) && u.getUserInfo()==null && (u.getPort()==-1||u.getPort()==443) && ("https://"+u.getHost()).equalsIgnoreCase(origin);
    }
    private void connection(){
        if(web!=null){web.onPause();web.destroy();web=null;}
        LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setPadding(54,80,54,40);layout.setBackgroundColor(Color.rgb(16,16,20));
        TextView title=new TextView(this);title.setText("My Clips");title.setTextSize(34);title.setTextColor(Color.WHITE);layout.addView(title);
        TextView intro=new TextView(this);intro.setText("Your creativity. Your server.\n\nConnect to your One Workspace HTTPS address.");intro.setTextColor(0xffb7b7c6);intro.setTextSize(16);intro.setPadding(0,24,0,24);layout.addView(intro);
        EditText input=new EditText(this);input.setSingleLine();input.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_URI);input.setHint("https://workspace.example.com/clips/");input.setText(prefs.getString("url",""));input.setTextColor(Color.WHITE);input.setHintTextColor(0xff777788);layout.addView(input);
        Button connect=new Button(this);connect.setText("Connect");layout.addView(connect);
        connect.setOnClickListener(v->{if(!configure(input.getText().toString())){input.setError("Use an HTTPS server address without credentials or query parameters");return;}String prior=prefs.getString("url","");prefs.edit().putString("url",appURL).apply();if(!prior.equals(appURL)){CookieManager.getInstance().removeAllCookies(ok->openApp());}else openApp();});
        Switch notifications=new Switch(this);notifications.setText("Activity notifications");notifications.setTextColor(Color.WHITE);notifications.setChecked(prefs.getBoolean("notifications",false));layout.addView(notifications);
        TextView detail=new TextView(this);detail.setText("\nAndroid checks for activity approximately every 15 minutes. Delivery can be delayed by battery saving. Notification text stays private.");detail.setTextColor(0xff9999a8);detail.setTextSize(13);layout.addView(detail);
        notifications.setOnCheckedChangeListener((v,on)->{if(on&&Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},45);notifications.setChecked(false);return;}prefs.edit().putBoolean("notifications",on).apply();schedule(on);});
        setContentView(layout);
    }
    private void schedule(boolean on){
        JobScheduler scheduler=(JobScheduler)getSystemService(JOB_SCHEDULER_SERVICE);
        if(!on){scheduler.cancel(4801);return;}
        JobInfo job=new JobInfo.Builder(4801,new ComponentName(this,ActivityNotifications.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(15*60*1000L).build();
        scheduler.schedule(job);
    }
    @SuppressWarnings("deprecation") private void openApp(){
        web=new WebView(this);web.setBackgroundColor(Color.rgb(16,16,20));
        WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);s.setAllowFileAccessFromFileURLs(false);s.setAllowUniversalAccessFromFileURLs(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setMediaPlaybackRequiresUserGesture(false);s.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req){
                Uri u=req.getUrl();
                if("myclips".equals(u.getScheme())&&"settings".equals(u.getHost())&&req.isForMainFrame()){connection();return true;}
                if(sameOrigin(u))return false;
                if(req.isForMainFrame()&&req.hasGesture()&&"https".equals(u.getScheme())){try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(ActivityNotFoundException ignored){}}
                return true;
            }
            @Override public void onReceivedSslError(WebView v,android.webkit.SslErrorHandler handler,android.net.http.SslError error){handler.cancel();}
            @Override public void onPageFinished(WebView v,String url){CookieManager.getInstance().flush();}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams params){
                if(!sameOrigin(Uri.parse(v.getUrl()))){cb.onReceiveValue(null);return true;}
                if(files!=null)files.onReceiveValue(null);files=cb;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("*/*");intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"video/*","audio/*","image/*"});intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
                try{startActivityForResult(intent,44);}catch(ActivityNotFoundException e){files.onReceiveValue(null);files=null;}
                return true;
            }
            @Override public void onPermissionRequest(PermissionRequest request){
                runOnUiThread(()->{
                    if(!sameOrigin(request.getOrigin())){request.deny();return;}
                    if(media!=null)media.deny();media=request;
                    ArrayList<String> resources=new ArrayList<>(),permissions=new ArrayList<>();
                    for(String r:request.getResources()){
                        if(PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)){resources.add(r);permissions.add(Manifest.permission.CAMERA);}
                        if(PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)){resources.add(r);permissions.add(Manifest.permission.RECORD_AUDIO);}
                    }
                    requestedResources=resources.toArray(new String[0]);
                    if(permissions.isEmpty()){request.deny();media=null;return;}
                    requestPermissions(permissions.toArray(new String[0]),43);
                });
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request){if(media==request)media=null;}
        });
        setContentView(web);
        // Insets are native padding, preserving the web app's single scroll region.
        web.setOnApplyWindowInsetsListener((v,insets)->{
            if(Build.VERSION.SDK_INT>=30){android.graphics.Insets i=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.ime());v.setPadding(i.left,i.top,i.right,i.bottom);}
            return insets;
        });
        web.loadUrl(appURL+"?native=android");
        schedule(prefs.getBoolean("notifications",false));
    }
    @Override public void onRequestPermissionsResult(int request,String[] names,int[] results){
        super.onRequestPermissionsResult(request,names,results);
        if(request==43&&media!=null){
            boolean granted=results.length>0;for(int r:results)granted&=r==PackageManager.PERMISSION_GRANTED;
            if(granted&&sameOrigin(media.getOrigin()))media.grant(requestedResources);else media.deny();media=null;
        }
        if(request==45){boolean granted=results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED;prefs.edit().putBoolean("notifications",granted).apply();schedule(granted);connection();}
    }
    @Override protected void onActivityResult(int code,int result,Intent data){
        super.onActivityResult(code,result,data);
        if(code==44&&files!=null){
            ArrayList<Uri> out=new ArrayList<>();
            if(result==RESULT_OK&&data!=null){
                if(data.getClipData()!=null){for(int i=0;i<Math.min(10,data.getClipData().getItemCount());i++){Uri u=data.getClipData().getItemAt(i).getUri();if("content".equals(u.getScheme()))out.add(u);}}
                else if(data.getData()!=null&&"content".equals(data.getData().getScheme()))out.add(data.getData());
            }
            files.onReceiveValue(out.isEmpty()?null:out.toArray(new Uri[0]));files=null;
        }
    }
    @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else if(web!=null)connection();else super.onBackPressed();}
    @Override protected void onPause(){super.onPause();if(web!=null)web.onPause();CookieManager.getInstance().flush();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onDestroy(){if(media!=null)media.deny();if(files!=null)files.onReceiveValue(null);if(web!=null)web.destroy();super.onDestroy();}
}
