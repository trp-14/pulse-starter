import { readJsonBody, rejectCrossOrigin, requireJsonContentType } from '@/lib/api/guards';
import { apiRoute, badRequest, enforceRateLimit, json, methodNotAllowed, noQuerySchema, parseQuery } from '@/lib/api/http';
import { getRateLimiters, SIMULATE_RATE_LIMIT_PER_MINUTE } from '@/lib/redis';
import { simulateRush } from '@/lib/services/simulate';
import { simulateBodySchema } from '@/lib/validation/simulate';

const RATE_LIMIT_MESSAGE = `You can simulate ${SIMULATE_RATE_LIMIT_PER_MINUTE} rushes a minute.`;

export const POST = apiRoute(async (request, context) => {
  const { requestId } = context;
  const rejected =
    rejectCrossOrigin(request, requestId) ??
    requireJsonContentType(request, requestId) ??
    (parseQuery(request, noQuerySchema) ? null : badRequest(requestId)) ??
    (await enforceRateLimit(getRateLimiters().simulate, context, RATE_LIMIT_MESSAGE, false));
  if (rejected) return rejected;

  const body = await readJsonBody(request, requestId);
  if (!body.ok) return body.response;
  const parsed = simulateBodySchema.safeParse(body.value);
  if (!parsed.success) return badRequest(requestId);

  return json(await simulateRush(parsed.data.count, { requestId }), requestId, 201);
});

const notAllowed = methodNotAllowed(['POST']);
export {
  notAllowed as GET,
  notAllowed as HEAD,
  notAllowed as PUT,
  notAllowed as PATCH,
  notAllowed as DELETE,
  notAllowed as OPTIONS,
};
