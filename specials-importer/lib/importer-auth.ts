export function importerAuthorized(req: Request) {
  const expected = process.env.IMPORTER_ADMIN_KEY;
  if (!expected) return false;
  return req.headers.get('x-freshcart-importer-key') === expected;
}
