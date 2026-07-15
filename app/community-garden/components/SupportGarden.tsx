type SupportGardenProps = {
  donationUrl?: string;
};

export function SupportGarden({ donationUrl }: SupportGardenProps) {
  return (
    <section className="cg-support" aria-labelledby="support-garden-title">
      <p className="cg-kicker">Keep it growing</p>
      <h2 id="support-garden-title">Support the Garden</h2>
      <p>
        Basil is free. Contributions help keep the garden online and
        growing.
      </p>
      {donationUrl ? (
        <a className="cg-support-button" href={donationUrl} target="_blank" rel="noreferrer">
          Support the Garden
        </a>
      ) : (
        <p className="cg-support-unavailable">Support contributions are coming soon.</p>
      )}
      <small>Payments are securely handled by Stripe.</small>
    </section>
  );
}

