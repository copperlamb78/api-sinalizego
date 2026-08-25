import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Ocorreu um erro interno no servidor.';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        error = exception.name.replace(/Exception$/, '') || 'Http Error';
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj.message || exception.message;
        error = resObj.error || exception.name.replace(/Exception$/, '');
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message =
            'Os dados informados já estão cadastrados em nosso sistema.';
          error = 'Conflict';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message =
            'O registro que você tentou acessar não foi encontrado.';
          error = 'Not Found';
          break;
        case 'P2022':
          status = HttpStatus.BAD_REQUEST;
          message =
            'A coluna ou campo especificado não foi encontrado na base de dados.';
          error = 'Bad Request';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          message = `Erro na operação de banco de dados (Código: ${exception.code}).`;
          error = 'Bad Request';
          break;
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `[UnhandledException] ${exception.message}`,
        exception.stack,
      );
    }

    const payload = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(payload);
  }
}
