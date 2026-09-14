import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OCR: mupdf e tesseract.js carregam WASM em runtime. Mantê-los fora
  // do bundle do servidor evita que o empacotador quebre os assets.
  serverExternalPackages: ["mupdf", "tesseract.js"],

  // tesseract.js resolve o próprio worker com require('..') — um
  // require dinâmico. Isso quebra a análise estática do file tracing
  // da Vercel pra essa subárvore inteira: uma vez que ele não segue
  // esse require, ele também não descobre os requires ESTÁTICOS que
  // vêm depois dele (ex: require('bmp-js') dentro de setImage.js),
  // mesmo sendo literais normais. Resultado: cada dependência que o
  // worker usa falta uma de cada vez em produção ("Cannot find
  // module"). Por isso listamos aqui TODAS as dependências de runtime
  // do tesseract.js (o package.json dele), não só o pacote em si.
  // mupdf entra por precaução (mesmo padrão de asset nativo/WASM).
  outputFileTracingIncludes: {
    "/*": [
      "node_modules/tesseract.js/**/*",
      "node_modules/tesseract.js-core/**/*",
      "node_modules/bmp-js/**/*",
      "node_modules/idb-keyval/**/*",
      "node_modules/is-electron/**/*",
      "node_modules/is-url/**/*",
      "node_modules/node-fetch/**/*",
      "node_modules/regenerator-runtime/**/*",
      "node_modules/wasm-feature-detect/**/*",
      "node_modules/zlibjs/**/*",
      "node_modules/mupdf/**/*",
    ],
  },
};

export default nextConfig;
