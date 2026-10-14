import { build } from "esbuild";
for (const name of ["exporters", "firebase-client"]) {
  await build({entryPoints:[`${name}.js`], bundle:true, format:"esm", platform:"browser", target:"es2022", outfile:`../docs/dpo/cdq-v3/src/${name}.bundle.js`, minify:true});
}
