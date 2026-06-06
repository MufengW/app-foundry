package com.appfoundry.media

class AppFoundryMediaException(
    val code: String,
    message: String,
) : IllegalArgumentException(message)

enum class MediaContentType(val mimeType: String, val fileExtension: String) {
    ImageJpeg("image/jpeg", "jpg"),
    ImagePng("image/png", "png"),
    ImageGif("image/gif", "gif"),
    ImageWebp("image/webp", "webp"),
    VideoMp4("video/mp4", "mp4"),
    VideoQuickTime("video/quicktime", "mov"),
    VideoWebm("video/webm", "webm"),
    AudioWebm("audio/webm", "webm"),
    AudioMp4("audio/mp4", "m4a"),
    AudioM4A("audio/m4a", "m4a"),
    AudioWav("audio/wav", "wav"),
    AudioXWav("audio/x-wav", "wav"),
    AudioMpeg("audio/mpeg", "mp3"),
    AudioOgg("audio/ogg", "ogg");

    companion object {
        val imageUploadContentTypes: Set<MediaContentType> = setOf(
            ImageJpeg,
            ImagePng,
            ImageGif,
            ImageWebp,
        )

        val videoUploadContentTypes: Set<MediaContentType> = setOf(
            VideoMp4,
            VideoQuickTime,
            VideoWebm,
        )

        val audioUploadContentTypes: Set<MediaContentType> = setOf(
            AudioWebm,
            AudioMp4,
            AudioM4A,
            AudioWav,
            AudioXWav,
            AudioMpeg,
            AudioOgg,
        )

        val defaultAllowedContentTypes: Set<MediaContentType> =
            imageUploadContentTypes + videoUploadContentTypes + audioUploadContentTypes

        fun fromMimeType(mimeType: String?): MediaContentType? {
            val normalized = normalize(mimeType) ?: return null
            return entries.firstOrNull { it.mimeType == normalized }
        }

        fun normalize(mimeType: String?): String? {
            val normalized = mimeType
                ?.substringBefore(";")
                ?.trim()
                ?.lowercase()
                ?.takeIf { it.isNotEmpty() }
                ?: return null
            return if (normalized == "image/jpg") "image/jpeg" else normalized
        }

        fun contentTypesAreCompatible(
            declared: MediaContentType,
            detected: MediaContentType,
        ): Boolean {
            if (declared == detected) return true

            val isoBmff = setOf(VideoMp4, VideoQuickTime, AudioMp4, AudioM4A)
            if (declared in isoBmff && detected in isoBmff) return true

            val webm = setOf(VideoWebm, AudioWebm)
            if (declared in webm && detected in webm) return true

            val wav = setOf(AudioWav, AudioXWav)
            return declared in wav && detected in wav
        }
    }
}

data class MediaUploadPolicy(
    val maxBytes: Int = 10 * 1024 * 1024,
    val allowedContentTypes: Set<MediaContentType> = MediaContentType.defaultAllowedContentTypes,
    val maxVideoBytes: Int? = null,
    val requireDetectedContentType: Boolean = true,
    val inferDeclaredContentType: Boolean = true,
    val preferDeclaredContentType: Boolean = false,
    val allowUnsupportedDeclaredContentTypeFallback: Boolean = false,
)

object MediaUploadPolicies {
    fun image(
        maxBytes: Int = 10 * 1024 * 1024,
        allowUnsupportedDeclaredContentTypeFallback: Boolean = true,
    ): MediaUploadPolicy = MediaUploadPolicy(
        maxBytes = maxBytes,
        allowedContentTypes = MediaContentType.imageUploadContentTypes,
        preferDeclaredContentType = true,
        allowUnsupportedDeclaredContentTypeFallback = allowUnsupportedDeclaredContentTypeFallback,
    )

    fun imageOrVideo(
        maxBytes: Int = 200 * 1024 * 1024,
        maxVideoBytes: Int? = null,
        allowUnsupportedDeclaredContentTypeFallback: Boolean = true,
    ): MediaUploadPolicy = MediaUploadPolicy(
        maxBytes = maxBytes,
        allowedContentTypes = MediaContentType.imageUploadContentTypes + MediaContentType.videoUploadContentTypes,
        maxVideoBytes = maxVideoBytes,
        preferDeclaredContentType = true,
        allowUnsupportedDeclaredContentTypeFallback = allowUnsupportedDeclaredContentTypeFallback,
    )

    fun audio(
        maxBytes: Int = 25 * 1024 * 1024,
        allowUnsupportedDeclaredContentTypeFallback: Boolean = true,
    ): MediaUploadPolicy = MediaUploadPolicy(
        maxBytes = maxBytes,
        allowedContentTypes = MediaContentType.audioUploadContentTypes,
        preferDeclaredContentType = true,
        allowUnsupportedDeclaredContentTypeFallback = allowUnsupportedDeclaredContentTypeFallback,
    )
}

data class PreparedMediaUpload(
    val bytes: ByteArray,
    val contentType: MediaContentType,
    val detectedContentType: MediaContentType?,
    val declaredContentType: MediaContentType?,
) {
    val mimeType: String
        get() = contentType.mimeType

    val detectedMimeType: String?
        get() = detectedContentType?.mimeType

    val declaredMimeType: String?
        get() = declaredContentType?.mimeType

    val extension: String
        get() = contentType.fileExtension

    val byteSize: Int
        get() = bytes.size
}

object MediaUploadPreflight {
    fun prepare(
        bytes: ByteArray,
        declaredMimeType: String?,
        policy: MediaUploadPolicy = MediaUploadPolicy(),
    ): PreparedMediaUpload {
        if (bytes.isEmpty()) {
            throw AppFoundryMediaException("media_empty", "Media data is required.")
        }
        if (bytes.size > policy.maxBytes) {
            throw AppFoundryMediaException("file_too_large", "Media file is too large.")
        }

        val detected = detectContentType(bytes)
        val normalizedDeclared = MediaContentType.normalize(declaredMimeType)
        val declared = MediaContentType.fromMimeType(normalizedDeclared)
        if (
            normalizedDeclared != null &&
            declared == null &&
            !policy.allowUnsupportedDeclaredContentTypeFallback
        ) {
            throw AppFoundryMediaException(
                "declared_content_type_not_allowed",
                "Declared media content type is not allowed.",
            )
        }

        val effectiveDeclared = declared ?: if (
            policy.inferDeclaredContentType &&
            (normalizedDeclared == null || policy.allowUnsupportedDeclaredContentTypeFallback)
        ) {
            detected
        } else {
            null
        }

        if (policy.requireDetectedContentType && detected == null) {
            throw AppFoundryMediaException(
                "missing_detected_content_type",
                "Media content type could not be detected.",
            )
        }

        if (effectiveDeclared != null && effectiveDeclared !in policy.allowedContentTypes) {
            throw AppFoundryMediaException(
                "declared_content_type_not_allowed",
                "Declared media content type is not allowed.",
            )
        }

        if (
            detected != null &&
            detected !in policy.allowedContentTypes &&
            !(effectiveDeclared != null &&
                effectiveDeclared in policy.allowedContentTypes &&
                MediaContentType.contentTypesAreCompatible(effectiveDeclared, detected))
        ) {
            throw AppFoundryMediaException(
                "detected_content_type_not_allowed",
                "Detected media content type is not allowed.",
            )
        }

        if (
            effectiveDeclared != null &&
            detected != null &&
            !MediaContentType.contentTypesAreCompatible(effectiveDeclared, detected)
        ) {
            throw AppFoundryMediaException(
                "content_type_mismatch",
                "Declared media content type does not match detected bytes.",
            )
        }

        if (
            policy.maxVideoBytes != null &&
            detected != null &&
            detected in MediaContentType.videoUploadContentTypes &&
            bytes.size > policy.maxVideoBytes
        ) {
            throw AppFoundryMediaException("video_file_too_large", "Video file is too large.")
        }

        val contentType = if (policy.preferDeclaredContentType) {
            effectiveDeclared ?: detected
        } else {
            detected ?: effectiveDeclared
        } ?: throw AppFoundryMediaException("missing_content_type", "Media content type is required.")

        return PreparedMediaUpload(
            bytes = bytes,
            contentType = contentType,
            detectedContentType = detected,
            declaredContentType = effectiveDeclared,
        )
    }

    fun detectContentType(bytes: ByteArray): MediaContentType? {
        if (bytes.size < 4) return null

        if (bytes[0] == 0xff.toByte() && bytes[1] == 0xd8.toByte() && bytes[2] == 0xff.toByte()) {
            return MediaContentType.ImageJpeg
        }
        if (
            bytes.size >= 8 &&
            bytes[0] == 0x89.toByte() &&
            bytes[1] == 0x50.toByte() &&
            bytes[2] == 0x4e.toByte() &&
            bytes[3] == 0x47.toByte() &&
            bytes[4] == 0x0d.toByte() &&
            bytes[5] == 0x0a.toByte() &&
            bytes[6] == 0x1a.toByte() &&
            bytes[7] == 0x0a.toByte()
        ) {
            return MediaContentType.ImagePng
        }
        if (
            bytes.size >= 6 &&
            ascii(bytes, 0, 4) == "GIF8" &&
            (bytes[4] == 0x37.toByte() || bytes[4] == 0x39.toByte()) &&
            bytes[5] == 0x61.toByte()
        ) {
            return MediaContentType.ImageGif
        }
        if (bytes.size >= 12 && ascii(bytes, 0, 4) == "RIFF" && ascii(bytes, 8, 4) == "WEBP") {
            return MediaContentType.ImageWebp
        }
        if (bytes.size >= 12 && ascii(bytes, 0, 4) == "RIFF" && ascii(bytes, 8, 4) == "WAVE") {
            return MediaContentType.AudioWav
        }
        if (bytes.size >= 12 && ascii(bytes, 4, 4) == "ftyp") {
            return when (ascii(bytes, 8, 4).lowercase()) {
                "qt  " -> MediaContentType.VideoQuickTime
                "m4a ", "m4b ", "m4p " -> MediaContentType.AudioMp4
                else -> MediaContentType.VideoMp4
            }
        }
        if (
            bytes[0] == 0x1a.toByte() &&
            bytes[1] == 0x45.toByte() &&
            bytes[2] == 0xdf.toByte() &&
            bytes[3] == 0xa3.toByte()
        ) {
            return MediaContentType.VideoWebm
        }
        if (ascii(bytes, 0, 4) == "OggS") return MediaContentType.AudioOgg
        if (ascii(bytes, 0, 3) == "ID3") return MediaContentType.AudioMpeg
        if (bytes[0] == 0xff.toByte() && (bytes[1].toInt() and 0xe0) == 0xe0) {
            return MediaContentType.AudioMpeg
        }

        return null
    }

    private fun ascii(bytes: ByteArray, start: Int, length: Int): String {
        if (bytes.size < start + length) return ""
        return bytes.copyOfRange(start, start + length).toString(Charsets.US_ASCII)
    }
}
