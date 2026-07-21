"use client";

import { FormEvent, useState } from "react";

export type GardenMembershipCredentials = {
  email: string;
  password: string;
};

type GardenMembershipOfferProps = {
  open: boolean;
  planted: number;
  stage: "soft" | "hard" | "expired";
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
  const [formError, setFormError] = useState("");

  if (!open) return null;

  const isSoft = stage === "soft";
  const isExpired = stage === "expired";
  const title = isSoft
    ? "Keep this garden growing"
    : isExpired
      ? "Save your temporary garden"
      : "Your preview garden is full";
  const description = isSoft
    ? `You planted ${planted} flowers of your own. Save them now, or keep playing this 24-hour temporary preview up to ten flowers.`
    : isExpired
      ? "Your 24-hour preview has ended. Your work is still here and ready to save with Garden Membership."
      : `You planted all ${planted} preview flowers. Join to save this garden and keep growing without the preview limit.`;

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
    onJoin({ email: normalizedEmail, password });
  }

  function leaveOffer(action: () => void) {
    setFormError("");
    setPassword("");
    setPasswordConfirm("");
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
        <div className="cg-membership-offer-art" aria-hidden="true">
          <span className="is-one" />
          <span className="is-two" />
          <span className="is-three" />
        </div>
        <p className="cg-kicker">
          {isSoft ? "Your garden has begun" : "Your garden is ready to keep"}
        </p>
        <h2 id="membership-offer-title">{title}</h2>
        <p>{description}</p>
        <ul>
          <li>Keep these flowers and your remaining Care</li>
          <li>Grow and customize My Garden without the preview limit</li>
          <li>One payment · no subscription</li>
        </ul>
        <div className="cg-membership-offer-price">
          <span>Garden Membership</span>
          <strong>$6.99</strong>
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
              onClick={() => onJoin({ email: "", password: "" })}
              disabled={checkoutBusy}
            >
              {checkoutBusy ? "Saving your garden…" : "Pay & keep my garden · $6.99"}
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
            {checkoutBusy ? "Saving your garden…" : "Create account & pay · $6.99"}
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
      </section>
    </div>
  );
}
