// Gera o banco de capas/banners AI do OtakuVerse (estilo anime key visual, sem texto).
// Salva em public/covers/*.jpg (convertido com sharp p/ JPEG ~80) e registra progresso em stdout.
import ZAI from "z-ai-web-dev-sdk";
import sharp from "sharp";
import fs from "fs";
import path from "path";

const OUT = path.join(process.cwd(), "public", "covers");
fs.mkdirSync(OUT, { recursive: true });

const STYLE = "anime key visual, crisp lineart, vivid colors, cinematic lighting, highly detailed, no text, no watermark, no letters";

const COVERS = [
  { f: "c-fantasy-01", p: "young adventurer wizard with a staff before a sprawling magical academy castle with floating islands, warm sunlight" },
  { f: "c-fantasy-02", p: "hooded demon lord seated on an ornate throne surrounded by crimson candles, dark fantasy, dramatic lighting" },
  { f: "c-villainess-01", p: "elegant silver-haired noblewoman in a lavish ball gown inside an aristocratic ballroom, rose petals, otome game aesthetic" },
  { f: "c-villainess-02", p: "noble girl with soft brown hair holding a teacup in a victorian garden, pastel colors, shoujo aesthetic" },
  { f: "c-action-01", p: "swordsman with a glowing blue sword standing before the gate of a dark dungeon, rim light, floating particles" },
  { f: "c-action-02", p: "female warrior with a crimson cape and twin daggers on a battlefield at dusk, dynamic pose, embers flying" },
  { f: "c-cultivation-01", p: "young cultivator meditating on a mountain peak above a sea of clouds with glowing energy swirls, xianxia aesthetic" },
  { f: "c-cultivation-02", p: "wuxia swordsman leaping between ancient rooftops, flowing robes, full moon" },
  { f: "c-school-01", p: "high school boy and girl on a rooftop at sunset, warm orange sky, cherry blossom petals, romantic mood" },
  { f: "c-school-02", p: "schoolgirl holding a transparent umbrella under rain at a crosswalk, city lights bokeh, melancholic" },
  { f: "c-office-01", p: "young adult office worker woman holding coffee by a night office window, city skyline, cozy" },
  { f: "c-slice-01", p: "steaming ramen bowl on the wooden counter of a cozy late-night diner, lantern light, detailed food art" },
  { f: "c-slice-02", p: "summer festival at night with fireworks, girls in yukata, goldfish scooping stall" },
  { f: "c-sports-01", p: "volleyball player mid-air spike inside a packed gymnasium, dynamic motion, determination" },
  { f: "c-idol-01", p: "idol girl singing on a glowing stage with a sea of penlights, confetti, concert lights" },
  { f: "c-horror-01", p: "dark abandoned school corridor with a distant silhouette, eerie green light, horror atmosphere" },
  { f: "c-thriller-01", p: "detective in a trench coat under rain in a neon alley holding a pocket watch, film noir" },
  { f: "c-mecha-01", p: "giant humanoid mecha towering over a battlefield, orange sky, epic scale" },
  { f: "c-cyberpunk-01", p: "hooded hacker girl with glowing circuit lines on a neon rooftop, holographic billboards, rain" },
  { f: "c-space-01", p: "spaceship pilot girl inside a cockpit overlooking a colorful nebula, star field, sci-fi" },
  { f: "c-yaoi-01", p: "two young men standing back to back under a winter sky, contrasting scarves, soft cinematic light" },
  { f: "c-yuri-01", p: "two schoolgirls sharing an umbrella under falling cherry blossoms, soft pink palette" },
  { f: "c-vampire-01", p: "gothic vampire noblewoman on a moonlit manor balcony, deep red and black palette" },
  { f: "c-yokai-01", p: "fox spirit girl holding paper lanterns on a misty shrine street at night, mystical procession" },
  { f: "c-ecchi-01", p: "playful summer beach scene, cheerful girl in a one-piece swimsuit with a beach ball, sparkling ocean, tasteful" },
  { f: "c-ecchi-02", p: "girl in yukata in the courtyard of an onsen inn with light steam and evening lanterns, tasteful" },
  { f: "c-historical-01", p: "samurai with a katana on a wooden bridge at dawn, torii gate, falling snow, ukiyo-e inspired colors" },
  { f: "c-isekai-01", p: "cozy cottage in a fantasy village, girl feeding a giant wolf, pastoral countryside, warm light" },
  { f: "c-dungeon-02", p: "party of adventurers with torches descending into a glowing crystal cavern" },
  { f: "c-academy-01", p: "student wizard holding a spellbook on academy stairs, floating magical glyphs, sunset" },
  { f: "c-hero-01", p: "five heroes standing in a group with weapons over their shoulders on a grassland, blue sky, adventure" },
  { f: "c-revenge-01", p: "hooded noblewoman with cold eyes holding a chess piece in a dark throne room, vengeance mood" },
];

const BANNERS = [
  { f: "b-01", p: "sprawling fantasy kingdom city at golden hour, epic establishing shot" },
  { f: "b-02", p: "neon cyberpunk Tokyo street at night with rain reflections" },
  { f: "b-03", p: "school courtyard with cherry blossoms in full bloom, spring morning" },
  { f: "b-04", p: "dramatic dark battlefield with a lone swordsman silhouette, lightning" },
  { f: "b-05", p: "cozy cafe interior with rain outside the window, warm lights" },
  { f: "b-06", p: "space station orbiting a ringed planet, sci-fi panorama" },
  { f: "b-07", p: "festival fireworks over a Japanese river town at night" },
  { f: "b-08", p: "mountain shrine above the clouds at sunrise, torii gate" },
];

const JOBS = [
  ...COVERS.map((c) => ({ ...c, size: "768x1344" })),
  ...BANNERS.map((b) => ({ ...b, size: "1408x768" })),
];

async function generateOne(zai, job, attempt = 1) {
  try {
    const res = await zai.images.generations.create({ prompt: `${job.p}, ${STYLE}`, size: job.size });
    const b64 = res?.data?.[0]?.base64;
    if (!b64) throw new Error("resposta sem imagem");
    const buf = Buffer.from(b64, "base64");
    const out = path.join(OUT, `${job.f}.jpg`);
    await sharp(buf).jpeg({ quality: 82 }).toFile(out);
    console.log(`OK ${job.f} (${Math.round(buf.length / 1024)}kb)`);
    return true;
  } catch (e) {
    console.error(`FALHOU ${job.f} tentativa ${attempt}: ${e.message}`);
    if (attempt < 6) {
      await new Promise((r) => setTimeout(r, 6000 * attempt));
      return generateOne(zai, job, attempt + 1);
    }
    return false;
  }
}

async function main() {
  const zai = await ZAI.create();
  const maxPerRun = Number(process.env.MAX_PER_RUN ?? 0); // 0 = sem limite
  const queue = JOBS.filter((j) => !fs.existsSync(path.join(OUT, `${j.f}.jpg`)));
  if (maxPerRun > 0) queue.length = Math.min(queue.length, maxPerRun);
  console.log(`Total: ${JOBS.length} · pendentes: ${JOBS.filter((j) => !fs.existsSync(path.join(OUT, `${j.f}.jpg`))).length} · esta rodada: ${queue.length}`);
  let done = 0, failed = 0;
  const workers = Array.from({ length: 2 }, async () => {
    while (queue.length) {
      const job = queue.shift();
      if (!job) break;
      const ok = await generateOne(zai, job);
      if (ok) done++; else failed++;
      console.log(`progresso: ${done + failed}/${JOBS.length}`);
    }
  });
  await Promise.all(workers);
  console.log(`FINAL: ${done} geradas, ${failed} falhas`);
  process.exit(failed >= JOBS.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
