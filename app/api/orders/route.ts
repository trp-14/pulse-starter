import { apiRoute, badRequest, json, methodNotAllowed, parseQuery } from '@/lib/api/http';
import { listOrders } from '@/lib/services/orders';
import { ordersQuerySchema } from '@/lib/validation';

export const GET = apiRoute(async (request, { requestId }) => {
  const query = parseQuery(request, ordersQuerySchema);
  if (!query) return badRequest(requestId);
  return json(await listOrders(query), requestId);
});

const notAllowed = methodNotAllowed(['GET', 'HEAD']);
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE, notAllowed as OPTIONS };
