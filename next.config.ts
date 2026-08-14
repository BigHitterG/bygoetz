const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === "true";
const isUserOrOrgPagesRepository = repositoryName?.endsWith(".github.io");
const basePath =
  isGitHubPagesBuild && repositoryName && !isUserOrOrgPagesRepository
    ? `/${repositoryName}`
    : undefined;

const nextConfig = {
  ...(isGitHubPagesBuild ? { output: "export", trailingSlash: true } : {}),
  ...(!isGitHubPagesBuild
    ? {
        async rewrites() {
          return {
            beforeFiles: [
              {
                source: "/",
                has: [{ type: "host", value: "basilcommunitygarden.com" }],
                destination: "/community-garden",
              },
              {
                source: "/",
                has: [{ type: "host", value: "www.basilcommunitygarden.com" }],
                destination: "/community-garden",
              },
            ],
          };
        },
      }
    : {}),
  // Static exports cannot use the Next image optimizer. Vercel deployments can,
  // which keeps the high-resolution studio photographs lightweight on phones.
  images: { unoptimized: isGitHubPagesBuild },
  basePath,
  assetPrefix: basePath,
};

export default nextConfig;
