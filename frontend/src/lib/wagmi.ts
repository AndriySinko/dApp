import { http, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected, coinbaseWallet, safe } from "wagmi/connectors";

export const config = createConfig({
  chains: [sepolia],
  connectors: [
    injected({ target: "metaMask" }),
    injected(),
    coinbaseWallet({ appName: "PACT Protocol" }),
    safe(),
  ],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_ALCHEMY_RPC),
  },
});
