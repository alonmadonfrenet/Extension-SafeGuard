import QRCode from 'qrcode';

/**
 * Generates a QR code data URL from text using the qrcode library.
 * Returns a data:image/svg+xml base64 string, or null on failure.
 */
export async function generateQRDataURL(text, size = 220) {
  try {
    const svgString = await new Promise((resolve, reject) => {
      QRCode.toString(text, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 4,
        width: size,
      }, (err, svg) => {
        if (err) reject(err);
        else resolve(svg);
      });
    });
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
  } catch (e) {
    console.error('[QR]', e);
    return null;
  }
}
