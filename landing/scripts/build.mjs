// Genera las páginas publicadas de la landing a partir de src/ y
// site.config.json. Los archivos generados se commitean: Vercel sirve
// landing/ tal cual, sin paso de build.
//
//   node scripts/build.mjs           regenera landing/*.html
//   node scripts/build.mjs --check   falla si algún generado está desactualizado
//
// og-leadera.png tiene los días de prueba horneados. Si cambia trialDays,
// después del build regenerarla desde landing/ (usa la página generada):
//   chrome --headless=new --hide-scrollbars --window-size=1200,630 --screenshot=og-leadera.png og-leadera.html

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['index.html', 'terminos.html', 'privacidad.html', 'eliminacion-de-datos.html', 'og-leadera.html'];

const config = JSON.parse(await readFile(join(ROOT, 'site.config.json'), 'utf8'));
const wa = (text) => `https://wa.me/${config.whatsapp.number}?text=${encodeURIComponent(text)}`;

const values = {
  TRIAL_DAYS: config.trialDays,
  SIGNUP_URL: config.signupUrl,
  LOGIN_URL: config.loginUrl,
  WHATSAPP_NUMBER: config.whatsapp.number,
  WHATSAPP_DISPLAY: config.whatsapp.display,
  WHATSAPP_URL_CONSULTA: wa(config.whatsapp.messages.consulta),
  WHATSAPP_URL_DEMO: wa(config.whatsapp.messages.demo),
  EMAIL: config.email,
  PRICE_SOLO: config.plans.solo,
  PRICE_AGENCIA_CHICA: config.plans.agenciaChica,
  PRICE_AGENCIA_GRANDE: config.plans.agenciaGrande,
};

for (const [key, value] of Object.entries(values)) {
  if (value === undefined || value === null || value === '') throw new Error(`site.config.json: falta el valor de ${key}`);
}

// Pixel de Meta: con pixelId vacío no se publica nada de su código.
if (config.pixelId && !/^\d+$/.test(config.pixelId)) throw new Error('site.config.json: pixelId tiene que ser solo dígitos');
values.META_PIXEL = config.pixelId ? `  <script>
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${config.pixelId}');
  fbq('track', 'PageView');
  </script>
  <noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${config.pixelId}&amp;ev=PageView&amp;noscript=1"></noscript>
` : '';

const check = process.argv.includes('--check');
const errors = [];

for (const page of PAGES) {
  const source = await readFile(join(ROOT, 'src', page), 'utf8');
  const output = source.replace(/\{\{([A-Z0-9_]+)\}\}/g, (marker, key) => (key in values ? String(values[key]) : marker));
  const leftover = output.match(/\{\{[^{}]*\}\}/g);
  if (leftover) {
    errors.push(`${page}: marcadores sin reemplazar: ${[...new Set(leftover)].join(', ')}`);
    continue;
  }
  const target = join(ROOT, page);
  if (check) {
    const current = await readFile(target, 'utf8').catch(() => null);
    if (current !== output) errors.push(`${page}: desactualizado (correr node scripts/build.mjs)`);
  } else {
    await writeFile(target, output);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(check ? `OK: ${PAGES.length} páginas al día.` : `Generadas ${PAGES.length} páginas.`);
