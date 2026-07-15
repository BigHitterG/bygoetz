import { ImageResponse } from "next/og";

export const alt = "Three Goetz Explorers prints displayed above a warm reading nook";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const artwork = ["Monkey.png", "Explorer.png", "Turtle.png"];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          background: "#f4efe7",
        }}
      >
        <img
          alt=""
          src="https://www.bygoetz.com/explorers/rooms/reading-nook.jpg"
          width={1200}
          height={800}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 44,
            left: 205,
            display: "flex",
            width: 790,
            height: 290,
            justifyContent: "space-between",
          }}
        >
          {artwork.map((file) => (
            <div
              key={file}
              style={{
                display: "flex",
                width: 225,
                height: 285,
                padding: 8,
                background: "#c59a64",
                boxShadow: "3px 5px 10px rgba(58, 45, 33, 0.22)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: "100%",
                  height: "100%",
                  padding: 25,
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(104, 87, 68, 0.16)",
                  background: "#fffdf9",
                }}
              >
                <img
                  alt=""
                  src={`https://www.bygoetz.com/explorers/${file}`}
                  width={165}
                  height={215}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}

