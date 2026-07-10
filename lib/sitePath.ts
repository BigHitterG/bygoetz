export const siteBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withSiteBasePath(path: string) {
  if (!path || path.startsWith("#") || /^https?:\/\//.test(path)) return path;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteBasePath}${normalizedPath}`;
}
