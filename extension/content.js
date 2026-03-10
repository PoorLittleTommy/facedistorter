(() => {
  // Skip if already distorted
  if (document.body.dataset.distorted === "true") return;
  document.body.dataset.distorted = "true";

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function sampleBilinear(srcData, w, h, fx, fy, ch) {
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
    const dx = fx - x0, dy = fy - y0;
    const cx0 = clamp(x0, 0, w - 1), cy0 = clamp(y0, 0, h - 1);
    const tl = srcData[(cy0 * w + cx0) * 4 + ch];
    const tr = srcData[(cy0 * w + x1) * 4 + ch];
    const bl = srcData[(y1 * w + cx0) * 4 + ch];
    const br = srcData[(y1 * w + x1) * 4 + ch];
    return tl * (1 - dx) * (1 - dy) + tr * dx * (1 - dy) + bl * (1 - dx) * dy + br * dx * dy;
  }

  function distortCanvas(sourceCanvas) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    if (w === 0 || h === 0) return null;

    const srcCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const src = srcCtx.getImageData(0, 0, w, h);
    const srcData = src.data;

    const outCanvas = document.createElement("canvas");
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext("2d");
    const out = outCtx.createImageData(w, h);
    const outData = out.data;

    const cx = w / 2, cy = h / 2;
    const radius = Math.min(cx, cy) * 0.92;
    const bulgeStrength = 1.8;
    const vertStretch = 1.25;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let dx = (x - cx) / radius;
        let dy = (y - cy) / radius;
        dy /= vertStretch;
        const r = Math.sqrt(dx * dx + dy * dy);

        let sx, sy;
        if (r < 1.0 && r > 0) {
          const rn = Math.pow(r, bulgeStrength) / r;
          sx = cx + dx * rn * radius;
          sy = cy + dy * rn * radius;
        } else {
          sx = cx + dx * radius;
          sy = cy + dy * radius;
        }

        sx = clamp(sx, 0, w - 1);
        sy = clamp(sy, 0, h - 1);

        const i = (y * w + x) * 4;
        outData[i]     = sampleBilinear(srcData, w, h, sx, sy, 0);
        outData[i + 1] = sampleBilinear(srcData, w, h, sx, sy, 1);
        outData[i + 2] = sampleBilinear(srcData, w, h, sx, sy, 2);
        outData[i + 3] = sampleBilinear(srcData, w, h, sx, sy, 3);
      }
    }

    outCtx.putImageData(out, 0, 0);
    return outCanvas.toDataURL("image/png");
  }

  function distortImage(img) {
    if (img.dataset.distorted) return;
    if (!img.naturalWidth || !img.naturalHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    try {
      ctx.drawImage(img, 0, 0);
      // Test if we can read pixels (CORS check)
      ctx.getImageData(0, 0, 1, 1);
    } catch {
      // Cross-origin image, apply CSS fallback
      img.style.filter = "url(#distort-svg-filter)";
      img.dataset.distorted = "css";
      return;
    }

    const dataUrl = distortCanvas(canvas);
    if (dataUrl) {
      img.src = dataUrl;
      img.srcset = "";
      img.dataset.distorted = "true";
    }
  }

  // SVG filter fallback for cross-origin images
  if (!document.getElementById("distort-svg-filter")) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    svg.innerHTML = `
      <filter id="distort-svg-filter">
        <feTurbulence type="turbulence" baseFrequency="0.03 0.03" numOctaves="2" result="turb" seed="1"/>
        <feDisplacementMap in="SourceGraphic" in2="turb" scale="25" xChannelSelector="R" yChannelSelector="G"/>
      </filter>`;
    document.body.appendChild(svg);
  }

  // Distort all current images
  const images = document.querySelectorAll("img");
  images.forEach((img) => {
    if (img.complete) {
      distortImage(img);
    } else {
      img.addEventListener("load", () => distortImage(img), { once: true });
    }
  });

  // Also distort background images in CSS by applying the SVG filter
  document.querySelectorAll("*").forEach((el) => {
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== "none" && bg.startsWith("url")) {
      el.style.filter = "url(#distort-svg-filter)";
    }
  });
})();
