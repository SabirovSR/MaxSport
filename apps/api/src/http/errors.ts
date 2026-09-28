import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import {
  DomainError,
  httpStatusForDomainError,
  UnauthorizedError,
} from "@maxsport/shared";
import { YandexGeoError } from "@maxsport/geo";

export function mapRouteError(error: unknown): {
  statusCode: number;
  body: { error: string; code?: string };
} {
  if (error instanceof YandexGeoError) {
    return {
      statusCode: 502,
      body: {
        error: "Картографический сервис недоступен",
        code: "GEO_UPSTREAM",
      },
    };
  }
  if (error instanceof DomainError) {
    return {
      statusCode: httpStatusForDomainError(error),
      body: { error: error.message, code: error.code },
    };
  }
  if (error instanceof UnauthorizedError) {
    return { statusCode: 401, body: { error: error.message } };
  }
  console.error(error);
  return { statusCode: 500, body: { error: "Внутренняя ошибка сервера" } };
}

export function httpErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (error.validation) {
    return reply.status(400).send({
      error: "Некорректные данные запроса",
      code: "VALIDATION",
    });
  }
  if (
    error.statusCode === 400 ||
    error.code === "FST_ERR_CTP_INVALID_JSON_BODY"
  ) {
    return reply.status(400).send({
      error: "Некорректный JSON",
      code: "INVALID_JSON",
    });
  }
  if (error.statusCode === 429) {
    return reply.status(429).send({
      error: "Слишком много запросов, подождите немного",
      code: "RATE_LIMIT",
    });
  }
  request.log.error(error);
  return reply.status(error.statusCode ?? 500).send({
    error: "Внутренняя ошибка сервера",
  });
}
