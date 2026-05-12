import 'package:flutter_test/flutter_test.dart';
import 'package:feedback_hub_flutter/feedback_hub_flutter.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

void main() {
  group('FeedbackClient', () {
    test('createThread returns Thread on 201', () async {
      final client = FeedbackClient(
        baseUrl: 'http://localhost:8080',
        reporterId: 'test-reporter',
        httpClient: _StubClient((request) {
          return http.Response(
            jsonEncode({
              'id': 'thread-1',
              'status': 'received',
              'summary': 'test',
              'latest_public_message_at': '2026-05-02T00:00:00Z',
              'created_at': '2026-05-02T00:00:00Z',
            }),
            201,
          );
        }),
      );

      final thread = await client.createThread(
        category: 'feedback',
        summary: 'test',
        message: 'hello',
      );

      expect(thread.id, 'thread-1');
      expect(thread.status, 'received');
    });

    test('listThreads returns paginated threads', () async {
      final client = FeedbackClient(
        baseUrl: 'http://localhost:8080',
        reporterId: 'test-reporter',
        httpClient: _StubClient((request) {
          return http.Response(
            jsonEncode({
              'threads': [
                {
                  'id': 't1',
                  'status': 'received',
                  'summary': 'test',
                  'latest_public_message_at': null,
                  'created_at': '2026-05-02T00:00:00Z',
                },
              ],
              'total': 1,
              'page': 1,
              'page_size': 20,
              'total_pages': 1,
            }),
            200,
          );
        }),
      );

      final paginated = await client.listThreads();
      expect(paginated.threads.length, 1);
      expect(paginated.threads.first.id, 't1');
      expect(paginated.total, 1);
    });

    test('addMessage returns Message on 201', () async {
      final client = FeedbackClient(
        baseUrl: 'http://localhost:8080',
        reporterId: 'test-reporter',
        httpClient: _StubClient((request) {
          return http.Response(
            jsonEncode({
              'id': 'msg-1',
              'thread_id': 'thread-1',
              'author_type': 'reporter',
              'body': 'follow up',
              'created_at': '2026-05-02T00:00:00Z',
            }),
            201,
          );
        }),
      );

      final message = await client.addMessage(
        threadId: 'thread-1',
        body: 'follow up',
      );

      expect(message.id, 'msg-1');
      expect(message.threadId, 'thread-1');
      expect(message.authorType, 'reporter');
    });

    test('throws FeedbackException on non-2xx', () async {
      final client = FeedbackClient(
        baseUrl: 'http://localhost:8080',
        reporterId: 'test-reporter',
        httpClient: _StubClient((request) {
          return http.Response('Not Found', 404);
        }),
      );

      expect(
        () => client.listThreads(),
        throwsA(isA<FeedbackException>()),
      );
    });
  });

  group('ContextSnapshot', () {
    test('toJson produces expected keys', () {
      const snapshot = ContextSnapshot(
        appVersion: '1.0.0',
        osName: 'iOS',
        osVersion: '17.4',
        deviceModel: 'iPhone15,2',
        locale: 'zh_CN',
        currentRoute: '/settings',
      );

      final json = snapshot.toJson();
      expect(json['app_version'], '1.0.0');
      expect(json['os_name'], 'iOS');
      expect(json['os_version'], '17.4');
      expect(json['device_model'], 'iPhone15,2');
      expect(json['locale'], 'zh_CN');
      expect(json['current_route'], '/settings');
    });
  });

  group('Thread', () {
    test('fromJson parses full payload', () {
      final json = {
        'id': 't1',
        'status': 'received',
        'summary': 'summary',
        'latest_public_message_at': '2026-05-02T00:00:00Z',
        'created_at': '2026-05-02T00:00:00Z',
      };
      final thread = Thread.fromJson(json);
      expect(thread.id, 't1');
      expect(thread.status, 'received');
      expect(thread.latestPublicMessageAt, '2026-05-02T00:00:00Z');
    });
  });
}

/// Minimal stub that passes requests to a user-supplied handler.
class _StubClient extends http.BaseClient {
  final http.Response Function(http.BaseRequest) _handler;
  _StubClient(this._handler);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final response = _handler(request);
    return http.StreamedResponse(
      Stream.value(response.bodyBytes),
      response.statusCode,
      contentLength: response.contentLength,
      headers: response.headers,
      request: request,
    );
  }
}
