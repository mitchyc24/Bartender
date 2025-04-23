import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { icon } from "@fortawesome/fontawesome-svg-core"; // Import the icon function
import { faCocktail } from "@fortawesome/free-solid-svg-icons"; // Import the specific icon

// --- Set Favicon ---
const cocktailIcon = icon(faCocktail); // Generate the icon object
if (cocktailIcon && cocktailIcon.html) {
  // Create SVG data URI
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cocktailIcon.icon[0]} ${cocktailIcon.icon[1]}"><path fill="currentColor" d="${cocktailIcon.icon[4]}"></path></svg>`;
  const faviconDataUri = `data:image/svg+xml;base64,${btoa(svg)}`;

  // Find or create the link element
  let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.getElementsByTagName("head")[0].appendChild(link);
  }
  link.href = faviconDataUri;
}
// --- End Set Favicon ---

const rootElement = document.getElementById("root")!;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
