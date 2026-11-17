package dev.threatleveltheft.app;

import android.os.Bundle;
import android.view.KeyEvent;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // Empezar la partida con el mando no cuenta como gesto de usuario: sin esto no habría sonido
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    // Atrás: el juego decide (de partida a menú, cierra diálogos). Si no hay nada que cerrar, sale de la app.
    // El "atrás" de reserva que Android fabrica con el botón ○ de un mando se descarta: cerraría el juego.
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getKeyCode() != KeyEvent.KEYCODE_BACK) return super.dispatchKeyEvent(event);
        if ((event.getFlags() & KeyEvent.FLAG_FALLBACK) != 0) return true;
        if (event.getAction() == KeyEvent.ACTION_UP) {
            getBridge().getWebView().evaluateJavascript(
                "window.tvBack ? window.tvBack() : false",
                handled -> { if (!"true".equals(handled)) finish(); }
            );
        }
        return true;
    }

    private void hideSystemBars() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
