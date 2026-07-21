"use client";

type GardenMembershipOfferProps = {
  open: boolean;
  planted: number;
  stage: "soft" | "hard" | "expired";
  onClose: () => void;
  onJoin: () => void;
  onLater: () => void;
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
  checkoutBusy = false,
  checkoutError = "",
}: GardenMembershipOfferProps) {
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

  return (
    <div
      className="cg-membership-offer-scrim"
      role="presentation"
      onPointerDown={onClose}
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
        {checkoutError ? (
          <p className="cg-steward-notice" role="alert">{checkoutError}</p>
        ) : null}
        <button
          className="cg-membership-offer-join"
          type="button"
          onClick={onJoin}
          disabled={checkoutBusy}
        >
          {checkoutBusy ? "Saving your garden…" : "Keep my garden · $6.99"}
        </button>
        <button
          className="cg-membership-offer-later"
          type="button"
          onClick={onLater}
          disabled={checkoutBusy}
        >
          {isSoft ? "Keep growing for now" : "Return to Community Garden"}
        </button>
      </section>
    </div>
  );
}
