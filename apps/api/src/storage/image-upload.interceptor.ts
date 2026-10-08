import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import multer from 'multer';
import type { Observable } from 'rxjs';

/** Raw upload limit (before shrinking). Phone photos are usually 2-6 MB. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 10 },
}).single('file');

/**
 * Reads one multipart file from the form field "file" into memory (req.file), with stable
 * error codes: file_too_large (413), file_required (400). Text fields of the same form land
 * in req.body, so the usual DTO validation still applies to them.
 */
@Injectable()
export class ImageUploadInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    await new Promise<void>((resolve, reject) =>
      upload(req, http.getResponse<Response>(), (err: unknown) =>
        err ? reject(toHttpError(err)) : resolve(),
      ),
    );
    if (!req.file) {
      throw new BadRequestException({
        code: 'file_required',
        message: 'Send the image as multipart/form-data in the field "file"',
      });
    }
    return next.handle();
  }
}

function toHttpError(err: unknown): HttpException {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return new PayloadTooLargeException({
      code: 'file_too_large',
      message: `The image must be at most ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`,
    });
  }
  return new BadRequestException({
    code: 'invalid_upload',
    message: err instanceof Error ? err.message : 'Could not read the upload',
  });
}
