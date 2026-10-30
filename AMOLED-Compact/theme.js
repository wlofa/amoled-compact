// AMOLED Compact — theme script. Two small jobs:
//  1. Header backdrop: hands the cover's address to the playlist/album header
//     as --ac-cover, so user.css can draw a blurred copy behind the sharp cover.
//  2. Window buttons: asks Spotify to size them to the top bar (Spotify may
//     ignore this; user.css makes the top bar tall enough either way).
// It only runs on navigation, for a few seconds, never continuously.
(function amoledCompact() {
  /* ---------- 1. header backdrop ---------- */
  const urlIn = (el) => {
    const m = (el.getAttribute("style") || "").match(/url\((['"]?)(.*?)\1\)/);
    return m ? m[2] : "";
  };

  // Finds the cover, in whichever form this header uses. Returns
  // { src, boxed } where boxed = the header has its own cover box.
  function findCover(header) {
    const box = header.querySelector(".main-entityHeader-imageContainer");
    if (box) {
      const img = box.querySelector("img");
      const fromImg = img && (img.currentSrc || img.src);
      if (fromImg) return { src: fromImg, boxed: true };
      const painted = [box, ...box.querySelectorAll('[style*="url("]')].map(urlIn).find(Boolean);
      if (painted) return { src: painted, boxed: true };
    }
    // no cover box: use a background picture or any large image in the header
    const bg = [...header.querySelectorAll('[style*="url("]')].map(urlIn).find(Boolean);
    if (bg) return { src: bg, boxed: false };
    const img = [...header.querySelectorAll("img")].find((i) => !i.closest("figure") && (i.naturalWidth || 0) >= 120);
    if (img) return { src: img.currentSrc || img.src, boxed: false };
    return null;
  }

  function cssLayers(src) {
    const layers = [];
    const id = src.match(/^spotify:image:([0-9a-f]+)$/i);
    if (id) layers.push(`url("https://i.scdn.co/image/${id[1]}")`); // same image, regular web address
    layers.push(`url("${src.replace(/"/g, "%22")}")`);
    return layers.join(", ");
  }

  function paint() {
    const header = document.querySelector('[data-testid="entity-header"]');
    if (!header) return;
    const cover = findCover(header);
    if (!cover || !cover.src) return;
    const value = cssLayers(cover.src);
    if (header.style.getPropertyValue("--ac-cover") !== value) header.style.setProperty("--ac-cover", value);
    header.toggleAttribute("data-ac-nocover", !cover.boxed);
  }

  // After each page change, check a few times while the page fills in.
  let timer = null;
  function afterNavigation() {
    clearInterval(timer);
    let runs = 0;
    paint();
    timer = setInterval(() => {
      paint();
      if (++runs >= 16) clearInterval(timer); // ~4 seconds
    }, 250);
  }

  /* ---------- 2. window buttons ---------- */
  const TITLEBAR = { osx: "48", other: "64" }; // keep equal to --ac-strip / --ac-strip-windows
  async function sizeWindowButtons() {
    const os = Spicetify.Platform?.PlatformData?.os_name;
    try {
      await Spicetify.CosmosAsync.post("sp://messages/v1/container/control", {
        type: "update_titlebar",
        height: os === "osx" ? TITLEBAR.osx : TITLEBAR.other,
      });
    } catch (err) {
      console.warn("[AMOLED Compact] window buttons:", err);
    }
  }

  (function start() {
    if (!window.Spicetify || !Spicetify.Platform?.History || !Spicetify.CosmosAsync) {
      setTimeout(start, 200);
      return;
    }
    Spicetify.Platform.History.listen(afterNavigation);
    afterNavigation();
    sizeWindowButtons();
    setTimeout(sizeWindowButtons, 3000);
  })();
})();
