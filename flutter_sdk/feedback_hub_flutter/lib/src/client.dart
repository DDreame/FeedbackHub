import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';

/// HTTP client for the FeedbackHub REST API.
///
/// Usage:
/// ```dart
/// final client = FeedbackClient(
///   baseUrl: 'https://feedback.dreamful.life',
///   reporterId: identityHash,
/// );
/// final thread = await client.createThread(
///   category: 'feedback',
///   summary: '按钮点击无响应',
///   message: '在设置页面点击保存按钮没有反应',
/// );
/// ```
class FeedbackClient {
  final String baseUrl;
  final String reporterId;
  final http.Client _http;

  FeedbackClient({
    required this.baseUrl,
    required this.reporterId,
    http.Client? httpClient,
  }) : _http = httpClient ?? http.Client();

  /// Creates a new feedback thread with the first message atomically.
  Future<Thread> createThread({
    required String category,
    required String summary,
    required String message,
    Map<String, dynamic>? context,
  }) async {
    final response = await _http.post(
      Uri.parse('$baseUrl/v1/feedback/threads/atomic'),
      headers: _headers,
      body: jsonEncode({
        'category': category,
        'summary': summary,
        'initial_message': message,
        'context': context,
      }),
    );
    _ensureOK(response);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Thread.fromJson(data);
  }

  /// Lists the current user's feedback threads.
  Future<PaginatedThreads> listThreads({
    int page = 1,
    int pageSize = 20,
  }) async {
    final uri = Uri.parse('$baseUrl/v1/feedback/threads')
        .replace(queryParameters: {
      'page': page.toString(),
      'page_size': pageSize.toString(),
    });
    final response = await _http.get(uri, headers: _headers);
    _ensureOK(response);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return PaginatedThreads.fromJson(data);
  }

  /// Returns an unread-summary for all feedback threads.
  ///
  /// A single lightweight query that tells the caller whether any thread has
  /// an unseen developer reply (and which threads).
  Future<UnreadSummary> getUnreadSummary() async {
    final response = await _http.get(
      Uri.parse('$baseUrl/v1/feedback/unread-summary'),
      headers: _headers,
    );
    _ensureOK(response);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return UnreadSummary.fromJson(data);
  }

  /// Adds a reply message to an existing thread.
  Future<Message> addMessage({
    required String threadId,
    required String body,
  }) async {
    final response = await _http.post(
      Uri.parse('$baseUrl/v1/feedback/threads/$threadId/messages'),
      headers: _headers,
      body: jsonEncode({'body': body}),
    );
    _ensureOK(response);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Message.fromJson(data);
  }

  /// Lists all messages for a given thread.
  ///
  /// Handles both a raw JSON array (backend returns `Vec<Message>` directly)
  /// and a wrapped `{"messages": [...]}` object.
  Future<MessageList> listMessages({
    required String threadId,
  }) async {
    final response = await _http.get(
      Uri.parse('$baseUrl/v1/feedback/threads/$threadId/messages'),
      headers: _headers,
    );
    _ensureOK(response);
    final decoded = jsonDecode(response.body);
    if (decoded is List) {
      return MessageList(
        messages: decoded
            .map((m) => Message.fromJson(m as Map<String, dynamic>))
            .toList(),
      );
    }
    return MessageList.fromJson(decoded as Map<String, dynamic>);
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'X-Reporter-Id': reporterId,
      };

  void _ensureOK(http.Response response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw FeedbackException(
        statusCode: response.statusCode,
        message: response.body,
      );
    }
  }

  void dispose() {
    _http.close();
  }
}

class FeedbackException implements Exception {
  final int statusCode;
  final String message;

  const FeedbackException({
    required this.statusCode,
    required this.message,
  });

  @override
  String toString() => 'FeedbackException($statusCode): $message';
}
