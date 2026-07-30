import type { Metadata } from "next";
import { DuckPond } from "./DuckPond";

export const metadata: Metadata = {
  title: "Duck Pond | by Goetz",
  description: "A quiet interactive pond where rubber ducks notice you.",
};

export default function DuckPondPage() {
  return <DuckPond />;
}
