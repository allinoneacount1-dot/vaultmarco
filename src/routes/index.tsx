import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/marco/Navbar";
import { Hero } from "@/components/marco/Hero";
import {
  About,
  Ecosystem,
  Features,
  CommandCenter,
  Partnerships,
  SocialProof,
  Contact,
  Footer,
} from "@/components/marco/Sections";
import { Faq } from "@/components/marco/Faq";
import { Watchlist } from "@/components/marco/Watchlist";

const SITE_URL = "https://vaultmarco.lovable.app";
const OG_IMAGE = `${SITE_URL}/og-logo.png`;
const TITLE = "MARCOVAULT | Multi-Chain Alpha & Web3 Intelligence";
const DESC =
  "Multi-chain alpha, AI workflows, and sniper-grade execution. Navigate the noise. Enter the vault.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "640" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "MARCOVAULT" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
      { name: "twitter:image", content: OG_IMAGE },
      { name: "twitter:site", content: "@vaultmarco" },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "MARCOVAULT",
          url: SITE_URL,
          description: DESC,
          potentialAction: {
            "@type": "SearchAction",
            target: `${SITE_URL}?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "MARCOVAULT",
          alternateName: "MARCOVAULT - Multi-Chain Alpha & Web3 Intelligence Platform",
          url: SITE_URL,
          logo: OG_IMAGE,
          sameAs: [
            "https://x.com/vaultmarco",
            "https://t.me/DxmZone",
            "https://t.me/DexMultichain",
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Person",
          name: "Marco",
          alternateName: "MARCOVAULT",
          url: SITE_URL,
          image: OG_IMAGE,
          sameAs: [
            "https://x.com/vaultmarco",
            "https://t.me/DxmZone",
            "https://t.me/DexMultichain",
          ],
          jobTitle: "Multi-Chain Alpha Operator",
          worksFor: { "@type": "Organization", name: "MARCOVAULT", url: SITE_URL },
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="relative overflow-x-clip">
      <Navbar />
      <Hero />
      <About />
      <Ecosystem />
      <Features />
      <CommandCenter />
      <Partnerships />
      <SocialProof />
      <Watchlist />
      <Contact />
      <Faq />
      <Footer />
    </main>
  );
}
