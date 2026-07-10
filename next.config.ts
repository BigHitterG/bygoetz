const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === "true";
const isUserOrOrgPagesRepository = repositoryName?.endsWith(".github.io");
const basePath =
  isGitHubPagesBuild && repositoryName && !isUserOrOrgPagesRepository
    ? `/${repositoryName}`
    : undefined;

const nextConfig = {
  ...(isGitHubPagesBuild ? { output: "export" } : {}),
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
};

export default nextConfig;
