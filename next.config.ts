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
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath,
};

export default nextConfig;
