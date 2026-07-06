import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExplorerProductPage } from "@/components/explorers/ExplorerProductPage";
import { explorerProducts, getExplorerProduct } from "@/lib/explorers/products";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return explorerProducts.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getExplorerProduct(slug);

  if (!product) {
    return {
      title: "Explorer Not Found | The Explorers Series",
    };
  }

  return {
    title: `${product.title} Print | The Explorers Series`,
    description: `${product.description} Available as museum-quality prints and framed prints.`,
    openGraph: {
      title: `${product.title} Print | The Explorers Series`,
      description: product.description,
      type: "website",
    },
  };
}

export default async function Page({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getExplorerProduct(slug);

  if (!product) notFound();

  return <ExplorerProductPage product={product} />;
}
