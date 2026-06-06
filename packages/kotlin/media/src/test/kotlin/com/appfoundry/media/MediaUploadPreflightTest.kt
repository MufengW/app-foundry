package com.appfoundry.media

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class MediaUploadPreflightTest {
    @Test
    fun genericDeclaredMimeFallsBackToDetectedImageTypeForPickerUploads() {
        val prepared = MediaUploadPreflight.prepare(
            bytes = tinyJpeg(),
            declaredMimeType = "application/octet-stream",
            policy = MediaUploadPolicies.image(maxBytes = 5 * 1024 * 1024),
        )

        assertEquals("image/jpeg", prepared.mimeType)
        assertEquals("image/jpeg", prepared.detectedMimeType)
        assertEquals("jpg", prepared.extension)
    }

    @Test
    fun strictPolicyRejectsUnsupportedDeclaredMimeType() {
        val error = assertThrows(AppFoundryMediaException::class.java) {
            MediaUploadPreflight.prepare(
                bytes = tinyJpeg(),
                declaredMimeType = "application/octet-stream",
                policy = MediaUploadPolicy(
                    allowedContentTypes = MediaContentType.imageUploadContentTypes,
                    allowUnsupportedDeclaredContentTypeFallback = false,
                ),
            )
        }

        assertEquals("declared_content_type_not_allowed", error.code)
    }

    @Test
    fun mismatchedDeclaredImageTypeIsRejected() {
        val error = assertThrows(AppFoundryMediaException::class.java) {
            MediaUploadPreflight.prepare(
                bytes = tinyPng(),
                declaredMimeType = "image/jpeg",
                policy = MediaUploadPolicies.image(),
            )
        }

        assertEquals("content_type_mismatch", error.code)
    }

    @Test
    fun compatibleM4ADeclarationIsPreserved() {
        val prepared = MediaUploadPreflight.prepare(
            bytes = tinyM4A(),
            declaredMimeType = "audio/m4a",
            policy = MediaUploadPolicies.audio(),
        )

        assertEquals("audio/m4a", prepared.mimeType)
        assertEquals("audio/mp4", prepared.detectedMimeType)
        assertEquals("m4a", prepared.extension)
    }

    @Test
    fun imageOrVideoPolicyRejectsAudioBytes() {
        val error = assertThrows(AppFoundryMediaException::class.java) {
            MediaUploadPreflight.prepare(
                bytes = tinyM4A(),
                declaredMimeType = "audio/m4a",
                policy = MediaUploadPolicies.imageOrVideo(maxBytes = 200 * 1024 * 1024),
            )
        }

        assertEquals("declared_content_type_not_allowed", error.code)
    }

    private fun tinyJpeg(): ByteArray = byteArrayOf(
        0xff.toByte(), 0xd8.toByte(), 0xff.toByte(), 0xe0.toByte(),
        0x00, 0x10,
        0x4a, 0x46, 0x49, 0x46,
        0x00, 0xff.toByte(), 0xd9.toByte(),
    )

    private fun tinyPng(): ByteArray = byteArrayOf(
        0x89.toByte(), 0x50, 0x4e, 0x47,
        0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d,
    )

    private fun tinyM4A(): ByteArray = byteArrayOf(
        0x00, 0x00, 0x00, 0x18,
        0x66, 0x74, 0x79, 0x70,
        0x4d, 0x34, 0x41, 0x20,
        0x00, 0x00, 0x00, 0x00,
    )
}
