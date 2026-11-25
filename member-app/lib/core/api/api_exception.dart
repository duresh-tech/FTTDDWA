/// A failed API call, carrying the server's own message.
///
/// The messages this API returns are already written for the person reading
/// them -- "This membership is suspended. Please contact the association." --
/// so screens show [message] verbatim rather than mapping status codes to copy
/// of their own.
class ApiException implements Exception {
  ApiException(this.statusCode, this.message);

  final int statusCode;
  final String message;

  /// A transport failure: no response at all.
  factory ApiException.network(Object error) => ApiException(
    0,
    'Could not reach the server. Check your connection.\n$error',
  );

  /// Builds the message from a decoded error body.
  ///
  /// Three shapes, in the order they are worth trying:
  ///
  /// 1. `{ errors: [{ path, message }] }` -- Zod, via the global pipe. The
  ///    path matters: "email: Invalid email" is actionable where "Validation
  ///    failed" is not.
  /// 2. `{ message }`, a string or an array of them (Nest's default).
  /// 3. Nothing usable -- fall back to the status code.
  factory ApiException.fromBody(int statusCode, Object? body) {
    if (body is Map) {
      final errors = body['errors'];
      if (errors is List && errors.isNotEmpty) {
        final parts = errors.map((issue) {
          if (issue is! Map) return issue.toString();
          final path = issue['path'];
          final message = issue['message']?.toString() ?? 'Invalid';
          if (path is List && path.isNotEmpty) {
            return '${path.join('.')}: $message';
          }
          return message;
        });
        return ApiException(statusCode, parts.join('\n'));
      }

      final message = body['message'];
      if (message is String && message.isNotEmpty) {
        return ApiException(statusCode, message);
      }
      if (message is List && message.isNotEmpty) {
        return ApiException(statusCode, message.first.toString());
      }
    }
    return ApiException(statusCode, 'Request failed ($statusCode)');
  }

  /// True when the association's domain is not configured, or is wrong.
  ///
  /// The API answers 404 on every host-resolving route when the `Origin` does
  /// not match a business domain, which in an app almost always means
  /// APP_ASSOCIATION_HOST is wrong rather than that the member mistyped
  /// something.
  bool get isNoPortal => statusCode == 404;

  @override
  String toString() => message;
}
