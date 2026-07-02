import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isUserOrOrgPage = repositoryName.endsWith(".github.io");
const githubPagesBasePath = isGitHubPages && repositoryName && !isUserOrOrgPage ? `/${repositoryName}` : "";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  basePath: githubPagesBasePath || undefined,
  assetPrefix: githubPagesBasePath || undefined,
};

export default nextConfig;
