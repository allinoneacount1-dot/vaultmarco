import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, sepolia, arbitrum, optimism, base, polygon } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "MARCOVAULT",
  projectId: "YOUR_PROJECT_ID", // Ganti dengan Project ID dari WalletConnect Cloud
  chains: [mainnet, sepolia, arbitrum, optimism, base, polygon],
  ssr: false, // Karena kita pakai Vite (CSR)
});
