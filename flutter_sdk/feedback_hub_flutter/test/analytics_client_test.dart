// Copyright 2026 ThenApp. All rights reserved.

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:feedback_hub_flutter/feedback_hub_flutter.dart';

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
  });

  group('AnalyticsEvent', () {
    test('toJson produces expected keys including event_name and platform', () {
      const event = AnalyticsEvent(
        eventType: 'page_view',
        eventName: 'record_screen_opened',
        properties: {'screen': 'record_screen'},
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        appVersion: '0.1.0',
        platform: 'ios',
        timestamp: '2026-05-12T10:00:00.000Z',
      );

      final json = event.toJson();
      expect(json['event_type'], 'page_view');
      expect(json['event_name'], 'record_screen_opened');
      expect(json['properties'], {'screen': 'record_screen'});
      expect(
        json['session_id'],
        '550e8400-e29b-41d4-a716-446655440000',
      );
      expect(json['app_version'], '0.1.0');
      expect(json['platform'], 'ios');
      expect(json['timestamp'], '2026-05-12T10:00:00.000Z');
    });

    test('platform is omitted from JSON when null', () {
      const event = AnalyticsEvent(
        eventType: 'page_view',
        eventName: 'settings_opened',
        properties: const {},
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        appVersion: '1.0.0',
        timestamp: '2026-05-12T10:00:00.000Z',
      );

      final json = event.toJson();
      expect(json.containsKey('platform'), isFalse);
    });

    test('feature_use event serializes correctly', () {
      const event = AnalyticsEvent(
        eventType: 'feature_use',
        eventName: 'photo_add',
        properties: {'feature': 'photo', 'action': 'add'},
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        appVersion: '1.0.0',
        timestamp: '2026-05-12T10:00:00.000Z',
      );

      final json = event.toJson();
      expect(json['event_type'], 'feature_use');
      expect(json['event_name'], 'photo_add');
      expect(json['properties']['feature'], 'photo');
      expect(json['properties']['action'], 'add');
    });

    test('flow_step event serializes correctly', () {
      const event = AnalyticsEvent(
        eventType: 'flow_step',
        eventName: 'record_write_text',
        properties: {
          'flow': 'record',
          'step': 'write_text',
          'step_index': 1,
        },
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        appVersion: '1.0.0',
        timestamp: '2026-05-12T10:00:00.000Z',
      );

      final json = event.toJson();
      expect(json['event_type'], 'flow_step');
      expect(json['event_name'], 'record_write_text');
      expect(json['properties']['flow'], 'record');
      expect(json['properties']['step'], 'write_text');
      expect(json['properties']['step_index'], 1);
    });

    test('flow_complete event serializes correctly', () {
      const event = AnalyticsEvent(
        eventType: 'flow_complete',
        eventName: 'record_completed',
        properties: {'flow': 'record', 'total_steps': 4},
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        appVersion: '1.0.0',
        timestamp: '2026-05-12T10:00:00.000Z',
      );

      final json = event.toJson();
      expect(json['event_type'], 'flow_complete');
      expect(json['event_name'], 'record_completed');
      expect(json['properties']['flow'], 'record');
      expect(json['properties']['total_steps'], 4);
    });

    test('flow_drop event serializes correctly', () {
      const event = AnalyticsEvent(
        eventType: 'flow_drop',
        eventName: 'record_dropped_attach_photo',
        properties: {
          'flow': 'record',
          'drop_step': 'attach_photo',
          'drop_step_index': 2,
        },
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        appVersion: '1.0.0',
        timestamp: '2026-05-12T10:00:00.000Z',
      );

      final json = event.toJson();
      expect(json['event_type'], 'flow_drop');
      expect(json['event_name'], 'record_dropped_attach_photo');
      expect(json['properties']['drop_step'], 'attach_photo');
      expect(json['properties']['drop_step_index'], 2);
    });

    test('cold_start event serializes with duration_ms', () {
      const event = AnalyticsEvent(
        eventType: 'cold_start',
        eventName: 'cold_start',
        properties: {'duration_ms': 1250},
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        appVersion: '1.0.0',
        timestamp: '2026-05-12T10:00:00.000Z',
      );

      final json = event.toJson();
      expect(json['event_type'], 'cold_start');
      expect(json['event_name'], 'cold_start');
      expect(json['properties']['duration_ms'], 1250);
    });
  });

  group('AnalyticsClient', () {
    late _RequestLog log;
    late AnalyticsClient client;

    setUp(() {
      log = _RequestLog();
      client = AnalyticsClient(
        baseUrl: 'http://localhost:8080',
        httpClient: _StubClient(onRequest: log.add),
      );
      client.setSessionId('550e8400-e29b-41d4-a716-446655440000');
      client.setAppVersion('0.1.0');
      client.setPlatform('ios');
    });

    tearDown(() {
      client.dispose();
    });

    // ── Session ID (UUID v4) ───────────────────────────────────

    test('session ID is UUID v4 format with hyphens', () {
      final autoClient = AnalyticsClient(
        baseUrl: 'http://localhost:8080',
        httpClient: _StubClient(onRequest: log.add),
      );
      final id = autoClient.sessionId;
      // UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(id, matches(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'));
      autoClient.dispose();
    });

    test('session ID survives SharedPreferences init', () async {
      SharedPreferences.setMockInitialValues({
        'analytics_session_id': '00000000-0000-4000-a000-000000000001',
      });
      final prefs = await SharedPreferences.getInstance();
      final prefsClient = AnalyticsClient(
        baseUrl: 'http://localhost:8080',
        httpClient: _StubClient(onRequest: log.add),
        prefs: prefs,
      );
      expect(
        prefsClient.sessionId,
        '00000000-0000-4000-a000-000000000001',
      );
      prefsClient.dispose();
    });

    test('session ID is persisted when generated', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final prefsClient = AnalyticsClient(
        baseUrl: 'http://localhost:8080',
        httpClient: _StubClient(onRequest: log.add),
        prefs: prefs,
      );
      final id = prefsClient.sessionId;
      expect(id, matches(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'));

      // Verify it was saved to SharedPreferences
      expect(prefs.getString('analytics_session_id'), id);
      prefsClient.dispose();
    });

    test('setSessionId persists to SharedPreferences', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final prefsClient = AnalyticsClient(
        baseUrl: 'http://localhost:8080',
        prefs: prefs,
      );
      prefsClient.setSessionId('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
      expect(
        prefs.getString('analytics_session_id'),
        'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      );
      prefsClient.dispose();
    });

    // ── Opt-out (default) ──────────────────────────────────────

    test('events are dropped when opted out (default)', () async {
      client.trackPageView('record_screen');
      client.trackFeatureUse('photo', 'add');
      client.dispose();

      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(log.requests, isEmpty);
    });

    test('events are enqueued after setOptIn(true)', () async {
      client.setOptIn(true);
      client.trackPageView('record_screen');

      client.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(log.requests, isNotEmpty);

      final body =
          jsonDecode(log.requests.first.body) as Map<String, dynamic>;
      final events = body['events'] as List<dynamic>;
      expect(events.length, 1);
      expect(events[0]['event_type'], 'page_view');
    });

    test('setOptIn(false) stops enqueuing after being enabled', () async {
      client.setOptIn(true);
      client.trackPageView('screen_a');
      client.setOptIn(false);
      client.trackPageView('screen_b');

      client.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(log.requests, isNotEmpty);

      final body =
          jsonDecode(log.requests.first.body) as Map<String, dynamic>;
      final events = body['events'] as List<dynamic>;
      expect(events.length, 1);
      expect(events[0]['event_name'], 'screen_a_opened');
    });

    // ── Opt-out persistence (SharedPreferences) ───────────────

    test('opt-in state is restored from SharedPreferences', () async {
      SharedPreferences.setMockInitialValues({'analytics_opt_in': true});
      final prefs = await SharedPreferences.getInstance();
      final prefsClient = AnalyticsClient(
        baseUrl: 'http://localhost:8080',
        httpClient: _StubClient(onRequest: log.add),
        prefs: prefs,
      );
      prefsClient.setSessionId('550e8400-e29b-41d4-a716-446655440000');
      prefsClient.setAppVersion('0.1.0');
      expect(prefsClient.isOptedIn, isTrue);

      prefsClient.trackPageView('test');
      prefsClient.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(log.requests, isNotEmpty);
    });

    test('opt-in defaults to false when no SharedPreferences key', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final prefsClient = AnalyticsClient(
        baseUrl: 'http://localhost:8080',
        prefs: prefs,
      );
      expect(prefsClient.isOptedIn, isFalse);
      prefsClient.dispose();
    });

    test('setOptIn(true) persists to SharedPreferences', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final prefsClient = AnalyticsClient(
        baseUrl: 'http://localhost:8080',
        prefs: prefs,
      );
      prefsClient.setOptIn(true);
      expect(prefs.getBool('analytics_opt_in'), isTrue);
      prefsClient.dispose();
    });

    test('setOptIn(false) persists to SharedPreferences', () async {
      SharedPreferences.setMockInitialValues({'analytics_opt_in': true});
      final prefs = await SharedPreferences.getInstance();
      final prefsClient = AnalyticsClient(
        baseUrl: 'http://localhost:8080',
        prefs: prefs,
      );
      prefsClient.setOptIn(false);
      expect(prefs.getBool('analytics_opt_in'), isFalse);
      prefsClient.dispose();
    });

    // ── Event name construction ────────────────────────────────

    test('trackPageView produces event_name "{screen}_opened"', () async {
      client.setOptIn(true);
      client.trackPageView('history_screen', durationMs: 3400);

      client.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      final events = _lastEvents(log);
      expect(events.single['event_type'], 'page_view');
      expect(events.single['event_name'], 'history_screen_opened');
      expect(events.single['properties']['screen'], 'history_screen');
      expect(events.single['properties']['duration_ms'], 3400);
    });

    test('trackFeatureUse produces event_name "{feature}_{action}"', () async {
      client.setOptIn(true);
      client.trackFeatureUse('recording', 'start');

      client.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      final events = _lastEvents(log);
      expect(events.single['event_type'], 'feature_use');
      expect(events.single['event_name'], 'recording_start');
    });

    test('trackFlowStep produces event_name "{flow}_{step}"', () async {
      client.setOptIn(true);
      client.trackFlowStep('record', 'write_text', 1);

      client.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      final events = _lastEvents(log);
      expect(events.single['event_type'], 'flow_step');
      expect(events.single['event_name'], 'record_write_text');
    });

    test('trackFlowComplete produces event_name "{flow}_completed"', () async {
      client.setOptIn(true);
      client.trackFlowComplete('record', 4);

      client.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      final events = _lastEvents(log);
      expect(events.single['event_type'], 'flow_complete');
      expect(events.single['event_name'], 'record_completed');
    });

    test('trackFlowDrop produces event_name "{flow}_dropped_{step}"',
        () async {
      client.setOptIn(true);
      client.trackFlowDrop('record', 'attach_photo', 2);

      client.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      final events = _lastEvents(log);
      expect(events.single['event_type'], 'flow_drop');
      expect(events.single['event_name'], 'record_dropped_attach_photo');
    });

    test('trackAppOpen produces event_name "app_open"', () async {
      client.setOptIn(true);
      client.trackAppOpen();

      client.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      final events = _lastEvents(log);
      expect(events.single['event_type'], 'app_open');
      expect(events.single['event_name'], 'app_open');
    });

    test('trackAppClose produces event_name "app_close"', () async {
      client.setOptIn(true);
      client.trackAppClose();

      client.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      final events = _lastEvents(log);
      expect(events.single['event_type'], 'app_close');
      expect(events.single['event_name'], 'app_close');
    });

    test('trackColdStart produces event_name "cold_start"', () async {
      client.setOptIn(true);
      client.trackColdStart(1250);

      client.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      final events = _lastEvents(log);
      expect(events.single['event_type'], 'cold_start');
      expect(events.single['event_name'], 'cold_start');
    });

    test('trackCrash produces event_name "crash"', () async {
      client.setOptIn(true);
      client.trackCrash('NullPointerException at main.dart:42');

      client.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      final events = _lastEvents(log);
      expect(events.single['event_type'], 'crash');
      expect(events.single['event_name'], 'crash');
    });

    // ── Platform ───────────────────────────────────────────────

    test('platform is included in every event', () async {
      client.setOptIn(true);
      client.trackPageView('test');

      client.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      final events = _lastEvents(log);
      expect(events.single['platform'], 'ios');
    });

    test('setPlatform overrides value', () async {
      final customClient = AnalyticsClient(
        baseUrl: 'http://localhost:8080',
        httpClient: _StubClient(onRequest: log.add),
      );
      customClient.setSessionId('550e8400-e29b-41d4-a716-446655440000');
      customClient.setAppVersion('0.1.0');
      customClient.setPlatform('android');
      customClient.setOptIn(true);
      customClient.trackPageView('test');

      customClient.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      final events = _lastEvents(log);
      expect(events.single['platform'], 'android');
    });

    // ── Session ID in events ────────────────────────────────────

    test('session ID is included in every event', () async {
      client.setOptIn(true);
      client.trackPageView('test');

      client.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      final events = _lastEvents(log);
      expect(
        events.single['session_id'],
        '550e8400-e29b-41d4-a716-446655440000',
      );
    });

    test('auto-generated session ID is UUID v4 format', () async {
      final autoClient = AnalyticsClient(
        baseUrl: 'http://localhost:8080',
        httpClient: _StubClient(onRequest: log.add),
      );
      autoClient.setOptIn(true);
      autoClient.trackAppOpen();

      autoClient.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      final events = _lastEvents(log);
      final sid = events.single['session_id'] as String;
      expect(
        sid,
        matches(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
      );
    });

    // ── App version ────────────────────────────────────────────

    test('app_version is included in every event', () async {
      client.setOptIn(true);
      client.trackPageView('test');

      client.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      final events = _lastEvents(log);
      expect(events.single['app_version'], '0.1.0');
    });

    // ── Timestamp ──────────────────────────────────────────────

    test('timestamp is ISO 8601 format', () async {
      client.setOptIn(true);
      client.trackPageView('test');

      client.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      final events = _lastEvents(log);
      final timestamp = events.single['timestamp'] as String;
      expect(timestamp, contains('T'));
      expect(timestamp, endsWith('Z'));
      expect(DateTime.tryParse(timestamp), isNotNull);
    });

    // ── Batch flush ────────────────────────────────────────────

    test('flushes at 20 events', () async {
      client.setOptIn(true);
      for (var i = 0; i < 20; i++) {
        client.trackPageView('screen_$i');
      }

      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(log.requests, isNotEmpty);

      final body =
          jsonDecode(log.requests.first.body) as Map<String, dynamic>;
      final events = body['events'] as List<dynamic>;
      expect(events.length, 20);
    });

    test('posts to /analytics/events', () async {
      client.setOptIn(true);
      client.trackPageView('test');

      client.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      expect(log.requests, isNotEmpty);
      final url = log.requests.first.url;
      expect(url.path, '/analytics/events');
    });

    test('includes Content-Type application/json header', () async {
      client.setOptIn(true);
      client.trackPageView('test');

      client.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      expect(log.requests, isNotEmpty);
      expect(
        log.requests.first.headers['content-type'],
        'application/json',
      );
    });

    // ── Fire-and-forget ────────────────────────────────────────

    test('does not throw on HTTP failure (fire-and-forget)', () async {
      final errorLog = _RequestLog();
      final errorClient = AnalyticsClient(
        baseUrl: 'http://localhost:8080',
        httpClient: _StubClient(
          onRequest: errorLog.add,
          responseBuilder: (_) {
            throw Exception('Connection refused');
          },
        ),
      );
      errorClient.setSessionId('550e8400-e29b-41d4-a716-446655440000');
      errorClient.setAppVersion('0.1.0');
      errorClient.setOptIn(true);
      errorClient.trackPageView('test');

      await errorClient.dispose();
    });

    test('does not throw on server 500 (fire-and-forget)', () async {
      final errorClient = AnalyticsClient(
        baseUrl: 'http://localhost:8080',
        httpClient: _StubClient(
          responseBuilder: (_) => http.Response('Internal Server Error', 500),
        ),
      );
      errorClient.setSessionId('550e8400-e29b-41d4-a716-446655440000');
      errorClient.setAppVersion('0.1.0');
      errorClient.setOptIn(true);
      errorClient.trackPageView('test');

      await errorClient.dispose();
    });

    // ── Dispose ────────────────────────────────────────────────

    test('dispose flushes remaining events', () async {
      client.setOptIn(true);
      client.trackPageView('screen_1');
      client.trackPageView('screen_2');
      client.trackPageView('screen_3');

      await client.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      expect(log.requests, isNotEmpty);
      final body =
          jsonDecode(log.requests.first.body) as Map<String, dynamic>;
      final events = body['events'] as List<dynamic>;
      expect(events.length, 3);
    });
  });
}

// ── Helpers ─────────────────────────────────────────────────────

/// Extracts the events array from the last captured request body.
List<dynamic> _lastEvents(_RequestLog log) {
  final body = jsonDecode(log.requests.last.body) as Map<String, dynamic>;
  return body['events'] as List<dynamic>;
}

/// Records every request sent through the stub client.
class _RequestLog {
  final List<_LoggedRequest> requests = [];

  void add(http.BaseRequest request) {
    requests.add(
      _LoggedRequest(
        url: request.url,
        headers: request.headers,
        body: (request is http.Request) ? request.body : '',
      ),
    );
  }
}

class _LoggedRequest {
  final Uri url;
  final Map<String, String> headers;
  final String body;

  const _LoggedRequest({
    required this.url,
    required this.headers,
    required this.body,
  });
}

/// Minimal stub that passes requests to a user-supplied handler.
///
/// Two modes:
/// - [onRequest]: records every request (used for logging/assertion).
/// - [responseBuilder]: optionally returns a custom response; defaults to
///   201 `{"ok":true}`. If this callback throws, the stub returns a 0-status
///   response simulating a network error.
class _StubClient extends http.BaseClient {
  final void Function(http.BaseRequest)? _onRequest;
  final http.Response Function(http.BaseRequest)? _responseBuilder;

  _StubClient({
    void Function(http.BaseRequest)? onRequest,
    http.Response Function(http.BaseRequest)? responseBuilder,
  })  : _onRequest = onRequest,
        _responseBuilder = responseBuilder;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    _onRequest?.call(request);

    late final http.Response response;
    try {
      response = _responseBuilder?.call(request) ??
          http.Response('{"ok":true}', 201);
    } catch (_) {
      return http.StreamedResponse(
        Stream.value(const []),
        0,
        request: request,
      );
    }
    return http.StreamedResponse(
      Stream.value(response.bodyBytes),
      response.statusCode,
      contentLength: response.contentLength,
      headers: response.headers,
      request: request,
    );
  }
}
