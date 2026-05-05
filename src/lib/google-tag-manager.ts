const GTM_ID = "GTM-T3BTSKXL";
const SCRIPT_ID = `gtm-script-${GTM_ID}`;
const NOSCRIPT_ID = `gtm-noscript-${GTM_ID}`;

export function initGoogleTagManager() {
  if (!import.meta.env.PROD || typeof document === "undefined") return;
  if (document.getElementById(SCRIPT_ID)) return;

  const win = window as typeof window & {
    dataLayer?: Array<Record<string, unknown>>;
  };

  win.dataLayer = win.dataLayer || [];
  win.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(script);

  if (document.getElementById(NOSCRIPT_ID)) return;

  const noscript = document.createElement("noscript");
  noscript.id = NOSCRIPT_ID;

  const iframe = document.createElement("iframe");
  iframe.src = `https://www.googletagmanager.com/ns.html?id=${GTM_ID}`;
  iframe.height = "0";
  iframe.width = "0";
  iframe.style.display = "none";
  iframe.style.visibility = "hidden";

  noscript.appendChild(iframe);
  document.body.insertBefore(noscript, document.body.firstChild);
}
