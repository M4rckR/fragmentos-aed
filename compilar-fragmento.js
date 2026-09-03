#!/usr/bin/env node
/**
 * compilar-fragmento.js
 *
 * Compila un .mjml a HTML completo (como siempre) y despues extrae
 * SOLO la parte util para pegar en AED como fragmento:
 *   - el contenido real (la tabla/div del banner)
 *   - cualquier <style> que hayas agregado vos con mj-style
 *     (para que las media queries no se pierdan)
 *
 * Uso:
 *   node compilar-fragmento.js banner-monto.mjml
 *
 * Genera dos archivos junto al .mjml original:
 *   banner-monto.full.html      -> documento completo (por si queres revisar)
 *   banner-monto.fragmento.html -> solo lo que pegas en AED
 */

const fs = require('fs');
const path = require('path');
const mjml2html = require('mjml');
const cheerio = require('cheerio');

const inputPath = process.argv[2];

if (!inputPath) {
    console.error('Uso: node compilar-fragmento.js archivo.mjml');
    process.exit(1);
}

if (!fs.existsSync(inputPath)) {
    console.error(`No encontre el archivo: ${inputPath}`);
    process.exit(1);
}

async function main() {
    const mjmlSource = fs.readFileSync(inputPath, 'utf8');
    const { html, errors } = await mjml2html(mjmlSource, { validationLevel: 'soft' });

    if (errors && errors.length > 0) {
        console.warn('\n⚠️  MJML reporto avisos/errores durante la compilacion:');
        errors.forEach((e) => console.warn('  -', e.formattedMessage || e.message));
        console.warn('');
    }

    const parsedPath = path.parse(inputPath);
    const fullOutputPath = path.join(parsedPath.dir, `${parsedPath.name}.full.html`);
    const fragmentOutputPath = path.join(parsedPath.dir, `${parsedPath.name}.fragmento.html`);

    // Guarda el documento completo tambien, por si queres revisarlo o mandarlo
    // directo (fuera de AED) en algun caso.
    fs.writeFileSync(fullOutputPath, html, 'utf8');

    // --- Extraccion del fragmento ---
    const $ = cheerio.load(html, { decodeEntities: false });

    // 1. El contenido real: MJML siempre envuelve el body en un
    //    <div style="background:...;margin:0px auto;max-width:600px;">
    //    que es el primer div directo dentro de <body>. Lo tomamos completo,
    //    tal cual, sin tocar nada de adentro.
    const contentDiv = $('body > div').first();

    if (contentDiv.length === 0) {
        console.error('No pude encontrar el contenido esperado dentro del <body>. Revisa el .full.html manualmente.');
        process.exit(1);
    }

    // 2. Cualquier <style> del <head> que MJML haya generado a partir de tus
    //    propios <mj-style> (media queries, etc). Los estilos base de MJML
    //    (reset, mso, mj-column-per-100) tambien vienen aca, asi que los
    //    incluimos todos para no perder nada — pegar de mas es mas seguro
    //    que pegar de menos.
    const headStyles = $('head style')
        .map((i, el) => $.html(el))
        .get()
        .join('\n');

    const fragmentHtml = `${headStyles}\n${$.html(contentDiv)}`;

    fs.writeFileSync(fragmentOutputPath, fragmentHtml, 'utf8');

    console.log('✅ Listo.');
    console.log(`   Documento completo: ${fullOutputPath}`);
    console.log(`   Fragmento para AED:  ${fragmentOutputPath}`);
}

main().catch((err) => {
    console.error('Error compilando:', err);
    process.exit(1);
});