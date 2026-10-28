import { apiRoute, badRequest, json, methodNotAllowed, noQuerySchema, parseQuery } from '@/lib/api/http';
import { getRevenueSeries } from '@/lib/services/revenue';

export const GET = apiRoute(async (request, { requestId }) => {
  if (!parseQuery(request, noQuerySchema)) return badRequest(requestId);
  return json(await getRevenueSeries(), requestId);
});

const notAllowed = methodNotAllowed(['GET', 'HEAD']);
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE, notAllowed as OPTIONS };
