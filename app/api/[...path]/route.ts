import { apiError, apiRoute } from '@/lib/api/http';

// Unknown /api/* paths get the same JSON error shape (and no-store, rate limit) as real endpoints,
// instead of the HTML not-found page.
const notFound = apiRoute(async (_request, { requestId }) =>
  apiError(404, 'not_found', 'This endpoint does not exist.', requestId),
);

export {
  notFound as GET,
  notFound as HEAD,
  notFound as POST,
  notFound as PUT,
  notFound as PATCH,
  notFound as DELETE,
  notFound as OPTIONS,
};
