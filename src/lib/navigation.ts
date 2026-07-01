/** Primary destinations — no back affordance on these routes. */
export const PRIMARY_ROUTES = new Set([
  '/',
  '/sales',
  '/purchases',
  '/expenses',
  '/inventory',
  '/customers',
  '/vendors',
  '/banking',
  '/ledger',
  '/reports',
  '/growth',
  '/payments',
  '/more',
  '/settings',
]);

export function isPrimaryRoute(pathname: string): boolean {
  return PRIMARY_ROUTES.has(pathname);
}
