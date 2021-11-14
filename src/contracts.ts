import { ethers, BigNumberish } from "ethers";
import {
  Orderbook,
  MdexWorkerV2,
  SimplePriceOracle,
  Access,
  OrderbookConfig,
  MdexStrategyAddOptimal,
  MdexStrategyReinvest,
  MdexStrategyLiquidate,
  MdexStrategyWithdrawMinimizeTrading,
  MdexStrategyPartialCloseLiquidate,
  WorkerConfigV2,
  ERC20,
    MockERC20,
  LensV2,
} from "./typechain";

import {
  SimplePriceOracle__factory,
  Access__factory,
  Orderbook__factory,
  OrderbookConfig__factory,
  MdexStrategyAddOptimal__factory,
  MdexStrategyReinvest__factory,
  MdexStrategyLiquidate__factory,
  MdexStrategyWithdrawMinimizeTrading__factory,
  MdexStrategyPartialCloseLiquidate__factory,
  WorkerConfigV2__factory,
  MdexWorkerV2__factory,
  ERC20__factory,
  MockERC20__factory,
  LensV2__factory,
} from "./typechain";

import addresses from "./contracts.json";
/*
const addresses={
    oracle:'',
    access: "Access",
    orderbook: "Orderbook",
    orderbookConfig: "OrderbookConfig",
    strategyAddTwo: "MdexStrategyAddOptimal",
    strategyReinvest: "MdexStrategyReinvest",
    strategyLiquidate: "MdexStrategyLiquidate",
    strategyWithdraw: "MdexStrategyWithdrawMinimizeTrading",
    strategyClosePart: "MdexStrategyPartialCloseLiquidate",
    workerConfigV2: 'WorkerConfigV2',
    workers: [] as string[],
    tokens: [
        '0xE66232f14e4774037E39e54882e993ec6a9cEAfD',
        '0xf3F95fc0642C7eDA8CCf6CA7B923facAE0560489'
] as string[],
}
*/
type Contracts = {
  lens: LensV2;
  oracle: SimplePriceOracle;
  access: Access;
  orderbook: Orderbook;
  orderbookConfig: OrderbookConfig;
  strategyAddTwo: MdexStrategyAddOptimal;
  strategyReinvest: MdexStrategyReinvest;
  strategyLiquidate: MdexStrategyLiquidate;
  strategyWithdraw: MdexStrategyWithdrawMinimizeTrading;
  strategyClosePart: MdexStrategyPartialCloseLiquidate;
  workerConfigV2: WorkerConfigV2;
  workers: MdexWorkerV2[];
  tokens: MockERC20[];
};

const voidProvider = new ethers.VoidSigner(ethers.constants.AddressZero);
export const contracts: Contracts = {
  lens: LensV2__factory.connect(addresses.lens, voidProvider),
  oracle: SimplePriceOracle__factory.connect(addresses.oracle, voidProvider),
  access: Access__factory.connect(addresses.access, voidProvider),
  orderbook: Orderbook__factory.connect(addresses.orderbook, voidProvider),
  orderbookConfig: OrderbookConfig__factory.connect(
    addresses.orderbookConfig,
    voidProvider
  ),
  strategyAddTwo: MdexStrategyAddOptimal__factory.connect(
    addresses.strategyAddTwo,
    voidProvider
  ),
  strategyReinvest: MdexStrategyReinvest__factory.connect(
    addresses.strategyReinvest,
    voidProvider
  ),
  strategyLiquidate: MdexStrategyLiquidate__factory.connect(
    addresses.strategyLiquidate,
    voidProvider
  ),
  strategyWithdraw: MdexStrategyWithdrawMinimizeTrading__factory.connect(
    addresses.strategyWithdraw,
    voidProvider
  ),
  strategyClosePart: MdexStrategyPartialCloseLiquidate__factory.connect(
    addresses.strategyClosePart,
    voidProvider
  ),
  workerConfigV2: WorkerConfigV2__factory.connect(
    addresses.workerConfigV2,
    voidProvider
  ),
  workers: addresses.workers.map((address) =>
    MdexWorkerV2__factory.connect(address, voidProvider)
  ),
  tokens: addresses.tokens.map((address) =>
    MockERC20__factory.connect(address, voidProvider)
  ),
};

export function initContract(provider: any) {
  if (!provider) return contracts;
  const signer = provider; // ether.getSigner();
  for (const [key, value] of Object.entries(contracts)) {
    console.log(key);
    if (Array.isArray(value)) {
      (contracts as any)[key] = value.map((v) => v.connect(signer));
      continue;
    }
    (contracts as any)[key] = (value as any).connect(signer);
  }

  let _window: any = window;
  _window.contracts = contracts;
  return contracts;
}

function strategyEncodeData(
  address: string,
  exeABIs: string[] = [],
  exeArgs: any[] = []
): Buffer {
  const coder = new ethers.utils.AbiCoder();
  const exeData = coder.encode(exeABIs, exeArgs);
  const extData = coder.encode(["address", "bytes"], [address, exeData]);
  return Buffer.from(extData.slice(2), "hex");
}

export function strategyAddTwoData(minLPAmount: BigNumberish): Buffer {
  return strategyEncodeData(
    contracts.strategyAddTwo.address,
    ["uint256"],
    [minLPAmount]
  );
}

export function strategyLiquidateData(): Buffer {
  return strategyEncodeData(contracts.strategyLiquidate.address);
}

export function strategyClosePartData(returnLpToken: BigNumberish): Buffer {
  return strategyEncodeData(
    contracts.strategyClosePart.address,
    ["uint256"],
    [returnLpToken]
  );
}

export function strategyWithdrawData(
  minTokenA: BigNumberish,
  minTokenB: BigNumberish
): Buffer {
  return strategyEncodeData(
    <string>contracts.strategyWithdraw.address,
    ["uint256", "uint256"],
    [minTokenA, minTokenB]
  );
}
