import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, sepolia, arbitrum, optimism, base, polygon } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "MARCOVAULT",
  projectId: "d4d049a81df98c9f13ef7bfcf08599d5",
  chains: [mainnet, sepolia, arbitrum, optimism, base, polygon],
  ssr: false, // Karena kita pakai Vite (CSR)
});
