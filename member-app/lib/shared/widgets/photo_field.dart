import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/config/env.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';
import 'required_label.dart';

/// Picks the applicant's photo, from the camera or the gallery.
///
/// The widget owns the PICKING and the obvious client-side checks; the caller
/// owns the upload, because only it knows which endpoint and how to report a
/// failure. That split is why [onPicked] hands back bytes rather than a path.
///
/// The size and type checks here duplicate the server's deliberately. They
/// exist to fail in the moment rather than after a round trip; the server
/// re-reads the type from the file's own leading bytes and is the only thing
/// that actually decides.
class PhotoField extends StatefulWidget {
  const PhotoField({
    super.key,
    required this.label,
    required this.onPicked,
    this.storedPath,
    this.uploading = false,
    this.helper,
  });

  final String label;

  /// Called with the chosen image. The caller uploads and, on success, passes
  /// the returned storage path back as [storedPath].
  final Future<void> Function(List<int> bytes, String filename) onPicked;

  /// The path the upload returned, once there is one.
  final String? storedPath;

  final bool uploading;
  final String? helper;

  @override
  State<PhotoField> createState() => _PhotoFieldState();
}

class _PhotoFieldState extends State<PhotoField> {
  /// Mirrors the server's MAX_PHOTO_BYTES.
  static const _maxBytes = 2 * 1024 * 1024;

  /// Shown immediately, before the upload returns a path, so the applicant
  /// sees their photo rather than a spinner over nothing.
  File? _preview;
  String? _error;

  final _picker = ImagePicker();

  Future<void> _pick(ImageSource source) async {
    setState(() => _error = null);
    try {
      final file = await _picker.pickImage(
        source: source,
        // Downscaled on the way in: a modern phone camera produces 4-8 MB,
        // which the server would refuse at 2 MB. A passport photo needs
        // nothing like that resolution, and resizing here is the difference
        // between the feature working and it failing on every real device.
        maxWidth: 1280,
        maxHeight: 1280,
        imageQuality: 85,
      );
      if (file == null) return;

      final bytes = await file.readAsBytes();
      if (bytes.length > _maxBytes) {
        setState(() => _error = L.of(context).photoTooLarge);
        return;
      }

      setState(() => _preview = File(file.path));
      await widget.onPicked(bytes, file.name);
    } catch (error) {
      if (mounted) setState(() => _error = L.of(context).photoUnreadable);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l = L.of(context);
    final status = AppStatusColors.of(context);
    final stored = widget.storedPath;
    final hasPhoto = _preview != null || (stored != null && stored.isNotEmpty);

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          RequiredLabel(widget.label),
          Row(
            children: [
              _Thumbnail(
                preview: _preview,
                storedPath: stored,
                uploading: widget.uploading,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: widget.uploading
                                ? null
                                : () => _pick(ImageSource.camera),
                            icon: const Icon(
                              Icons.photo_camera_outlined,
                              size: 18,
                            ),
                            label: Text(l.photoCamera),
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size.fromHeight(42),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: widget.uploading
                                ? null
                                : () => _pick(ImageSource.gallery),
                            icon: const Icon(Icons.image_outlined, size: 18),
                            label: Text(l.photoGallery),
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size.fromHeight(42),
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          _error!,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.error,
                          ),
                        ),
                      )
                    else if (hasPhoto && !widget.uploading)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Row(
                          children: [
                            Icon(
                              Icons.check_circle,
                              size: 14,
                              color: status.success,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              l.photoAttached,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: status.success,
                              ),
                            ),
                          ],
                        ),
                      )
                    else if (widget.helper != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          widget.helper!,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Thumbnail extends StatelessWidget {
  const _Thumbnail({
    required this.preview,
    required this.storedPath,
    required this.uploading,
  });

  final File? preview;
  final String? storedPath;
  final bool uploading;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    Widget content;
    if (uploading) {
      content = const Center(
        child: SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    } else if (preview != null) {
      // The local file, not the uploaded URL: it is already on the device and
      // shows instantly, where the remote copy would be a second round trip
      // for an image the applicant just took.
      content = Image.file(preview!, fit: BoxFit.cover);
    } else if (storedPath != null && storedPath!.isNotEmpty) {
      content = Image.network(Env.uploadUrl(storedPath!), fit: BoxFit.cover);
    } else {
      content = Icon(
        Icons.person_outline,
        size: 28,
        color: theme.colorScheme.onSurfaceVariant,
      );
    }

    return Container(
      width: 64,
      height: 64,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainer,
        borderRadius: AppTheme.borderRadius,
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: content,
    );
  }
}
