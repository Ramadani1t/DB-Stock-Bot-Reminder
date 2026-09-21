package com.dstock.pos;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "DStockMobile";
    private static final String POS_URL = "https://dstock.tahunyakrispiya.my.id/pos";
    private static final int PERMISSION_REQ_CAMERA = 1001;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private ActivityResultLauncher<Intent> hardwareCameraLauncher;
    private ActivityResultLauncher<Intent> fileChooserLauncher;

    private Uri cameraPhotoUri = null;
    private File cameraPhotoFile = null;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Immersive status & navigation bar
        getWindow().setStatusBarColor(0xFF0F766E);
        getWindow().setNavigationBarColor(0xFF0F766E);

        setContentView(R.layout.activity_main);

        setupLaunchers();

        webView = findViewById(R.id.webView);
        configureWebView();
        requestHardwarePermissions();

        // Android Physical & Virtual Back Button Interception
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null) {
                    webView.evaluateJavascript(
                        "(function(){ if(window.handleAndroidBack && typeof window.handleAndroidBack === 'function'){ return window.handleAndroidBack(); } return false; })()",
                        value -> {
                            if (!"true".equals(value)) {
                                if (webView.canGoBack()) {
                                    webView.goBack();
                                } else {
                                    finish();
                                }
                            }
                        }
                    );
                } else {
                    finish();
                }
            }
        });

        webView.loadUrl(POS_URL);
    }

    private void setupLaunchers() {
        // Full-Resolution Native Hardware Rear Camera Launcher
        hardwareCameraLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == Activity.RESULT_OK && cameraPhotoFile != null && cameraPhotoFile.exists()) {
                    new Thread(() -> {
                        final String dataUrl = processPhotoFileToDataUrl(cameraPhotoFile);
                        runOnUiThread(() -> {
                            if (dataUrl != null && webView != null) {
                                webView.evaluateJavascript(
                                    "(function(){ if(window.onHardwareCameraCapture){ window.onHardwareCameraCapture('" + dataUrl + "'); } })()",
                                    null
                                );
                            } else {
                                Toast.makeText(MainActivity.this, "Gagal memproses foto kamera", Toast.LENGTH_SHORT).show();
                            }
                        });
                    }).start();
                } else {
                    Log.d(TAG, "Hardware camera cancelled or file missing");
                }
            }
        );

        // Native File/Camera Chooser Launcher for Web inputs
        fileChooserLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (filePathCallback != null) {
                    Uri[] results = null;
                    if (result.getResultCode() == Activity.RESULT_OK) {
                        Intent data = result.getData();
                        if (data != null && data.getData() != null) {
                            results = new Uri[]{data.getData()};
                        } else if (cameraPhotoUri != null && cameraPhotoFile != null && cameraPhotoFile.exists() && cameraPhotoFile.length() > 0) {
                            results = new Uri[]{cameraPhotoUri};
                        }
                    }
                    filePathCallback.onReceiveValue(results);
                    filePathCallback = null;
                }
            }
        );
    }

    /**
     * Buat Intent Kamera Hardware yang langsung mengunci KAMERA BELAKANG secara hardware-level via Bundle extras
     * dan menyimpan ke FileProvider resolusi penuh (HD).
     */
    private Intent createHardwareCameraIntent() {
        try {
            String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date());
            File storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
            if (storageDir == null) storageDir = getCacheDir();

            cameraPhotoFile = File.createTempFile("DSTOCK_CAM_" + timeStamp + "_", ".jpg", storageDir);
            cameraPhotoUri = FileProvider.getUriForFile(
                this,
                getPackageName() + ".fileprovider",
                cameraPhotoFile
            );

            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri);

            // Paksa kamera belakang secara hardware-level via Bundle extras
            intent.putExtra("android.intent.extra.USE_FRONT_CAMERA", false);
            intent.putExtra("android.intent.extra.CAMERA_FACING", 0); // 0 = Back, 1 = Front
            intent.putExtra("android.intent.extras.CAMERA_FACING", 0);
            intent.putExtra("android.intent.extras.LENS_FACING_FRONT", 0);

            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            return intent;
        } catch (Exception e) {
            Log.e(TAG, "Error creating camera intent", e);
            return null;
        }
    }

    /**
     * Kompresi dan auto-rotasi gambar resolusi penuh ke format HD jernih (maksimal sisi 1280px, JPEG 85%).
     */
    private String processPhotoFileToDataUrl(File photoFile) {
        try {
            // 1. Decode bounds
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(photoFile.getAbsolutePath(), options);

            int srcWidth = options.outWidth;
            int srcHeight = options.outHeight;
            if (srcWidth <= 0 || srcHeight <= 0) return null;

            // 2. Hitung sub-sampling
            int maxDimension = 1280;
            int inSampleSize = 1;
            int maxSrc = Math.max(srcWidth, srcHeight);
            while (maxSrc / (inSampleSize * 2) >= maxDimension) {
                inSampleSize *= 2;
            }

            options.inJustDecodeBounds = false;
            options.inSampleSize = inSampleSize;
            options.inPreferredConfig = Bitmap.Config.RGB_565;

            Bitmap bitmap = BitmapFactory.decodeFile(photoFile.getAbsolutePath(), options);
            if (bitmap == null) return null;

            // 3. Periksa EXIF orientation
            int rotationAngle = 0;
            try {
                ExifInterface exif = new ExifInterface(photoFile.getAbsolutePath());
                int orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
                switch (orientation) {
                    case ExifInterface.ORIENTATION_ROTATE_90:
                        rotationAngle = 90;
                        break;
                    case ExifInterface.ORIENTATION_ROTATE_180:
                        rotationAngle = 180;
                        break;
                    case ExifInterface.ORIENTATION_ROTATE_270:
                        rotationAngle = 270;
                        break;
                }
            } catch (Exception ignored) {}

            // 4. Skala dan rotasi akhir ke max 1280px
            int finalWidth = bitmap.getWidth();
            int finalHeight = bitmap.getHeight();
            float scale = 1.0f;
            int maxFinal = Math.max(finalWidth, finalHeight);
            if (maxFinal > maxDimension) {
                scale = (float) maxDimension / (float) maxFinal;
            }

            Matrix matrix = new Matrix();
            if (scale < 1.0f) {
                matrix.postScale(scale, scale);
            }
            if (rotationAngle != 0) {
                matrix.postRotate(rotationAngle);
            }

            Bitmap processedBitmap = Bitmap.createBitmap(bitmap, 0, 0, finalWidth, finalHeight, matrix, true);
            if (processedBitmap != bitmap) {
                bitmap.recycle();
            }

            // 5. Kompresi ke JPEG kualitas 85
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            processedBitmap.compress(Bitmap.CompressFormat.JPEG, 85, outputStream);
            processedBitmap.recycle();

            byte[] byteArray = outputStream.toByteArray();
            String base64 = Base64.encodeToString(byteArray, Base64.NO_WRAP);

            // Bersihkan file sementara
            try { photoFile.delete(); } catch (Exception ignored) {}

            return "data:image/jpeg;base64," + base64;
        } catch (Exception e) {
            Log.e(TAG, "Error processing photo file", e);
            return null;
        }
    }

    private boolean isNetworkAvailable() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) {
                NetworkInfo netInfo = cm.getActiveNetworkInfo();
                return netInfo != null && netInfo.isConnected();
            }
        } catch (Exception ignored) {}
        return false;
    }

    private String buildOfflinePage() {
        return "<!doctype html><html lang=\"id\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>DStock Kasir</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0f172a;color:#f8fafc;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center;gap:16px}.logo{width:72px;height:72px;background:linear-gradient(135deg,#0d9488,#0f766e);border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:900;color:#fff}h1{color:#2dd4bf;font-size:22px;font-weight:800}p{color:#94a3b8;font-size:14px;max-width:300px;line-height:1.5}button{background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;border:none;border-radius:14px;padding:14px 28px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px;box-shadow:0 4px 12px rgba(13,148,136,.3)}</style></head><body><div class=\"logo\">D</div><h1>DStock Kasir</h1><p>Sedang offline / tidak ada koneksi internet. Sambungkan ke Wi-Fi gerai atau data seluler untuk membuka kasir pertama kali.</p><button onclick=\"location.reload()\">Muat Ulang Kasir</button></body></html>";
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUserAgentString(settings.getUserAgentString() + " DStock-Android13-POS/1.0 NativeHardwareCamera");

        // Offline-first caching: Gunakan cache saat offline
        if (isNetworkAvailable()) {
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        } else {
            settings.setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
        }

        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.evaluateJavascript(
                    "(function(){\n" +
                    "  window.__isAndroidApp = true;\n" +
                    "  console.log('[DStock Mobile] Hardware camera bridge active');\n" +
                    "})()",
                    null
                );
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    if (!isNetworkAvailable()) {
                        try {
                            view.getSettings().setCacheMode(WebSettings.LOAD_CACHE_ONLY);
                            view.loadUrl(POS_URL);
                        } catch (Exception e) {
                            view.loadDataWithBaseURL(null, buildOfflinePage(), "text/html", "UTF-8", null);
                        }
                    } else {
                        view.loadDataWithBaseURL(null, buildOfflinePage(), "text/html", "UTF-8", null);
                    }
                }
            }
        });

        // WebChromeClient with auto camera permission and hardware file chooser
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    // Otomatis izinkan akses kamera untuk getUserMedia / Live WebRTC scanner
                    request.grant(request.getResources());
                });
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent cameraIntent = createHardwareCameraIntent();

                // Jika HTML meminta capture kamera secara langsung
                if (fileChooserParams.isCaptureEnabled() && cameraIntent != null) {
                    fileChooserLauncher.launch(cameraIntent);
                    return true;
                }

                Intent contentSelectionIntent = new Intent(Intent.ACTION_GET_CONTENT);
                contentSelectionIntent.addCategory(Intent.CATEGORY_OPENABLE);
                contentSelectionIntent.setType("image/*");

                Intent chooserIntent = new Intent(Intent.ACTION_CHOOSER);
                chooserIntent.putExtra(Intent.EXTRA_INTENT, contentSelectionIntent);
                chooserIntent.putExtra(Intent.EXTRA_TITLE, "Pilih Foto Struk atau Ambil Kamera Belakang");

                if (cameraIntent != null) {
                    chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
                }

                fileChooserLauncher.launch(chooserIntent);
                return true;
            }
        });

        // JavaScript Interface bridge
        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidBridge");
    }

    private void requestHardwarePermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                new String[]{Manifest.permission.CAMERA},
                PERMISSION_REQ_CAMERA
            );
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQ_CAMERA) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                if (webView != null) webView.reload();
            }
        }
    }

    public class WebAppInterface {
        private final Context mContext;

        WebAppInterface(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public void openHardwareCamera() {
            runOnUiThread(() -> {
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                        != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(
                        MainActivity.this,
                        new String[]{Manifest.permission.CAMERA},
                        PERMISSION_REQ_CAMERA
                    );
                } else {
                    Intent intent = createHardwareCameraIntent();
                    if (intent != null) {
                        hardwareCameraLauncher.launch(intent);
                    } else {
                        Toast.makeText(MainActivity.this, "Gagal menyiapkan kamera belakang", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void vibrate(int durationMs) {
            Vibrator vibrator = (Vibrator) mContext.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vibrator.vibrate(durationMs);
                }
            }
        }

        @JavascriptInterface
        public void toast(String message) {
            Toast.makeText(mContext, message, Toast.LENGTH_SHORT).show();
        }

        @JavascriptInterface
        public boolean isAndroidApp() {
            return true;
        }
    }
}
