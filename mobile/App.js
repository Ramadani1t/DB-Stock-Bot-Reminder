import React, {useState, useEffect, useRef} from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  BackHandler,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  Vibration,
  ToastAndroid,
} from 'react-native';
import {WebView} from 'react-native-webview';

// Endpoint Web POS Production Tahunya Krispi-ya!
const POS_URL = 'https://dstock.tahunyakrispiya.my.id/pos';

export default function App() {
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);

  // Request Android Camera Hardware Permission on Launch
  useEffect(() => {
    async function requestHardwarePermissions() {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          ]);

          const isCamOk =
            granted['android.permission.CAMERA'] ===
            PermissionsAndroid.RESULTS.GRANTED;
          setCameraGranted(isCamOk);
        } catch (err) {
          console.warn('Hardware permission request failed:', err);
        }
      } else {
        setCameraGranted(true);
      }
    }

    requestHardwarePermissions();
  }, []);

  // Handle messages from Web POS (Haptics, Exit, etc.)
  const handleMessage = event => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (!data) return;
      if (data.type === 'HAPTIC_CLICK') {
        Vibration.vibrate(25);
      } else if (data.type === 'ALLOW_EXIT') {
        BackHandler.exitApp();
      } else if (data.type === 'TOAST') {
        if (Platform.OS === 'android') {
          ToastAndroid.show(data.message || '', ToastAndroid.SHORT);
        }
      }
    } catch (e) {
      // Non-JSON message, ignore
    }
  };

  // Handle Android Physical / Virtual Back Button
  useEffect(() => {
    const onBackPress = () => {
      if (webViewRef.current) {
        // Send signal to webview to close open modals/drawers first!
        webViewRef.current.postMessage(JSON.stringify({ type: 'ANDROID_BACK' }));
        return true; // prevent immediate app exit
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress,
    );
    return () => backHandler.remove();
  }, []);

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f766e" />

      {/* Main Hardware Accelerated WebView */}
      <View style={styles.webContainer}>
        <WebView
          ref={webViewRef}
          source={{uri: POS_URL}}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          databaseEnabled={true}
          allowsInlineMediaPlayback={true}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          originWhitelist={['*']}
          mixedContentMode="always"
          mediaPlaybackRequiresUserAction={false}
          hardwareAcceleration={true}
          androidLayerType="hardware"
          cacheEnabled={true}
          cacheMode="LOAD_DEFAULT"
          userAgent="DStock-Android-POS/1.0 (Sat-Set Mobile Native Shell)"
          onMessage={handleMessage}
          onNavigationStateChange={navState => {
            setCanGoBack(navState.canGoBack);
          }}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => {
            setIsLoading(false);
            setHasError(false);
          }}
          onError={syntheticEvent => {
            const {nativeEvent} = syntheticEvent;
            console.warn('WebView error:', nativeEvent);
            setIsLoading(false);
            setHasError(true);
          }}
          // Auto grant camera capture in Android WebChromeClient
          onPermissionRequest={request => {
            request.grant(request.resources);
          }}
        />

        {/* Loading Spinner during initial cold start */}
        {isLoading && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" color="#0f766e" />
            <Text style={styles.loaderText}>Membuka DStock Kasir...</Text>
          </View>
        )}

        {/* Offline / Connection Error State */}
        {hasError && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorTitle}>Koneksi Terputus</Text>
            <Text style={styles.errorDesc}>
              Pastikan perangkat kasir terhubung ke internet atau Wi-Fi gerai.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryText}>Muat Ulang Kasir</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f766e',
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webView: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f766e',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 8,
  },
  errorDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#0f766e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 3,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
