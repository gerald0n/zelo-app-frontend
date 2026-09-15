// Sobe as fotos de referência dos sabores de pizza (Doce Capricho Atelier, usada só como
// inspiração de conteúdo — ver seed.sql) para o bucket `product-images` do Supabase local
// e cria/atualiza a linha em `product_images` de cada sabor. Roda depois de `pnpm db:reset`.
//
// Uso: node scripts/seed-pizza-flavor-images.mjs
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

/** Parser mínimo de .env.local — evita depender de um pacote `dotenv` não declarado no root. */
async function loadEnvLocal() {
  const content = await readFile(path.resolve(".env.local"), "utf8").catch(
    () => "",
  );
  for (const line of content.split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
}

await loadEnvLocal();

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ex.: no .env.local) antes de rodar este script.",
  );
  process.exit(1);
}

if (!supabaseUrl.includes("127.0.0.1") && !supabaseUrl.includes("localhost")) {
  console.error(
    `SUPABASE_URL aponta para "${supabaseUrl}", que não parece local. Este script é só para o ambiente local — aborte e revise antes de rodar contra produção/preview.`,
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const IMAGES_DIR = path.resolve("scripts/assets/pizza-flavors");

/** slug do produto -> arquivo webp processado (crop quadrado centrado na pizza). */
const FLAVOR_IMAGES = {
  "pizza-mussarela": "mussarela.webp",
  "pizza-mista": "mista.webp",
  "pizza-frango": "frango.webp",
  "pizza-calabresa": "calabresa.webp",
  "pizza-carne-de-sol": "carnedesol.webp",
  "pizza-frango-catupiry": "frangocatupiry.webp",
  "pizza-nordestina": "nordestina.webp",
  "pizza-lombo-canadense": "lombo.webp",
  "pizza-arretada": "arretada.webp",
  "pizza-peito-peru": "peitodeperu.webp",
};

async function main() {
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, slug, name")
    .in("slug", Object.keys(FLAVOR_IMAGES));

  if (productsError) throw productsError;

  const bySlug = new Map(products.map((p) => [p.slug, p]));

  for (const [slug, fileName] of Object.entries(FLAVOR_IMAGES)) {
    const product = bySlug.get(slug);
    if (!product) {
      console.warn(`⚠ produto com slug "${slug}" não encontrado — pulei.`);
      continue;
    }

    const filePath = path.join(IMAGES_DIR, fileName);
    const buffer = await readFile(filePath);
    const storagePath = `${product.id}/pizza-flavor.webp`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(storagePath, buffer, { contentType: "image/webp", upsert: true });
    if (uploadError) throw uploadError;

    await supabase.from("product_images").delete().eq("product_id", product.id);
    const { error: insertError } = await supabase
      .from("product_images")
      .insert({
        product_id: product.id,
        storage_path: storagePath,
        alt_text: product.name,
        sort_order: 0,
        is_primary: true,
      });
    if (insertError) throw insertError;

    console.log(`✓ ${product.name} (${slug})`);
  }

  console.log("Concluído.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
