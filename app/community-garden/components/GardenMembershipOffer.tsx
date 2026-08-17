"use client";

import { FormEvent, useState } from "react";
import { GARDEN_MEMBERSHIP_PRICE_LABEL } from "@/lib/communityGarden/membershipConfig";
import { BasilPolicyLinks } from "./BasilPolicyLinks";

export type GardenMembershipCredentials = {
  email: string;
  password: string;
  promoCode?: string;
};

type GardenMembershipOfferProps = {
  open: boolean;
  planted: number;
  gardenPlantCount: number;
  gardenPathCount: number;
  gardenElementCount: number;
  careBalance: number;
  lifetimeCare: number;
  stage: "soft" | "hard";
  onClose: () => void;
  onJoin: (credentials: GardenMembershipCredentials) => void;
  onLater: () => void;
  onAccount: () => void;
  accountReady?: boolean;
  checkoutBusy?: boolean;
  checkoutError?: string;
};

export function GardenMembershipOffer({
  open,
  planted,
  gardenPlantCount,
  gardenPathCount,
  gardenElementCount,
  careBalance,
  lifetimeCare,
  stage,
  onClose,
  onJoin,
  onLater,
  onAccount,
  accountReady = false,
  checkoutBusy = false,
  checkoutError = "",
}: GardenMembershipOfferProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [formError, setFormError] = useState("");

  if (!open) return null;

  const isSoft = stage === "soft";
  const title = isSoft
    ? "Keep this garden growing"
    : "Your preview garden is full";
  const description = isSoft
    ? `You planted ${planted} flowers of your own. Garden Membership turns this temporary preview into a lasting place you can keep building.`
    : `You planted all ${planted} preview flowers. Upgrade to save this garden and keep growing without the preview limit.`;

  function submitMembership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setFormError("Enter the email you want to use for Basil.");
      return;
    }
    if (password.length < 10 || password.length > 128) {
      setFormError("Use a password between 10 and 128 characters.");
      return;
    }
    if (password !== passwordConfirm) {
      setFormError("Those passwords do not match.");
      return;
    }
    setFormError("");
    onJoin({
      email: normalizedEmail,
      password,
      promoCode: promoCode.trim().toLowerCase() || undefined,
    });
  }

  function leaveOffer(action: () => void) {
    setFormError("");
    setPassword("");
    setPasswordConfirm("");
    setPromoCode("");
    action();
  }

  return (
    <div
      className="cg-membership-offer-scrim"
      role="presentation"
      onPointerDown={() => leaveOffer(onClose)}
    >
      <section
        className="cg-membership-offer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="membership-offer-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <p className="cg-kicker">
          {isSoft ? "Your garden has begun" : "Your garden is ready to keep"}
        </p>
        <h2 id="membership-offer-title">{title}</h2>
        <p>{description}</p>
        <div className="cg-membership-comparison">
          <section
            className="cg-membership-comparison-panel is-current"
            aria-label="The garden you made"
          >
            <p>Your garden now</p>
            <h3>Keep this garden growing</h3>
            <ul>
              <li>
                <span className="is-flower" aria-hidden="true" />
                <strong>{gardenPlantCount}</strong> flowers arranged
              </li>
              <li>
                <span className="is-path" aria-hidden="true" />
                <strong>{gardenPathCount}</strong> paths placed
              </li>
              <li>
                <span className="is-item" aria-hidden="true" />
                <strong>{gardenElementCount}</strong> garden items
              </li>
              <li>
                <span className="is-care" aria-hidden="true" />
                <strong>{careBalance.toLocaleString()}</strong> Care ready
              </li>
            </ul>
          </section>
          <section
            className="cg-membership-comparison-panel is-membership"
            aria-label="What Garden Membership adds"
          >
            <p>What membership adds</p>
            <h3>What you are missing</h3>
            <ul>
              <li>
                <span className="is-save" aria-hidden="true" />
                <strong>Save</strong> this exact garden
              </li>
              <li>
                <span className="is-land" aria-hidden="true" />
                <strong>Expand</strong> into more land
              </li>
              <li>
                <span className="is-build" aria-hidden="true" />
                <strong>Unlock</strong> the full collection
              </li>
              <li>
                <span className="is-return" aria-hidden="true" />
                <strong>Return</strong> on any device
              </li>
            </ul>
          </section>
        </div>
        <p className="cg-membership-lifetime-note">
          You have already earned {lifetimeCare.toLocaleString()} lifetime Care.
        </p>
        <div className="cg-membership-offer-price">
          <span>Garden Membership · one time</span>
          <strong>{GARDEN_MEMBERSHIP_PRICE_LABEL}</strong>
        </div>
        <div className="cg-membership-gift-code is-prominent">
          <label htmlFor="basil-membership-promo">
            Have a gift code?
          </label>
          <input
            id="basil-membership-promo"
            type="text"
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value.toLowerCase())}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={32}
            placeholder="enter gift code"
            disabled={checkoutBusy}
          />
          <small>A valid gift code activates membership without payment.</small>
        </div>
        {accountReady ? (
          <div className="cg-membership-offer-account">
            <div className="cg-membership-offer-account-heading">
              <strong>Your private Basil account is ready</strong>
              <span>This payment will stay with the account already signed in.</span>
            </div>
            {checkoutError ? (
              <p className="cg-steward-notice" role="alert">{checkoutError}</p>
            ) : null}
            <button
              className="cg-membership-offer-join"
              type="button"
              onClick={() =>
                onJoin({
                  email: "",
                  password: "",
                  promoCode: promoCode.trim().toLowerCase() || undefined,
                })
              }
              disabled={checkoutBusy}
            >
              {checkoutBusy
                ? "Opening your garden…"
                : promoCode.trim()
                  ? "Use gift code & keep my garden"
                  : `Pay & keep my garden · ${GARDEN_MEMBERSHIP_PRICE_LABEL}`}
            </button>
          </div>
        ) : (
        <form className="cg-membership-offer-account" onSubmit={submitMembership}>
          <div className="cg-membership-offer-account-heading">
            <strong>Create your private Basil account</strong>
            <span>No public username. Verify your email after payment.</span>
          </div>
          <label htmlFor="basil-membership-email">Email address</label>
          <input
            id="basil-membership-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            disabled={checkoutBusy}
            required
          />
          <label htmlFor="basil-membership-password">Password</label>
          <input
            id="basil-membership-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={10}
            maxLength={128}
            disabled={checkoutBusy}
            required
          />
          <label htmlFor="basil-membership-password-confirm">Confirm password</label>
          <input
            id="basil-membership-password-confirm"
            type="password"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            autoComplete="new-password"
            minLength={10}
            maxLength={128}
            disabled={checkoutBusy}
            required
          />
          <small>Use at least 10 characters.</small>
          {formError || checkoutError ? (
            <>
              <p className="cg-steward-notice" role="alert">
                {formError || checkoutError}
              </p>
              {checkoutError.toLowerCase().includes("account already exists") ? (
                <button
                  className="cg-membership-offer-account-link"
                  type="button"
                  onClick={() => leaveOffer(onAccount)}
                  disabled={checkoutBusy}
                >
                  Sign in or recover this account
                </button>
              ) : null}
            </>
          ) : null}
          <button
            className="cg-membership-offer-join"
            type="submit"
            disabled={checkoutBusy}
          >
            {checkoutBusy
              ? "Opening your garden…"
              : promoCode.trim()
                ? "Create account & use gift code"
                : `Create account & pay · ${GARDEN_MEMBERSHIP_PRICE_LABEL}`}
          </button>
        </form>
        )}
        <button
          className="cg-membership-offer-later"
          type="button"
          onClick={() => leaveOffer(onLater)}
          disabled={checkoutBusy}
        >
          {isSoft ? "Keep growing for now" : "Return to Community Garden"}
        </button>
        <p className="cg-membership-legal-copy">
          By creating an account or purchasing, you agree to Basil&apos;s Terms and
          acknowledge the Privacy and Refund policies. Garden Members receive the
          monthly Basil Garden Letter and can unsubscribe at any time.
        </p>
        <BasilPolicyLinks compact />
      </section>
    </div>
  );
}
