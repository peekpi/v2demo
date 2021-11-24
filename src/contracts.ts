import { ethers, BigNumberish, BigNumber } from "ethers";
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
  wnative: MockERC20;
};

const voidProvider = new ethers.VoidSigner(ethers.constants.AddressZero);
export const contracts: Contracts = {
  lens: LensV2__factory.connect(addresses.lens, voidProvider),
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
  wnative: MockERC20__factory.connect(addresses.wnative, voidProvider)
};

export function initContract(provider: any) {
  if (!provider) return contracts;
  const signer = provider; // ether.getSigner();
  for (const [key, value] of Object.entries(contracts)) {
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

function sqrt(x: BigNumber): BigNumber {
  if (x.eq(0)) return BigNumber.from(0);
  let xx = BigNumber.from(x);
  let r = BigNumber.from(1);

  if (xx.gte("0x100000000000000000000000000000000")) {
    xx = xx.shr(128);
    r = r.shl(64);
  }

  if (xx.gte("0x10000000000000000")) {
    xx = xx.shr(64);
    r = r.shl(32);
  }
  if (xx.gte("0x100000000")) {
    xx = xx.shr(32);
    r = r.shl(16);
  }
  if (xx.gte("0x10000")) {
    xx = xx.shr(16);
    r = r.shl(8);
  }
  if (xx.gte("0x100")) {
    xx = xx.shr(8);
    r = r.shl(4);
  }
  if (xx.gte("0x10")) {
    xx = xx.shr(4);
    r = r.shl(2);
  }
  if (xx.gte("0x8")) {
    r = r.shl(1);
  }

  r = r.add(x.div(r)).shr(1);
  r = r.add(x.div(r)).shr(1);
  r = r.add(x.div(r)).shr(1);
  r = r.add(x.div(r)).shr(1);
  r = r.add(x.div(r)).shr(1);
  r = r.add(x.div(r)).shr(1);
  r = r.add(x.div(r)).shr(1); // Seven iterations should be enough
  const r1 = x.div(r);
  return r.lt(r1) ? r : r1;
}

function _optimalDepositA(
  amtA: BigNumber,
  amtB: BigNumber,
  resA: BigNumber,
  resB: BigNumber
): BigNumber {
  if (!amtA.mul(resB).gte(amtB.mul(resA))) throw "Reserved";
  const fee = 30;
  const a = BigNumber.from(10000).sub(fee);
  const b = BigNumber.from(20000).sub(fee).mul(resA);
  const _c = amtA.mul(resB).sub(amtB.mul(resA));
  const c = _c.mul(10000).div(amtB.add(resB)).mul(resA);

  const d = a.mul(c).mul(4);
  const e = sqrt(b.mul(b).add(d));

  const numerator = e.sub(b);
  const denominator = a.mul(2);

  return numerator.div(denominator);
}

export function optimalDepositA(
  amtA: BigNumber,
  amtB: BigNumber,
  resA: BigNumber,
  resB: BigNumber
): [BigNumber,Boolean] {
  if (amtA.mul(resB).gte(amtB.mul(resA)))
    return [_optimalDepositA(amtA, amtB, resA, resB), false];
  return [_optimalDepositA(amtB, amtA, resB, resA), true];
}

const FEE = 997;
const FEE_DENOM = 1000;
export function getMktSellAmount(
  aIn:BigNumber,
  rIn:BigNumber,
  rOut:BigNumber
) :BigNumber {
  if (aIn.eq(0)) return BigNumber.from(0);
  if(!(rIn.gt(0) && rOut.gt(0))) throw 'MdexWorkerV2::getMktSellAmount:: bad reserve values';
  const aInWithFee = aIn.mul(FEE);
  const numerator = aInWithFee.mul(rOut);
  const denominator = rIn.mul(FEE_DENOM).add(aInWithFee);
  return numerator.div(denominator);
}