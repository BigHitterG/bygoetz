import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "By Goetz | Art, Stories & Creative Worlds",
    short_name: "By Goetz",
    description:
      "The official home of artist, designer, and creator Thomas Raymond Goetz.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
