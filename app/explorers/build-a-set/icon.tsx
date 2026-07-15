import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
        }}
      >
        <img
          alt="Goetz"
          src="https://www.bygoetz.com/concepts/images/Logo-01.png"
          width={440}
          height={314}
          style={{ objectFit: "contain" }}
        />
      </div>
    ),
    size,
  );
}

