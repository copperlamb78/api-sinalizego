import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    switch (exception.code) {
      case 'P2002': {
        const status = HttpStatus.CONFLICT;

        response.status(status).json({
          statusCode: status,
          message: 'Os dados informados já estão cadastrados em nosso sistema.',
          error: 'Conflict',
        });
        break;
      }

      case 'P2025': {
        const status = HttpStatus.NOT_FOUND;

        response.status(status).json({
          statusCode: status,
          message: 'O registro que você tentou acessar não foi encontrado.',
          error: 'Not Found',
        });
        break;
      }

      default:
        super.catch(exception, host);
        break;
    }
  }
}
