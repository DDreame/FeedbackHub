/// Data models for FeedbackHub API responses.
///
/// Mirrors the FeedbackHub REST API schema:
/// POST /v1/feedback/threads/atomic
/// GET  /v1/feedback/threads
/// POST /v1/feedback/threads/{id}/messages
class Thread {
  final String id;
  final String status;
  final String summary;
  final String? latestPublicMessageAt;
  final String createdAt;

  const Thread({
    required this.id,
    required this.status,
    required this.summary,
    this.latestPublicMessageAt,
    required this.createdAt,
  });

  factory Thread.fromJson(Map<String, dynamic> json) {
    return Thread(
      id: json['id'] as String,
      status: json['status'] as String,
      summary: json['summary'] as String,
      latestPublicMessageAt: json['latest_public_message_at'] as String?,
      createdAt: json['created_at'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'status': status,
        'summary': summary,
        'latest_public_message_at': latestPublicMessageAt,
        'created_at': createdAt,
      };
}

class Message {
  final String id;
  final String threadId;
  final String authorType; // 'reporter' | 'developer'
  final String body;
  final String createdAt;

  const Message({
    required this.id,
    required this.threadId,
    required this.authorType,
    required this.body,
    required this.createdAt,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] as String,
      threadId: json['thread_id'] as String,
      authorType: json['author_type'] as String,
      body: json['body'] as String,
      createdAt: json['created_at'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'thread_id': threadId,
        'author_type': authorType,
        'body': body,
        'created_at': createdAt,
      };
}

/// Response from GET /v1/feedback/threads/unread-summary.
class UnreadSummary {
  final bool hasAnyUnread;
  final List<String> unreadThreadIds;

  const UnreadSummary({
    required this.hasAnyUnread,
    required this.unreadThreadIds,
  });

  factory UnreadSummary.fromJson(Map<String, dynamic> json) {
    return UnreadSummary(
      hasAnyUnread: json['has_any_unread'] as bool,
      unreadThreadIds:
          (json['unread_thread_ids'] as List<dynamic>).cast<String>(),
    );
  }
}

class PaginatedThreads {
  final List<Thread> threads;
  final int total;
  final int page;
  final int pageSize;
  final int totalPages;

  const PaginatedThreads({
    required this.threads,
    required this.total,
    required this.page,
    required this.pageSize,
    required this.totalPages,
  });

  factory PaginatedThreads.fromJson(Map<String, dynamic> json) {
    return PaginatedThreads(
      threads: (json['threads'] as List<dynamic>)
          .map((t) => Thread.fromJson(t as Map<String, dynamic>))
          .toList(),
      total: json['total'] as int,
      page: json['page'] as int,
      pageSize: json['page_size'] as int,
      totalPages: json['total_pages'] as int,
    );
  }
}

/// Response from GET /v1/feedback/threads/{id}/messages.
class MessageList {
  final List<Message> messages;

  const MessageList({required this.messages});

  factory MessageList.fromJson(Map<String, dynamic> json) {
    return MessageList(
      messages: (json['messages'] as List<dynamic>)
          .map((m) => Message.fromJson(m as Map<String, dynamic>))
          .toList(),
    );
  }
}
