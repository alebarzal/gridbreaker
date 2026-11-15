package com.alebarzal.gridbreaker;

import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Descarga el APK de una actualización dentro de la app, informando del
 * progreso, y abre el instalador del sistema.
 */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {

    private static final String ALLOWED_PREFIX = "https://github.com/";
    private volatile boolean busy = false;

    private File apkFile() {
        return new File(getContext().getCacheDir(), "update.apk");
    }

    private void emit(long received, long total) {
        JSObject p = new JSObject();
        p.put("received", received);
        p.put("total", total);
        notifyListeners("progress", p);
    }

    @PluginMethod
    public void download(final PluginCall call) {
        final String url = call.getString("url");
        // Solo se aceptan descargas de las releases de GitHub.
        if (url == null || !url.startsWith(ALLOWED_PREFIX)) {
            call.reject("URL no permitida");
            return;
        }
        if (busy) {
            call.reject("Ya hay una descarga en curso");
            return;
        }
        busy = true;
        new Thread(() -> {
            File out = apkFile();
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.connect();
                int code = conn.getResponseCode();
                if (code != 200) throw new IOException("HTTP " + code);
                long total = conn.getContentLengthLong();
                long received = 0;
                long last = 0;
                try (InputStream in = conn.getInputStream(); FileOutputStream fo = new FileOutputStream(out)) {
                    byte[] buf = new byte[32768];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        fo.write(buf, 0, n);
                        received += n;
                        long now = System.currentTimeMillis();
                        if (now - last > 80) {
                            last = now;
                            emit(received, total);
                        }
                    }
                }
                if (total > 0 && received != total) throw new IOException("Descarga incompleta");
                emit(received, total);
                JSObject res = new JSObject();
                res.put("bytes", received);
                call.resolve(res);
            } catch (Exception e) {
                //noinspection ResultOfMethodCallIgnored
                out.delete();
                call.reject("No se pudo descargar: " + e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
                busy = false;
            }
        }).start();
    }

    @PluginMethod
    public void install(PluginCall call) {
        File apk = apkFile();
        if (!apk.exists()) {
            call.reject("No hay ninguna actualización descargada");
            return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo abrir el instalador: " + e.getMessage());
        }
    }
}
