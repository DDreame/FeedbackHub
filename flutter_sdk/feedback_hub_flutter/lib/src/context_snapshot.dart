import 'dart:io' show Platform;

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Auto-captured runtime context attached to every feedback thread.
///
/// Fields mirror FeedbackHub's ContextSnapshot schema.
class ContextSnapshot {
  final String appVersion;
  final String osName;
  final String osVersion;
  final String deviceModel;
  final String locale;
  final String currentRoute;

  const ContextSnapshot({
    required this.appVersion,
    required this.osName,
    required this.osVersion,
    required this.deviceModel,
    required this.locale,
    required this.currentRoute,
  });

  /// Captures runtime context from the device.
  ///
  /// [currentRoute] is provided by the caller (e.g. from NavigatorObserver)
  /// since the SDK does not hold a navigator key.
  ///
  /// All fields degrade to 'unknown' on failure so callers always get a
  /// best-effort snapshot — never a thrown exception.
  static Future<ContextSnapshot> capture({
    String currentRoute = '/',
  }) async {
    String appVersion = 'unknown';
    String osName = 'unknown';
    String osVersion = 'unknown';
    String deviceModel = 'unknown';
    String localeStr = 'unknown';

    try {
      final packageInfo = await PackageInfo.fromPlatform();
      appVersion = packageInfo.version;
    } catch (_) {}

    try {
      final deviceInfo = DeviceInfoPlugin();

      if (defaultTargetPlatform == TargetPlatform.iOS) {
        final iosInfo = await deviceInfo.iosInfo;
        osName = 'iOS';
        osVersion = iosInfo.systemVersion;
        deviceModel = iosInfo.utsname.machine;
      } else if (defaultTargetPlatform == TargetPlatform.android) {
        final androidInfo = await deviceInfo.androidInfo;
        osName = 'Android';
        osVersion = androidInfo.version.release;
        deviceModel = '${androidInfo.manufacturer} ${androidInfo.model}';
      } else {
        // Desktop / unknown — generic fallback
        osName = Platform.operatingSystem;
        osVersion = Platform.operatingSystemVersion;
        deviceModel = 'desktop';
      }
    } catch (_) {}

    // Locale from the platform dispatcher (nullable on desktop/test)
    try {
      final locale = PlatformDispatcher.instance.locale;
      if (locale != null) {
        localeStr = '${locale.languageCode}${locale.countryCode != null ? '_${locale.countryCode}' : ''}';
      }
    } catch (_) {}

    return ContextSnapshot(
      appVersion: appVersion,
      osName: osName,
      osVersion: osVersion,
      deviceModel: deviceModel,
      locale: localeStr,
      currentRoute: currentRoute,
    );
  }

  Map<String, dynamic> toJson() => {
        'app_version': appVersion,
        'os_name': osName,
        'os_version': osVersion,
        'device_model': deviceModel,
        'locale': locale,
        'current_route': currentRoute,
      };
}
