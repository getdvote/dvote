import { applyDecorators, UseInterceptors } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiPayloadTooLargeResponse,
  ApiServiceUnavailableResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { ImageUploadInterceptor } from './image-upload.interceptor';

/**
 * An endpoint that takes one image as multipart/form-data field "file" (plus optional text
 * fields), with its Swagger form and error codes.
 */
export function ApiImageUpload(fields: Record<string, { type: 'string'; enum?: string[]; format?: string; description?: string }> = {}) {
  return applyDecorators(
    UseInterceptors(ImageUploadInterceptor),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: {
          file: { type: 'string', format: 'binary', description: 'JPG, PNG, WebP or HEIC, up to 10 MB. Stored as WebP.' },
          ...fields,
        },
      },
    }),
    ApiBadRequestResponse({ description: 'file_required | invalid_upload | validation errors' }),
    ApiPayloadTooLargeResponse({ description: 'file_too_large' }),
    ApiUnsupportedMediaTypeResponse({ description: 'unsupported_image' }),
    ApiServiceUnavailableResponse({ description: 'storage_not_configured | storage_error' }),
  );
}
