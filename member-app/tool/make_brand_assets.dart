// Turns the association's WebP emblem into the PNGs the icon and splash
// generators need.
//
// Run from member-app/:
//
//   dart run tool/make_brand_assets.dart
//
// It exists because `flutter_launcher_icons` and `flutter_native_splash` both
// read PNG and neither reads WebP, and because converting one on a developer
// machine otherwise means ImageMagick, cwebp or Pillow - a native toolchain
// this project would then have to require of everybody. The `image` package
// is pure Dart and already a dev dependency, so this runs anywhere Flutter
// does.
//
// Its outputs are COMMITTED. They change only when the artwork does, and a
// generator that has to run before the app can build is a trap for the next
// person.
import 'dart:io';

import 'package:image/image.dart';

/// The artwork, and where the generated files go.
const _source = 'assets/images/fttddwa-logo.webp';
const _outDir = 'assets/branding';

Future<void> main() async {
  final bytes = await File(_source).readAsBytes();
  final logo = decodeWebP(bytes);
  if (logo == null) {
    stderr.writeln('Could not decode $_source');
    exitCode = 1;
    return;
  }

  await Directory(_outDir).create(recursive: true);

  // 1. The square icon, flattened onto white.
  //
  // FLATTENED, not transparent: iOS rejects an App Store icon with an alpha
  // channel outright, and the artwork is drawn for a white background anyway.
  final icon = _onWhite(logo, 1024, inset: 0);
  await File('$_outDir/icon.png').writeAsBytes(encodePng(icon));

  // 2. The Android adaptive-icon foreground.
  //
  // Android masks an adaptive icon to a circle, a squircle or whatever the
  // launcher prefers, and crops roughly the outer quarter. The emblem is
  // itself a circle with text around its rim, so at full bleed that rim is
  // the first thing cut.
  //
  // 0.92, NOT the ~0.62 that the 66% safe zone suggests: flutter_launcher_icons
  // wraps this drawable in its own `android:inset="16%"`, which already shrinks
  // it to 68% of the canvas. Insetting twice put the emblem at 42% and left it
  // swimming in white. 0.92 x 0.68 lands just inside the safe zone, which is
  // where it should have been.
  //
  // Transparent here, with the white supplied as the background layer, which
  // is what lets the launcher animate the two independently.
  final foreground = _padded(logo, 1024, scale: 0.92);
  await File(
    '$_outDir/icon_foreground.png',
  ).writeAsBytes(encodePng(foreground));

  // 3. The splash image, for both themes.
  //
  // The light splash puts the emblem straight on white. The dark one needs
  // the white to travel WITH the emblem - the artwork has a white background
  // of its own, and on a dark screen a bare square of it reads as a hole - so
  // this one is the emblem on a white disc.
  final splash = _padded(logo, 768, scale: 0.86);
  await File('$_outDir/splash.png').writeAsBytes(encodePng(splash));

  final splashDark = _onWhiteDisc(logo, 768, scale: 0.78);
  await File('$_outDir/splash_dark.png').writeAsBytes(encodePng(splashDark));

  stdout.writeln('Wrote 4 files to $_outDir/ from $_source');
}

/// The emblem centred on an opaque white square.
Image _onWhite(Image src, int size, {double inset = 0.1}) {
  final canvas = Image(width: size, height: size, numChannels: 3);
  fill(canvas, color: ColorRgb8(255, 255, 255));
  _drawCentred(canvas, src, size, 1 - inset);
  return canvas;
}

/// The emblem centred on transparency, scaled into the safe zone.
Image _padded(Image src, int size, {required double scale}) {
  final canvas = Image(width: size, height: size, numChannels: 4);
  fill(canvas, color: ColorRgba8(0, 0, 0, 0));
  _drawCentred(canvas, src, size, scale);
  return canvas;
}

/// The emblem on an opaque white circle, on transparency.
Image _onWhiteDisc(Image src, int size, {required double scale}) {
  final canvas = Image(width: size, height: size, numChannels: 4);
  fill(canvas, color: ColorRgba8(0, 0, 0, 0));
  fillCircle(
    canvas,
    x: size ~/ 2,
    y: size ~/ 2,
    radius: size ~/ 2,
    color: ColorRgba8(255, 255, 255, 255),
  );
  _drawCentred(canvas, src, size, scale);
  return canvas;
}

/// Scales the emblem to `scale` of the canvas and composites it in the middle.
void _drawCentred(Image canvas, Image src, int size, double scale) {
  final target = (size * scale).round();
  final scaled = copyResize(
    src,
    width: target,
    height: target,
    interpolation: Interpolation.cubic,
  );
  final offset = (size - target) ~/ 2;
  compositeImage(canvas, scaled, dstX: offset, dstY: offset);
}
