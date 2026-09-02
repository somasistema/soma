import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OCR: mupdf e tesseract.js carregam WASM em runtime. Mantê-los fora
  // do bundle do servidor evita que o empacotador quebre os assets.
  serverExternalPackages: ["mupdf", "tesseract.js"],
};

export default nextConfig;
