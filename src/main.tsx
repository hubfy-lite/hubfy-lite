import "@/lib/sentry";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { initGoogleTagManager } from "@/lib/google-tag-manager";

initGoogleTagManager();

createRoot(document.getElementById("root")!).render(<App />);
