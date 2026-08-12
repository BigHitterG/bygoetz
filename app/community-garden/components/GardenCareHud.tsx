"use client";

import { useEffect, useRef, useState } from "react";
import type { GardenWorldMode } from "../game/gardenRenderer";

type CareReward = {
  amount: number;
  id: number;
};

type GardenCareHudProps = {
  balance: number;
  ready: boolean;
  temporary: boolean;
  world: GardenWorldMode;
};

export function GardenCareHud({
  balance,
  ready,
  temporary,
  world,
}: GardenCareHudProps) {
  const previousBalanceRef = useRef(balance);
  const readyRef = useRef(false);
  const rewardSequenceRef = useRef(0);
  const [reward, setReward] = useState<CareReward | null>(null);

  useEffect(() => {
    if (!ready) {
      readyRef.current = false;
      previousBalanceRef.current = balance;
      setReward(null);
      return;
    }
    if (!readyRef.current) {
      readyRef.current = true;
      previousBalanceRef.current = balance;
      return;
    }

    const previousBalance = previousBalanceRef.current;
    previousBalanceRef.current = balance;
    if (balance <= previousBalance) return;

    rewardSequenceRef.current += 1;
    setReward({
      amount: balance - previousBalance,
      id: rewardSequenceRef.current,
    });
    const timeout = window.setTimeout(() => setReward(null), 2_200);
    return () => window.clearTimeout(timeout);
  }, [balance, ready]);

  const balanceLabel = `${balance.toLocaleString()} ${temporary ? "temporary " : ""}Care available`;

  return (
    <aside
      key={reward?.id ?? "idle"}
      className={`cg-care-hud${reward ? " is-rewarding" : ""}${temporary ? " is-temporary" : ""}`}
      aria-label={balanceLabel}
      title={
        temporary
          ? "Care earned in this preview can be saved with Garden Membership."
          : "Earn Care by helping in the Community Garden. Spend it in My Garden."
      }
    >
      <span className="cg-care-hud-emblem" aria-hidden="true" />
      <span className="cg-care-hud-copy">
        <small>Care{temporary ? " · temporary" : ""}</small>
        <strong>{balance.toLocaleString()}</strong>
      </span>
      {reward ? (
        <span className="cg-care-hud-reward" role="status" aria-live="polite">
          +{reward.amount.toLocaleString()} {world === "community" ? "earned" : "returned"}
        </span>
      ) : null}
    </aside>
  );
}
