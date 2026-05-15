export function createSvgCardMask(
  width: number,
  height: number,
  diameter: number,
  offset: number,
  position: 'top' | 'bottom'
) {
  const svgContentBottom = `<?xml version='1.0' encoding='utf8'?>
<svg xmlns="http://www.w3.org/2000/svg" version="1.0" width="${width}" height="${height}"><defs /><g id="layer1"><path d="M 0,0 L ${width},0 L ${width},${height} L 0,${height} z M ${Math.floor(
    width / 2
  )}.0,${
    height - diameter + offset
  } a ${diameter},${diameter} 0 1,0 0.1,0" id="square-with-hole" style="fill:#000000;stroke:none;" /></g></svg>`;

  const svgContentTop = `<?xml version="1.0" ?>
  <svg xmlns="http://www.w3.org/2000/svg" version="1.0" width="${width}" height="${height}">
     <defs/>
     <g id="layer1">
        <path d="M 0,0 L ${width},0 L ${width},${height} L 0,${height} z M ${Math.floor(width / 2)},-${
          diameter + offset
        } a ${diameter},${diameter} 0 1,0 0.1,0" id="square-with-half-outside-top-hole" style="fill:#000000;stroke:none;"/>
     </g>
  </svg>`;

  const svgContent = position === 'top' ? svgContentTop : svgContentBottom;

  // Properly encode the SVG for use as a data URL
  const encodedSvg = encodeURIComponent(svgContent.trim()).replace(/'/g, '%27').replace(/"/g, '%22');

  return `data:image/svg+xml;utf8,${encodedSvg}`;
}
