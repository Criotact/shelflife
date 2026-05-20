#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "🚀 Starting Full Android Build & Install"
echo "=============================================="

echo "📦 1/4 Building frontend web assets..."
npm run build

echo "🔄 2/4 Syncing assets to Capacitor Android project..."
npx cap sync

echo "🏗️ 3/4 Compiling Android APK with Gradle..."
# Run gradle wrapper from android folder
(cd android && ./gradlew assembleDebug)

APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"

if [ -f "$APK_PATH" ]; then
    echo "✅ APK successfully built at: $APK_PATH"
else
    echo "❌ APK build failed (output file not found)."
    exit 1
fi

echo "📲 4/4 Attempting to install APK via ADB..."
if command -v adb >/dev/null 2>&1; then
    # Check if any devices/emulators are connected
    DEVICES=$(adb devices | grep -v "List" | grep "device" || true)
    if [ -z "$DEVICES" ]; then
        echo "⚠️ No connected Android devices or emulators found."
        echo "Please connect a device via USB or start an emulator, then run:"
        echo "  adb install -r $APK_PATH"
    else
        echo "Installing APK to connected device..."
        adb install -r "$APK_PATH"
        echo "🎉 APK successfully installed!"
    fi
else
    echo "⚠️ 'adb' command not found in your PATH."
    echo "Please install Android platform-tools or add 'adb' to your PATH to enable automatic installation."
    echo "Once adb is set up, you can install the APK manually using:"
    echo "  adb install -r $APK_PATH"
fi

echo "=============================================="
echo "🏁 Build script finished."
echo "=============================================="
