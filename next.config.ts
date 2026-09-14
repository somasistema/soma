import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OCR: mupdf e tesseract.js carregam WASM em runtime. Mantê-los fora
  // do bundle do servidor evita que o empacotador quebre os assets.
  serverExternalPackages: ["mupdf", "tesseract.js"],

  // tesseract.js resolve o próprio worker e o tesseract.js-core (a
  // engine WASM) com require() dinâmico (ex: require('..'),
  // require('tesseract.js-core/tesseract-core-simd-lstm') escolhido em
  // runtime conforme suporte a SIMD) — o file tracing da Vercel não
  // enxerga isso estaticamente e deixa esses arquivos de fora do
  // deploy, o que quebra o OCR em produção com "Cannot find module".
  // Forçamos a inclusão das duas pastas inteiras. mupdf entra junto
  // por precaução (mesmo padrão de asset nativo/WASM).
  outputFileTracingIncludes: {
    "/*": [
      "node_modules/tesseract.js/**/*",
      "node_modules/tesseract.js-core/**/*",
      "node_modules/mupdf/**/*",
    ],
  },
};

export default nextConfig;
