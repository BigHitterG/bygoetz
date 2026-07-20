"use client";

type GardenMembershipOfferProps = {
  open: boolean;
  planted: number;
  onClose: () => void;
  onJoin: () => void;
  onLater: () => void;
};

export function GardenMembershipOffer({
  open,
  planted,
  onClose,
  onJoin,
  onLater,
}: GardenMembershipOfferProps) {
  if (!open) return null;

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
        <p className="cg-kicker">Your garden has begun</p>
        <h2 id="membership-offer-title">Keep this garden growing</h2>
        <p>
          You planted {Math.min(3, planted)} preview flowers. Garden Membership
          keeps them, saves your Care, and opens permanent planting, paths,
          upgrades, and new land across your devices.
        </p>
        <ul>
          <li>Keep these flowers and your remaining Care</li>
          <li>Grow and customize My Garden without the preview limit</li>
          <li>One payment · no subscription</li>
        </ul>
        <div className="cg-membership-offer-price">
          <span>Garden Membership</span>
          <strong>$6.99</strong>
        </div>
        <button
          className="cg-membership-offer-join"
          type="button"
          onClick={onJoin}
        >
          Keep my garden · $6.99
        </button>
        <button
          className="cg-membership-offer-later"
          type="button"
          onClick={onLater}
        >
          Not yet · return to the free Community Garden
        </button>
      </section>
    </div>
  );
}
