import { useWeb3React } from "@web3-react/core";
import { useEagerConnect } from "./hooks";
import { MetaMask } from "./wallet";
import { ethers, BigNumber } from "ethers";
import {
  getAmountIn,
  getAmountOut,
  getMktSellAmount,
  initContract,
  optimalDepositA,
  quote,
  deLpAmount,
  addLp,
  strategyAddTwoData,
  strategyClosePartData,
  strategyWithdrawData,
  health,
  strategyAddSimu,
  strategyCloseSimu,
  strategyDecSimu,
  SimuResult,
} from "./contracts";
import {
  Button,
  InputGroup,
  DropdownButton,
  Dropdown,
  FormControl,
  Table,
  Navbar,
} from "react-bootstrap";

import { useEffect, useState } from "react";
import { LensV2 } from "./typechain";

type WorkData = {
  orderid: string;
  token0: number; // index
  token1: number; // index
  amount0: string;
  amount1: string;
  debt0: string;
  debt1: string;
  maxReturn0: string;
  maxReturn1: string;
  strategyType: number;
  strategyData1: string[];
  strategyData2: string[];
  strategyData3: string[];
};

type OrderbookInfo = {
  orderLength: number;
  tokens: {
    symbol: string;
    decimals: number;
    balance: BigNumber;
  }[];
  workers: Map<string, string>;
  workerPair: Map<string, number[]>;
};

type OrderInfo = {
  orderid: string;
  user: string;
  worker: string;
  lpAmount: BigNumber;
  health: BigNumber;
  debt: BigNumber;
  killFactor: BigNumber;
  workFactor: BigNumber;
  tokens: {
    name: string;
    decimals: number;
    amount: BigNumber;
    debt: BigNumber;
    flux: BigNumber;
  }[];
};
type Faucet = {
  token: number;
  amount: string;
};

type UnPromise<T> = T extends Promise<infer U> ? U : T;
type WorkerInfo = UnPromise<ReturnType<LensV2["getWorkerInfo"]>>;

const openPos = ethers.constants.MaxUint256.toHexString();
let periodMs = 100000;
export function DemoAccount(props: { rate: any }) {
  const context = useWeb3React();
  const { activate, active } = context;
  const [contracts, setContracts] = useState(initContract(undefined));
  const [orderbookInfo, setOrderbookInfo] = useState({
    orderLength: 0,
    tokens: [],
    workers: new Map<string, string>(),
    workerPair: new Map<string, number[]>(),
  } as OrderbookInfo);
  const [workerInfos, setWorkerInfos] = useState([] as WorkerInfo[]);
  const [workData, setWorkData] = useState({
    orderid: openPos,
    strategyData1: [""],
    strategyData2: ["", ""],
    strategyData3: [""],
  } as WorkData);
  const [orderInfo, setOrderInfo] = useState({
    tokens: [] as any[],
  } as OrderInfo);
  const [faucet, setFacuet] = useState({} as Faucet);
  useEagerConnect();
  props.rate(active ? periodMs : 0);
  useEffect(() => {
    if (!active) return;
    (async () => {
      const provider = await MetaMask.getProvider();
      const ether = new ethers.providers.Web3Provider(provider);
      setContracts(initContract(ether.getSigner()));
      const tokens = [] as typeof orderbookInfo.tokens;

      for (const token of contracts.tokens) {
        console.log('token:', token.address)
        tokens.push({
          decimals: Number(await token.decimals()),
          symbol: await token.symbol(),
          balance: await token.balanceOf(context.account as string),
        });
      }
      for (const worker of contracts.workers) {
        const token0 = await worker.token0();
        const token1 = await worker.token1();
        orderbookInfo.workers.set(token0 + token1, worker.address);
        orderbookInfo.workerPair.set(worker.address, [
          contracts.tokens.findIndex((token) => token.address == token0),
          contracts.tokens.findIndex((token) => token.address == token1),
        ]);
      }
      const workerInfos = await contracts.lens.getWorkerInfos(
        contracts.workers.map((worker) => worker.address)
      );
      setWorkerInfos(workerInfos);
      orderbookInfo.tokens = tokens;
      orderbookInfo.orderLength = Number(
        await contracts.orderbook.orderLength()
      );
      periodMs /= Math.max(orderbookInfo.orderLength, 10);
      props.rate(periodMs);
      setOrderbookInfo({ ...orderbookInfo });
    })();
  }, [active]);

  async function connect() {
    console.log("active:", active);
    if (!active) await activate(MetaMask);
    //const token = ERC20__factory.connect('0x7874f0Fc3F7299F3e0EBBdd7EFa8AcddE7885880', ether.getSigner());
    //_window.token = token;
    //await multicallx(ether);
  }

  async function doFaucet() {
    try {
      await contracts.tokens[faucet.token].mint(
        context.account as string,
        ethers.utils.parseUnits(
          faucet.amount,
          orderbookInfo.tokens[faucet.token]?.decimals
        )
      );
    } catch (e) {
      console.log(e);
    }
  }

  function selectStrategy(typ: number) {
    workData.strategyType = typ;
    setWorkData({ ...workData });
  }

  function getWorkParams() {
    const toDecimals = (amount: string, decimals: number) =>
      ethers.utils.parseUnits(amount, decimals);
    const decimals0 = orderbookInfo.tokens[workData.token0].decimals;
    const decimals1 = orderbookInfo.tokens[workData.token1].decimals;
    const tokenParams = [
      {
        token: contracts.tokens[workData.token0],
        symbol: orderbookInfo.tokens[workData.token0].symbol,
        decimals: decimals0,
        amount: toDecimals(workData.amount0, decimals0),
        debt: toDecimals(workData.debt0, decimals0),
        maxReturn: toDecimals(workData.maxReturn0, decimals0),
      },
      {
        token: contracts.tokens[workData.token1],
        decimals: decimals1,
        symbol: orderbookInfo.tokens[workData.token1].symbol,
        amount: toDecimals(workData.amount1, decimals1),
        debt: toDecimals(workData.debt1, decimals1),
        maxReturn: toDecimals(workData.maxReturn1, decimals1),
      },
    ];
    const pair = tokenParams.map((param) => param.token.address);
    const isReverse = !orderbookInfo.workers.has(pair.join(""));
    if (isReverse) {
      tokenParams.reverse();
      pair.reverse();
    }
    const worker = orderbookInfo.workers.get(pair.join("")) as string;
    const zero = BigNumber.from(0);
    const strategyDatas = {
      strategyData1: zero,
      strategyData2: [zero, zero],
      strategyData3: zero,
    };
    try {
      if (workData.strategyType == 1) {
        strategyDatas.strategyData1 = toDecimals(workData.strategyData1[0], 18);
      }

      if (workData.strategyType == 2) {
        const strategyData2 = [...workData.strategyData2];
        if (isReverse) strategyData2.reverse();
        strategyDatas.strategyData2 = [
          toDecimals(strategyData2[0], tokenParams[0].decimals),
          toDecimals(strategyData2[1], tokenParams[1].decimals),
        ];
      }
      if (workData.strategyType == 3) {
        strategyDatas.strategyData3 = toDecimals(workData.strategyData3[0], 18);
      }
    } catch (e) {}
    return {
      worker,
      tokenParams,
      strategyDatas,
    };
  }

  async function dowork() {
    const { worker, tokenParams, strategyDatas } = getWorkParams();

    let strategyData = Buffer.alloc(0);

    if (workData.strategyType == 1) {
      strategyData = strategyAddTwoData(strategyDatas.strategyData1);
    }

    if (workData.strategyType == 2) {
      strategyData = strategyWithdrawData(
        strategyDatas.strategyData2[0],
        strategyDatas.strategyData2[1]
      );
    }
    if (workData.strategyType == 3) {
      strategyData = strategyClosePartData(strategyDatas.strategyData3);
    }

    const orderbook = contracts.orderbook;
    const account = context.account as string;

    let nativeAmount = ethers.constants.Zero;
    for (const tokenParam of tokenParams) {
      if(tokenParam.token.address == contracts.wnative.address) {
        nativeAmount = tokenParam.amount;
        continue;
      }
      const allowance = await tokenParam.token.allowance(
        account,
        orderbook.address
      );
      if (!tokenParam.amount.lt(allowance))
        await tokenParam.token.approve(
          orderbook.address,
          ethers.constants.MaxUint256
        );
    }

    const [p0, p1] = tokenParams;
    await contracts.orderbook.work(
      workData.orderid,
      worker,
      p0.amount,
      p0.debt,
      p1.amount,
      p1.debt,
      p0.maxReturn,
      p1.maxReturn,
      strategyData,
      {
        value:nativeAmount
      }
    );
  }

  async function flush() {
    orderbookInfo.orderLength = Number(await contracts.orderbook.orderLength());
    setOrderbookInfo({ ...orderbookInfo });
    periodMs *= 1.05;
    props.rate(periodMs);
  }

  async function work() {
    try {
      await dowork();
      periodMs *= 0.8;
      props.rate(periodMs);
    } catch (e) {
      console.log(e);
    }
  }
  async function kill() {
    try {
      await contracts.orderbook.kill(workData.orderid);
      periodMs *= 0.8;
      props.rate(periodMs);
    } catch (e) {
      console.log(e);
    }
  }
  async function getRewards() {
    try {
      await contracts.orderbook.withdrawReward(workData.orderid);
      periodMs *= 0.9;
      props.rate(periodMs);
    } catch (e) {
      console.log(e);
    }
  }
  async function getOrder() {
    if (workData.orderid == openPos) return;
    try {
      const _orderInfo = await contracts.lens.orderInfo(workData.orderid);
      periodMs *= 1.1;
      props.rate(periodMs);
      const worker = _orderInfo.worker;
      const tokenXs = orderbookInfo.workerPair.get(worker) as number[];
      const tokenInfos = tokenXs.map((i) => orderbookInfo.tokens[i]);
      setWorkData({
        ...workData,
        token0: tokenXs[0],
        token1: tokenXs[1],
        amount0: "0",
        debt0: "0",
        amount1: "0",
        debt1: "0",
        maxReturn0: ethers.utils.formatUnits(
          _orderInfo.debt0,
          tokenInfos[0].decimals
        ),
        maxReturn1: ethers.utils.formatUnits(
          _orderInfo.debt1,
          tokenInfos[1].decimals
        ),
        strategyData2: [
          ethers.utils.formatUnits(0, tokenInfos[0].decimals),
          ethers.utils.formatUnits(0, tokenInfos[1].decimals),
        ],
        strategyData3: [ethers.utils.formatUnits(_orderInfo.lpAmount, 18)],
        strategyType: 2,
      });
      setOrderInfo({
        orderid: workData.orderid,
        user: _orderInfo.user,
        lpAmount: _orderInfo.lpAmount,
        worker: _orderInfo.worker,
        killFactor: _orderInfo.killFactor,
        workFactor: _orderInfo.workFactor,
        health: _orderInfo.health,
        debt: _orderInfo.debt,
        tokens: [
          {
            name: tokenInfos[0].symbol,
            decimals: tokenInfos[0].decimals,
            amount: _orderInfo.amount0,
            debt: _orderInfo.debt0,
            flux: _orderInfo.flux0,
          },
          {
            name: tokenInfos[1].symbol,
            decimals: tokenInfos[1].decimals,
            amount: _orderInfo.amount1,
            debt: _orderInfo.debt1,
            flux: _orderInfo.flux1,
          },
        ],
      });
    } catch (e) {}
  }

  return (
    <div>
      <Button variant="link" href="https://pancake.kiemtienonline360.com/#/swap" target="_blank">Goto SWAP</Button>
      {!active ? (
        <Button onClick={connect}>connect</Button>
      ) : (
        <Navbar expand="lg" variant="dark">
          account: {context.account}
        </Navbar>
      )}
      <div>
        <InputGroup className="mb-3">
          <DropdownButton
            variant="warning"
            title="orderid"
            onSelect={(e) => setWorkData({ ...workData, orderid: e as string })}
          >
            {[
              openPos,
              ...Array.from(Array(orderbookInfo.orderLength).keys()),
            ].map((orderID) => (
              <Dropdown.Item eventKey={orderID} key={orderID}>
                {orderID}
              </Dropdown.Item>
            ))}
          </DropdownButton>
          <FormControl
            placeholder="order ID"
            value={workData.orderid}
            onChange={(e) =>
              setWorkData({ ...workData, orderid: e.target.value })
            }
          />
          <Button onClick={flush}>??????</Button>
        </InputGroup>
        <InputGroup className="mb-3">
          <DropdownButton
            onSelect={(e) => setWorkData({ ...workData, token0: Number(e) })}
            variant="warning"
            title={orderbookInfo.tokens[workData.token0]?.symbol || "token0"}
          >
            {orderbookInfo.tokens.map(({ symbol }, index) => (
              <Dropdown.Item eventKey={index} key={index}>
                {symbol}
              </Dropdown.Item>
            ))}
          </DropdownButton>
          <FormControl
            placeholder="????????????"
            value={workData.amount0}
            onChange={(e) =>
              setWorkData({ ...workData, amount0: e.target.value })
            }
          />
          <FormControl
            placeholder="????????????"
            value={workData.debt0}
            onChange={(e) =>
              setWorkData({ ...workData, debt0: e.target.value })
            }
          />
          <FormControl
            placeholder="??????????????????"
            value={workData.maxReturn0}
            onChange={(e) =>
              setWorkData({ ...workData, maxReturn0: e.target.value })
            }
          />
        </InputGroup>
        <InputGroup className="mb-3">
          <DropdownButton
            onSelect={(e) => setWorkData({ ...workData, token1: Number(e) })}
            variant="warning"
            title={orderbookInfo.tokens[workData.token1]?.symbol || "token1"}
          >
            {orderbookInfo.tokens.map(({ symbol }, index) => (
              <Dropdown.Item eventKey={index} key={index}>
                {symbol}
              </Dropdown.Item>
            ))}
          </DropdownButton>
          <FormControl
            placeholder="????????????"
            value={workData.amount1}
            onChange={(e) =>
              setWorkData({ ...workData, amount1: e.target.value })
            }
          />
          <FormControl
            placeholder="????????????"
            value={workData.debt1}
            onChange={(e) =>
              setWorkData({ ...workData, debt1: e.target.value })
            }
          />
          <FormControl
            placeholder="??????????????????"
            value={workData.maxReturn1}
            onChange={(e) =>
              setWorkData({ ...workData, maxReturn1: e.target.value })
            }
          />
        </InputGroup>
        <div>
          <InputGroup className="mb-3">
            <InputGroup.Radio
              checked={workData.strategyType == 1}
              onClick={() => selectStrategy(1)}
            />
            <InputGroup.Text id="basic-addon1">??????/??????</InputGroup.Text>
            <FormControl
              placeholder="????????????lp??????"
              onChange={(e) =>
                setWorkData({ ...workData, strategyData1: [e.target.value] })
              }
            />
          </InputGroup>
          <InputGroup className="mb-3">
            <InputGroup.Radio
              checked={workData.strategyType == 2}
              onClick={() => selectStrategy(2)}
            />
            <InputGroup.Text id="basic-addon1">??????</InputGroup.Text>
            <FormControl
              placeholder="????????????token0??????"
              value={workData.strategyData2[1]}
              onChange={(e) =>
                setWorkData({
                  ...workData,
                  strategyData2: [workData.strategyData2[0], e.target.value],
                })
              }
            />
            <InputGroup.Text>
              {orderbookInfo.tokens[workData.token0]?.symbol}
            </InputGroup.Text>
            <FormControl
              placeholder="????????????token1??????"
              value={workData.strategyData2[0]}
              onChange={(e) =>
                setWorkData({
                  ...workData,
                  strategyData2: [e.target.value, workData?.strategyData2[1]],
                })
              }
            />
            <InputGroup.Text>
              {orderbookInfo.tokens[workData.token1]?.symbol}
            </InputGroup.Text>
          </InputGroup>
          <InputGroup className="mb-3">
            <InputGroup.Radio
              checked={workData.strategyType == 3}
              onClick={() => selectStrategy(3)}
            />
            <InputGroup.Text id="basic-addon1">??????</InputGroup.Text>
            <FormControl
              placeholder="??????LP??????"
              value={workData.strategyData3[0]}
              onChange={(e) =>
                setWorkData({ ...workData, strategyData3: [e.target.value] })
              }
            />
          </InputGroup>
          {orderInfo.orderid == workData.orderid ? (
            <InputGroup>
              <InputGroup.Text id="basic-addon1">????????????</InputGroup.Text>
              {orderInfo.tokens.map((token) => {
                const lpAmount = orderInfo.lpAmount.gt(0)
                  ? orderInfo.lpAmount
                  : 1;
                const amount = ethers.utils
                  .parseEther(workData.strategyData3[0])
                  .mul(token.amount)
                  .div(lpAmount);
                return [
                  <FormControl
                    disabled
                    placeholder="??????token0??????"
                    value={ethers.utils.formatUnits(amount, token.decimals)}
                  />,
                  <Button>{token.name}</Button>,
                ];
              })}
            </InputGroup>
          ) : undefined}
        </div>
        {(() => {
          if (!workData.debt0) return null;
          if (!workData.amount0) return null;
          if (!workData.maxReturn0) return null;
          if (!workData.amount1) return null;
          if (!workData.debt1) return null;
          if (!workData.maxReturn1) return null;
          const { worker, tokenParams, strategyDatas } = getWorkParams();
          const info =
            workerInfos[
              contracts.workers.findIndex(
                (workerC) => workerC.address == worker
              )
            ];
          const zero = BigNumber.from(0);
          const orderData = workData.orderid == orderInfo.orderid ? {
            debt0: orderInfo.tokens[0].debt,
            debt1: orderInfo.tokens[1].debt,
            lpAmount: orderInfo.lpAmount,
          } : {
            debt0: zero,
            debt1: zero,
            lpAmount: zero,
          };
          const lpinfo = {
            totalSupply: info.lpTotalSupply,
            r0: info.r0,
            r1: info.r1,
          };
          const baseParams = tokenParams.map(param=>({
            amount:param.amount,
            debt: param.debt,
            maxReturn: param.maxReturn,
          }))
          let result = {} as SimuResult;
          if (workData.strategyType == 1) {
             result = strategyAddSimu(orderData, lpinfo, baseParams, strategyDatas.strategyData1);
          }else if(workData.strategyType == 2) {
             result = strategyCloseSimu(orderData, lpinfo, baseParams, strategyDatas.strategyData2);
          }else if (workData.strategyType == 3) {
             result = strategyDecSimu(orderData, lpinfo, baseParams, strategyDatas.strategyData3);
          }

          let _window: any = window;
          _window.result = result;
          console.log("result:", result)

          return (
            <div>
              <Navbar expand="lg" variant="dark">
                ????????????{result.ratio}%
              </Navbar>
              <Navbar expand="lg" variant="dark">
                ??????:
                {ethers.utils.formatUnits(
                  result.swapAmt,
                  tokenParams[result.reverse ? 1 : 0].decimals
                )}{" "}
                {tokenParams[result.reverse ? 1 : 0].symbol} ?????????:
                {ethers.utils.formatUnits(
                  result.swapAmt.mul(3).div(1000),
                  tokenParams[result.reverse ? 1 : 0].decimals
                )}
              </Navbar>
              <Navbar expand="lg" variant="dark">
                ??????: {ethers.utils.formatUnits(
                  result.back0,
                  tokenParams[0].decimals
                )}{" "}
                {tokenParams[0].symbol}
                {" "}
                {ethers.utils.formatUnits(
                  result.back1,
                  tokenParams[1].decimals
                )}{" "}
                {tokenParams[1].symbol}
              </Navbar>
            </div>
          );
        })()}
        <div>
          <p />
          <Button onClick={work}>??????</Button>
          {"   "}
          <Button variant="danger" onClick={kill}>
            ??????
          </Button>
          {"   "}
          <Button variant="info" onClick={getOrder}>
            ????????????
          </Button>
          {"   "}
          <Button variant="warning" onClick={getRewards}>
            ??????flux??????
          </Button>
          <p></p>
        </div>
      </div>
      <div style={{ textAlign: "left" }}>
        <Table variant="dark">
          <tbody>
            <tr>
              <td>orderId</td>
              <td>{orderInfo.orderid}</td>
            </tr>
            <tr>
              <td>user</td>
              <td>{orderInfo.user}</td>
            </tr>
            <tr>
              <td>lp??????</td>
              <td>
                {orderInfo.lpAmount
                  ? ethers.utils.formatEther(orderInfo.lpAmount)
                  : "-"}
              </td>
            </tr>
            <tr>
              <td>????????????({orderInfo.tokens[1]?.name})</td>
              <td>
                {orderInfo.debt
                  ? ethers.utils.formatUnits(
                      orderInfo.debt,
                      orderInfo.tokens[1].decimals
                    )
                  : ""}
              </td>
            </tr>
            <tr>
              <td>????????????({orderInfo.tokens[1]?.name})</td>
              <td>
                {" "}
                {orderInfo.health
                  ? ethers.utils.formatUnits(
                      orderInfo.health,
                      orderInfo.tokens[1].decimals
                    )
                  : ""}
              </td>
            </tr>
            <tr>
              <td>?????????</td>
              <td>
                {" "}
                {orderInfo.debt && orderInfo.debt.gt(0)
                  ? orderInfo.debt.mul(10000).div(orderInfo.health).toNumber() /
                    100
                  : ""}
                %
              </td>
            </tr>
            <tr>
              <td>???????????????</td>{" "}
              <td>
                {">"}
                {orderInfo.killFactor
                  ? orderInfo.killFactor.toNumber() / 100
                  : ""}
                %
              </td>
            </tr>
            <tr>
              <td>?????????????????????</td>
              <td>
                {" "}
                {"<="}
                {orderInfo.workFactor
                  ? orderInfo.workFactor.toNumber() / 100
                  : ""}
                %
              </td>
            </tr>
            {orderInfo.tokens.map((token) => (
              <tr key={token.name}>
                <td>{token.name}</td>
                <td>
                  <Table variant="dark">
                    <tbody>
                      <tr>
                        <td>??????</td>
                        <td>
                          {ethers.utils.formatUnits(
                            token.amount,
                            token.decimals
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>??????</td>
                        <td>
                          {ethers.utils.formatUnits(token.debt, token.decimals)}
                        </td>
                      </tr>
                      <tr>
                        <td>??????</td>
                        <td>
                          {ethers.utils.formatUnits(
                            token.amount.sub(token.debt),
                            token.decimals
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>FLUX??????</td>
                        <td> {ethers.utils.formatEther(token.flux)}</td>
                      </tr>
                    </tbody>
                  </Table>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <div>
        <InputGroup className="mb-3">
          <DropdownButton
            onSelect={(e) => setFacuet({ ...faucet, token: Number(e) })}
            variant="warning"
            title={orderbookInfo.tokens[faucet.token]?.symbol || "token"}
          >
            {orderbookInfo.tokens.map(({ symbol }, index) => (
              <Dropdown.Item eventKey={index} key={index}>
                {symbol}
              </Dropdown.Item>
            ))}
          </DropdownButton>
          <FormControl
            value={faucet.amount}
            onChange={(e) => setFacuet({ ...faucet, amount: e.target.value })}
          />
          <Button onClick={doFaucet} disabled={!active}>
            ???????????????
          </Button>
        </InputGroup>
        <p>
          {faucet.amount == "" ||
          isNaN(Number(faucet.amount)) ||
          !orderbookInfo.tokens[faucet.token]
            ? "-"
            : ethers.utils.formatUnits(
                ethers.utils.parseUnits(
                  faucet.amount,
                  orderbookInfo.tokens[faucet.token].decimals
                ),
                orderbookInfo.tokens[faucet.token].decimals
              )}
        </p>
        <ul style={{ textAlign: "left" }}>
          {contracts.tokens.map((token, i) => (
            <li key={token.address}>
              {orderbookInfo.tokens[i]?.symbol || ""}
              ----
              {orderbookInfo.tokens[i]
                ? ethers.utils.formatUnits(
                    orderbookInfo.tokens[i].balance,
                    orderbookInfo.tokens[i].decimals
                  )
                : ""}
              ----
              {false ? "" : token.address}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
