import { useEffect } from "react";
import { useWeb3React } from "@web3-react/core";
import { MetaMask as injected } from "./wallet";

export function useEagerConnect() {
  const { activate } = useWeb3React();

  useEffect(() => {
    injected.isAuthorized().then((isAuthorized: boolean) => {
      if (isAuthorized) {
        activate(injected, undefined, true);
      }
    });
  }, []); // intentionally only running on mount (make sure it's only mounted once :))
}
