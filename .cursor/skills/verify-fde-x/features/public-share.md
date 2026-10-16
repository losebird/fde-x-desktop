# Public share

Public share turns a running hosted web app into a document URL. A visitor opening that URL sees the app itself (`FDE-X-VERIFY-FLOOR`), not the FDE-X workbench chrome.

## Sub-features

- `share-mint` copies or shows a URL from the 验证户型 `分享` control.
- `share-public-web` serves the bundle at BFF `/a/:shareId/` with `FDE-X-VERIFY-FLOOR`.
- `share-not-spa` keeps workbench top-bar modules and `data-page-title` off that public document.
- `share-stop` removes the live link (`停止分享`); a later GET is not the live site.

## How to get to it (user POV)

- In 业务应用, on a running hosted app, choose `分享` or `复制链接`.
- Open the copied URL (scheme `http://<host>:<bff-port>/a/<shareId>`).
- Choose `停止分享`.

## Driving it with control-fde-x

Preconditions:

- Isolated instance is healthy.
- 验证户型 is `active`.
- Doctor runtime origin is the BFF port from `control-fde-x state` (`runtimePort`), not the Vite port.

- **Open catalog.** Choose `业务应用`. Run `control-fde-x browser open --name 业务应用`.
- **Mint link.** Choose `分享` on 验证户型. Run `control-fde-x browser click --selector [data-app-share="true"]`. `[data-app-share-note="true"]` shows a URL containing `/a/`, or the row gains `分享中`. Read the same share from `control-fde-x http POST /api/v1/apps/<seededAppId>/share` and record `data.url` / `data.shareId` (this HTTP call is the second view of the mint the button just performed, not a substitute for the click).
- **Open public site.** Run `control-fde-x browser goto http://127.0.0.1:<runtimePort>/a/<shareId>/`. The document contains `FDE-X-VERIFY-FLOOR`. It does not show `验证工作区`, `业务应用`, or the workbench pill bar.
- **Stop share.** Back on the catalog, choose `停止分享`. Run `control-fde-x browser click --selector [data-app-share-stop="true"]`. The note reads `已停止分享`. A later `goto` of the old URL does not show `FDE-X-VERIFY-FLOOR` as a live site (404 / 已停止).
- **Proof.** Capture the public document: `control-fde-x browser screenshot --path public-share/site.png` and `control-fde-x browser snapshot --aria --path public-share/site.aria.txt` while `/a/<shareId>/` still shows `FDE-X-VERIFY-FLOOR`. Keep the HTTP JSON that contains `shareId` next to those files.

## Gotchas

- Hosted web public face is the **BFF** origin. Vite `/a/:shareId` is the workbench `PublicApp` route (ledger). Opening the Vite port is the wrong mouth for 验证户型.
- `publicShareUrl` uses the request Host port. After Vite's proxy `changeOrigin`, mint should advertise the BFF port. If a copied URL points at the Vite port, the journey fails — do not silently fetch BFF instead and call it verified.
- Ledger apps (`fde-app/v1`) render `PublicApp` chrome (`data-app-public="true"`). This seed is `fde-web/v1`; do not accept the ledger chrome as proof.
- LAN bind (`FDE_LISTEN_HOST=0.0.0.0`) is a production concern. Verification launch binds `127.0.0.1` only.
- Re-mint after stop if a later recipe needs a live URL.
