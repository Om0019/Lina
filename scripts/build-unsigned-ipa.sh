#!/usr/bin/env bash
# Builds an unsigned Lina.app -> Lina-unsigned.ipa for sideloading with
# SideStore (or similar). Run this on a Mac with Xcode + CocoaPods installed.
#
# Usage: ./scripts/build-unsigned-ipa.sh
# Run from the repo root (where package.json lives).

set -euo pipefail

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild not found — install Xcode from the App Store first." >&2
  exit 1
fi

if ! command -v pod >/dev/null 2>&1; then
  echo "CocoaPods not found — installing via gem (you may be prompted for your password)..." >&2
  sudo gem install cocoapods
fi

echo "==> Installing JS dependencies"
npm install

echo "==> Generating native iOS project (expo prebuild)"
npx expo prebuild --platform ios

echo "==> Installing CocoaPods dependencies"
(cd ios && pod install)

SCHEME="Lina"
WORKSPACE="ios/${SCHEME}.xcworkspace"

if [ ! -d "$WORKSPACE" ]; then
  # Fall back to whatever .xcworkspace prebuild actually generated, in case
  # a future rename of app.config.ts's `name` changes the generated target.
  WORKSPACE=$(find ios -maxdepth 1 -name "*.xcworkspace" | head -n1)
  SCHEME=$(basename "$WORKSPACE" .xcworkspace)
fi

echo "==> Archiving ${WORKSPACE} unsigned"
rm -rf build
xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release \
  -archivePath build/Lina.xcarchive archive \
  CODE_SIGNING_ALLOWED=NO CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO

APP_PATH="build/Lina.xcarchive/Products/Applications/${SCHEME}.app"
if [ ! -d "$APP_PATH" ]; then
  APP_PATH=$(find "build/Lina.xcarchive/Products/Applications" -maxdepth 1 -name "*.app" | head -n1)
fi

echo "==> Packaging IPA"
rm -rf build/Payload
mkdir -p build/Payload
cp -r "$APP_PATH" build/Payload/
(cd build && zip -r ../Lina-unsigned.ipa Payload)

echo
echo "Done: $(pwd)/Lina-unsigned.ipa"
echo "Transfer this file to your iPhone (AirDrop/cable/cloud drive) and open it with SideStore."
