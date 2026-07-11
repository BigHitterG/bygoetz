type DownloadEmailItem = {
  title: string;
  url: string;
};

type DownloadEmailOptions = {
  items: DownloadEmailItem[];
  expiresInDays: number;
  siteUrl: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getFileSummary(items: DownloadEmailItem[]) {
  return items.length > 1
    ? "The bundle includes all eight Explorers artworks as 32 total files: 8x10 PNG, 8x10 PDF, 11x14 PNG, and 11x14 PDF for each artwork."
    : "This download includes 4 files for the artwork: 8x10 PNG, 8x10 PDF, 11x14 PNG, and 11x14 PDF.";
}

export function getDownloadEmailSubject(items: DownloadEmailItem[]) {
  return items.length > 1
    ? "Your Goetz download links are ready"
    : "Your Goetz download link is ready";
}

export function renderDownloadEmailText({ items, expiresInDays, siteUrl }: DownloadEmailOptions) {
  const links = items.map((item) => `${item.title}: ${item.url}`).join("\n");

  return `Thank you for your purchase from Goetz.\n\n${getFileSummary(items)}\n\nYour download link${
    items.length > 1 ? "s are" : " is"
  } ready:\n\n${links}\n\nClick the link${
    items.length > 1 ? "s" : ""
  } above to download your file${items.length > 1 ? "s" : ""}. The download should save to your computer's Downloads folder unless your browser asks where to save it.\n\nThe link${
    items.length > 1 ? "s" : ""
  } will expire in ${expiresInDays} days. These files are for personal use.\n\nIf anything goes wrong, reply to this email and I will help.\n\nGoetz\n${siteUrl}`;
}

export function renderDownloadEmailHtml({ items, expiresInDays, siteUrl }: DownloadEmailOptions) {
  const itemRows = items
    .map(
      (item) => `
        <tr>
          <td style="padding-top:16px;padding-right:0;padding-bottom:0;padding-left:0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #ded8ce;background-color:#ffffff;">
              <tr>
                <td style="padding-top:18px;padding-right:18px;padding-bottom:18px;padding-left:18px;font-family:Arial,Helvetica,sans-serif;color:#111111;">
                  <p style="margin-top:0;margin-right:0;margin-bottom:12px;margin-left:0;font-size:16px;line-height:24px;color:#111111;font-weight:bold;">${escapeHtml(
                    item.title,
                  )}</p>
                  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td bgcolor="#111111" style="background-color:#111111;padding-top:12px;padding-right:16px;padding-bottom:12px;padding-left:16px;">
                        <a href="${escapeHtml(
                          item.url,
                        )}" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;font-weight:bold;display:inline-block;">Download file</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Your Goetz digital download</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f4ee;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f4ee" style="border-collapse:collapse;background-color:#f7f4ee;">
    <tr>
      <td align="center" style="padding-top:32px;padding-right:16px;padding-bottom:32px;padding-left:16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:600px;background-color:#fffaf3;border:1px solid #ded8ce;">
          <tr>
            <td style="padding-top:32px;padding-right:28px;padding-bottom:28px;padding-left:28px;font-family:Arial,Helvetica,sans-serif;color:#111111;">
              <p style="margin-top:0;margin-right:0;margin-bottom:12px;margin-left:0;font-size:12px;line-height:18px;color:#444444;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">Goetz Digital Files</p>
              <h1 style="margin-top:0;margin-right:0;margin-bottom:16px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:32px;line-height:38px;color:#111111;font-weight:bold;">Your download is ready</h1>
              <p style="margin-top:0;margin-right:0;margin-bottom:18px;margin-left:0;font-size:16px;line-height:25px;color:#333333;">Thank you for your purchase. Use ${
                items.length > 1 ? "the buttons below" : "the button below"
              } to download your Explorers Series file${items.length > 1 ? "s" : ""}.</p>
              <p style="margin-top:0;margin-right:0;margin-bottom:14px;margin-left:0;font-size:14px;line-height:22px;color:#555555;">${escapeHtml(
                getFileSummary(items),
              )}</p>
              <p style="margin-top:0;margin-right:0;margin-bottom:4px;margin-left:0;font-size:14px;line-height:22px;color:#555555;">The download should save to your computer's Downloads folder unless your browser asks where to save it.</p>
              <p style="margin-top:0;margin-right:0;margin-bottom:4px;margin-left:0;font-size:14px;line-height:22px;color:#555555;">The download link${
                items.length > 1 ? "s" : ""
              } will expire in ${expiresInDays} days.</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                ${itemRows}
              </table>
              <p style="margin-top:24px;margin-right:0;margin-bottom:0;margin-left:0;font-size:13px;line-height:21px;color:#666666;">These files are for personal use. If anything goes wrong, reply to this email and I will help.</p>
              <p style="margin-top:18px;margin-right:0;margin-bottom:0;margin-left:0;font-size:13px;line-height:21px;color:#666666;"><a href="${escapeHtml(
                siteUrl,
              )}" style="color:#111111;text-decoration:underline;">${escapeHtml(siteUrl)}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
