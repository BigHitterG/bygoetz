import { withSiteBasePath } from "@/lib/sitePath";
import { GardenGuide } from "./GardenGuide";
import { SupportGarden } from "./SupportGarden";

type GardenMenuProps = {
  open: boolean;
  donationUrl?: string;
  onClose: () => void;
};

export function GardenMenu({ open, donationUrl, onClose }: GardenMenuProps) {
  if (!open) return null;

  return (
    <div className="cg-menu-scrim" role="presentation" onPointerDown={onClose}>
      <aside
        className="cg-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="garden-menu-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="cg-menu-heading">
          <div>
            <p className="cg-kicker">Community Garden</p>
            <h2 id="garden-menu-title">Garden menu</h2>
          </div>
          <button className="cg-icon-button" type="button" onClick={onClose} aria-label="Close menu">
            <span aria-hidden="true">X</span>
          </button>
        </div>

        <GardenGuide />

        <SupportGarden donationUrl={donationUrl} />

        <a className="cg-back-link" href={withSiteBasePath("/")}>
          Back to By Goetz
        </a>
      </aside>
    </div>
  );
}

