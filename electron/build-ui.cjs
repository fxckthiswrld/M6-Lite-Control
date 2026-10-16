const {execFileSync}=require('node:child_process');
require('esbuild').buildSync({entryPoints:[__dirname+'/ui.jsx'],outfile:__dirname+'/ui.bundle.js',bundle:true,minify:true,platform:'browser',define:{'process.env.NODE_ENV':'"production"'}});
execFileSync(process.execPath,[require.resolve('tailwindcss/lib/cli.js'),'-c','tailwind.config.cjs','-i','ui-tailwind.css','-o','ui.generated.css','--minify'],{cwd:__dirname,stdio:'inherit'});
