// Copyright 2026 ThenApp. All rights reserved.

import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// A single analytics event with typed metadata.
///
/// Mirrors the FeedbackHub analytics event schema (JSONB column).
///
/// [eventType] is the category (e.g. `'page_view'`, `'feature_use'`).
/// [eventName] is the specific event identifier validated against the
/// backend `ALLOWED_EVENTS` whitelist (e.g. `'record_screen_opened'`,
/// `'photo_added'`).  **Must be present** — backend returns 422 without it.
@immutable
class AnalyticsEvent {
  final String eventType;
  final String eventName;
  final Map<String, dynamic> properties;
  final String sessionId;
  final String appVersion;
  final String? platform;
  final String timestamp;

  const AnalyticsEvent({
    required this.eventType,
    required this.eventName,
    required this.properties,
    required this.sessionId,
    required this.appVersion,
    this.platform,
    required this.timestamp,
  });

  Map<String, dynamic> toJson() => {
        'event_type': eventType,
        'event_name': eventName,
        'properties': properties,
        'session_id': sessionId,
        'app_version': appVersion,
        if (platform != null) 'platform': platform,
        'timestamp': timestamp,
      };
}

/// Naming helpers that construct [AnalyticsEvent.eventName] from typed
/// track-method parameters.  The backend `ALLOWED_EVENTS` whitelist validates
/// against these constructed names.
abstract final class _EventNames {
  static String pageView(String screenName) => '${screenName}_opened';
  static String featureUse(String feature, String action) =>
      '${feature}_$action';
  static String flowStep(String flow, String step) => '${flow}_$step';
  static String flowComplete(String flow) => '${flow}_completed';
  static String flowDrop(String flow, String step) => '${flow}_$step';
  static const appOpen = 'app_opened';
  static const appClose = 'app_close';
  static const coldStart = 'cold_start';
  static const crash = 'crash';
}

/// Privacy-first analytics client for FeedbackHub.
///
/// **Default OFF** — `setOptIn(true)` must be called by the host app after
/// the user explicitly enables analytics.  Until then, all `track*()` calls
/// are silently dropped.  When [SharedPreferences] is provided, the opt-in
/// state persists across app restarts.
///
/// **Anonymous session** — a UUID v4 session ID is generated on first use and
/// persisted in SharedPreferences.  No user identity is ever attached.
///
/// **Fire-and-forget** — events are batch-posted asynchronously; network
/// failures are silently swallowed so analytics never blocks the UI.
///
/// ```dart
/// final prefs = await SharedPreferences.getInstance();
/// final analytics = AnalyticsClient(
///   baseUrl: 'https://feedback.dreamful.life/api/v1',
///   prefs: prefs,
/// );
/// analytics.setAppVersion('0.2.0');
/// analytics.setOptIn(true);
/// analytics.trackPageView('record_screen');
/// ```
class AnalyticsClient {
  final String baseUrl;
  final http.Client _http;
  final SharedPreferences? _prefs;

  bool _optedOut = true;
  String? _sessionId;
  String? _appVersion;
  String? _platform;
  final List<AnalyticsEvent> _buffer = [];
  Timer? _flushTimer;
  bool _disposed = false;

  static const int _batchSize = 20;
  static const Duration _flushInterval = Duration(seconds: 30);

  static const String _optInKey = 'analytics_opt_in';
  static const String _sessionIdKey = 'analytics_session_id';

  /// Creates an analytics client.
  ///
  /// [baseUrl] is the FeedbackHub server root **including the API prefix**
  /// (e.g. `https://feedback.dreamful.life/api/v1`).  SDK appends
  /// `/analytics/events` to this.
  ///
  /// [prefs] enables persistence of opt-in state and session ID across app
  /// restarts.  Omit for testing.
  ///
  /// [httpClient] is exposed for testing. In production, omit to use the
  /// default [http.Client].
  AnalyticsClient({
    required this.baseUrl,
    http.Client? httpClient,
    SharedPreferences? prefs,
  })  : _http = httpClient ?? http.Client(),
        _prefs = prefs {
    _initFromPrefs();
    _startFlushTimer();
    _detectPlatform();
  }

  void _initFromPrefs() {
    if (_prefs == null) return;

    // Restore opt-in state — default OFF if never set.
    final optedIn = _prefs.getBool(_optInKey) ?? false;
    _optedOut = !optedIn;

    // Restore or generate session ID.
    final storedId = _prefs.getString(_sessionIdKey);
    if (storedId != null && storedId.isNotEmpty) {
      _sessionId = storedId;
    } else {
      _sessionId = _generateUuidV4();
      _prefs.setString(_sessionIdKey, _sessionId!);
    }
  }

  // ── Session ID ──────────────────────────────────────────────

  /// Sets the anonymous session ID (UUID v4).
  ///
  /// Call before the first event. If not set, a UUID v4 is auto-generated
  /// and persisted to SharedPreferences (when provided).
  void setSessionId(String id) {
    _sessionId = id;
    _prefs?.setString(_sessionIdKey, id);
  }

  /// Returns the current session ID, generating one if needed.
  String get sessionId {
    _sessionId ??= _generateUuidV4();
    return _sessionId!;
  }

  // ── App version ─────────────────────────────────────────────

  /// Sets the app version string included in every event.
  ///
  /// Call once during app startup (e.g. from [PackageInfo]).
  void setAppVersion(String version) {
    _appVersion = version;
  }

  // ── Platform ───────────────────────────────────────────────

  /// Overrides the auto-detected platform string.
  ///
  /// By default the SDK detects `'ios'`, `'android'`, `'macos'`, etc. from
  /// `dart:io`.  Call this to set a custom value (or in tests where
  /// `dart:io` may not be available).
  void setPlatform(String platform) {
    _platform = platform;
  }

  void _detectPlatform() {
    try {
      _platform = Platform.operatingSystem;
    } catch (_) {
      // Running in a test or environment without dart:io.
    }
  }

  // ── Opt-in / opt-out ────────────────────────────────────────

  /// Enables or disables event collection.
  ///
  /// Events are **dropped silently** when opted out. The host app must call
  /// `setOptIn(true)` after the user grants consent.
  ///
  /// When [SharedPreferences] is provided, the opt-in state is persisted
  /// and survives app restarts.
  void setOptIn(bool enabled) {
    _optedOut = !enabled;
    _prefs?.setBool(_optInKey, enabled);
  }

  /// Whether the user has opted in to analytics.
  bool get isOptedIn => !_optedOut;

  // ── Track methods (typed API — no free-form strings) ────────

  /// Track a page/screen view.
  ///
  /// [durationMs] optionally records how long the previous screen was visible.
  ///
  /// Event name: `'{screenName}_opened'` (e.g. `'record_screen_opened'`).
  void trackPageView(String screenName, {int? durationMs}) {
    _enqueue(
      AnalyticsEvent(
        eventType: 'page_view',
        eventName: _EventNames.pageView(screenName),
        properties: {
          'screen': screenName,
          if (durationMs != null) 'duration_ms': durationMs,
        },
        sessionId: sessionId,
        appVersion: _appVersion ?? 'unknown',
        platform: _platform,
        timestamp: _now(),
      ),
    );
  }

  /// Track a feature interaction (e.g. photo added, recording started).
  ///
  /// Event name: `'{feature}_{action}'` (e.g. `'photo_added'`).
  ///
  /// **Convention**: [action] should use past tense (`'added'`, `'started'`,
  /// `'saved'`, `'deleted'`) to match the backend naming convention.
  void trackFeatureUse(String feature, String action) {
    _enqueue(
      AnalyticsEvent(
        eventType: 'feature_use',
        eventName: _EventNames.featureUse(feature, action),
        properties: {
          'feature': feature,
          'action': action,
        },
        sessionId: sessionId,
        appVersion: _appVersion ?? 'unknown',
        platform: _platform,
        timestamp: _now(),
      ),
    );
  }

  /// Track a step within a multi-step flow.
  ///
  /// Event name: `'{flow}_{step}'` (e.g. `'record_write_text'`).
  void trackFlowStep(String flow, String step, int stepIndex) {
    _enqueue(
      AnalyticsEvent(
        eventType: 'flow_step',
        eventName: _EventNames.flowStep(flow, step),
        properties: {
          'flow': flow,
          'step': step,
          'step_index': stepIndex,
        },
        sessionId: sessionId,
        appVersion: _appVersion ?? 'unknown',
        platform: _platform,
        timestamp: _now(),
      ),
    );
  }

  /// Track successful completion of a multi-step flow.
  ///
  /// Event name: `'{flow}_completed'` (e.g. `'record_completed'`).
  void trackFlowComplete(String flow, int totalSteps) {
    _enqueue(
      AnalyticsEvent(
        eventType: 'flow_complete',
        eventName: _EventNames.flowComplete(flow),
        properties: {
          'flow': flow,
          'total_steps': totalSteps,
        },
        sessionId: sessionId,
        appVersion: _appVersion ?? 'unknown',
        platform: _platform,
        timestamp: _now(),
      ),
    );
  }

  /// Track where a user dropped off in a multi-step flow.
  ///
  /// Event name: `'{flow}_{dropStep}'` (e.g. `'record_screen_dismissed_without_save'`).
  void trackFlowDrop(String flow, String dropStep, int dropStepIndex) {
    _enqueue(
      AnalyticsEvent(
        eventType: 'flow_drop',
        eventName: _EventNames.flowDrop(flow, dropStep),
        properties: {
          'flow': flow,
          'drop_step': dropStep,
          'drop_step_index': dropStepIndex,
        },
        sessionId: sessionId,
        appVersion: _appVersion ?? 'unknown',
        platform: _platform,
        timestamp: _now(),
      ),
    );
  }

  /// Track app open (foreground).
  ///
  /// Event name: `'app_open'`.
  void trackAppOpen() {
    _enqueue(
      AnalyticsEvent(
        eventType: 'app_open',
        eventName: _EventNames.appOpen,
        properties: const {},
        sessionId: sessionId,
        appVersion: _appVersion ?? 'unknown',
        platform: _platform,
        timestamp: _now(),
      ),
    );
  }

  /// Track app close (background / terminate).
  ///
  /// Event name: `'app_close'`.
  void trackAppClose() {
    _enqueue(
      AnalyticsEvent(
        eventType: 'app_close',
        eventName: _EventNames.appClose,
        properties: const {},
        sessionId: sessionId,
        appVersion: _appVersion ?? 'unknown',
        platform: _platform,
        timestamp: _now(),
      ),
    );
  }

  /// Track cold start duration in milliseconds.
  ///
  /// Event name: `'cold_start'`.
  void trackColdStart(int durationMs) {
    _enqueue(
      AnalyticsEvent(
        eventType: 'cold_start',
        eventName: _EventNames.coldStart,
        properties: {'duration_ms': durationMs},
        sessionId: sessionId,
        appVersion: _appVersion ?? 'unknown',
        platform: _platform,
        timestamp: _now(),
      ),
    );
  }

  /// Track an app crash with the error message.
  ///
  /// Event name: `'crash'`.
  void trackCrash(String? error) {
    _enqueue(
      AnalyticsEvent(
        eventType: 'crash',
        eventName: _EventNames.crash,
        properties: {'error': error ?? 'unknown'},
        sessionId: sessionId,
        appVersion: _appVersion ?? 'unknown',
        platform: _platform,
        timestamp: _now(),
      ),
    );
  }

  // ── Internal ─────────────────────────────────────────────────

  void _enqueue(AnalyticsEvent event) {
    if (_optedOut || _disposed) return;
    _buffer.add(event);
    if (_buffer.length >= _batchSize) {
      _flush();
    }
  }

  Future<void> _flush() async {
    if (_buffer.isEmpty) return;
    final batch = List<AnalyticsEvent>.from(_buffer);
    _buffer.clear();

    // Fire-and-forget — never throw, never block the caller.
    _postBatch(batch);
  }

  Future<void> _postBatch(List<AnalyticsEvent> batch) async {
    try {
      await _http.post(
        Uri.parse('$baseUrl/analytics/events'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'events': batch.map((e) => e.toJson()).toList(),
        }),
      );
    } catch (_) {
      // Fire-and-forget: silently ignore network errors, server errors,
      // and serialization failures so analytics never blocks the UI.
    }
  }

  void _startFlushTimer() {
    _flushTimer = Timer.periodic(_flushInterval, (_) {
      _flush();
    });
  }

  /// Flushes remaining events and releases resources.
  ///
  /// Must be called when the client is no longer needed (e.g. app shutdown).
  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    _flushTimer?.cancel();
    _flushTimer = null;
    // Synchronously flush — we use the internal postBatch which is
    // fire-and-forget.
    if (_buffer.isNotEmpty) {
      final batch = List<AnalyticsEvent>.from(_buffer);
      _buffer.clear();
      await _postBatch(batch);
    }
    _http.close();
  }

  // ── Helpers ──────────────────────────────────────────────────

  /// Generates a UUID v4 string (xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx).
  ///
  /// Self-contained — no `uuid` package dependency.
  String _generateUuidV4() {
    final r = Random();
    String hex(int count) =>
        List.generate(count, (_) => r.nextInt(16).toRadixString(16)).join();
    // variant: 8, 9, a, or b
    final variant = (8 + r.nextInt(4)).toRadixString(16);
    return '${hex(8)}-${hex(4)}-4${hex(3)}-$variant${hex(3)}-${hex(12)}';
  }

  String _now() => DateTime.now().toUtc().toIso8601String();
}
