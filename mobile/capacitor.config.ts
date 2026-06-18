import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.gamevalueradar.app",
  appName: "GameValue Radar",
  webDir: "dist",
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#070A12",
      showSpinner: false
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#070A12"
    }
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
