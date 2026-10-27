// Atribui revistas/selos/plataformas às obras REAIS (AniList) do catálogo.
// Usa um mapa de serializações conhecidas + fallback coerente por tipo/país.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function hashInt(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// serializações conhecidas (título → key da revista)
const KNOWN: [RegExp, string][] = [
  // Jump
  [/one piece/i, "jump"], [/jujutsu kaisen/i, "jump"], [/naruto/i, "jump"],
  [/death note/i, "jump"], [/hunter x hunter|hunter×hunter/i, "jump"],
  [/my hero academia|boku no hero/i, "jump"], [/black clover/i, "jump"],
  [/chainsaw man/i, "jump"], [/haikyuu|haikyu/i, "jump"], [/bleach/i, "jump"],
  [/kimetsu|demon slayer/i, "jump"], [/sakamoto days/i, "jump"], [/kaiju/i, "jump"],
  [/dr\.? ?stone/i, "jump"], [/dandadan/i, "jump"], [/akane-banashi/i, "jump"],
  [/undead unluck/i, "jump"], [/mission: yozakura/i, "jump"],
  // Kodansha
  [/blue lock/i, "magazine"], [/fire force|enen no shouboutai/i, "magazine"],
  [/fairy tail/i, "magazine"], [/attack on titan|shingeki no kyojin/i, "magazine"],
  [/seven deadly sins|nanatsu no taizai/i, "magazine"], [/edens zero/i, "magazine"],
  [/in the clear moonlit dusk/i, "magazine"],
  // Young Jump
  [/tokyo ghoul/i, "young-jump"], [/kingdom(?! hearts)/i, "young-jump"],
  [/oshi no ko/i, "young-jump"], [/kaguya-sama|kaguya sama/i, "young-jump"],
  [/one-?punch man|one punch man/i, "young-jump"], [/golden kamuy/i, "young-jump"],
  [/gantz/i, "young-jump"], [/eliminators/i, "young-jump"],
  // Sunday
  [/frieren|sousou no frieren/i, "sunday"], [/fullmetal alchemist|hinamatsuri/i, "sunday"],
  [/detective conan|case closed/i, "sunday"], [/inuyasha/i, "sunday"],
  [/komi(-| )?san/i, "sunday"], [/mao\b/i, "sunday"], [/bewitching kiss/i, "sunday"],
  // seinen Kodansha/Shogakukan/Akita
  [/vinland saga/i, "afternoon"], [/mushishi/i, "afternoon"], [/blame/i, "afternoon"],
  [/berserk/i, "young-animal"], [/akira/i, "young-magazine"], [/initial d/i, "young-magazine"],
  [/prison school/i, "young-magazine"], [/20th century boys|20th boys/i, "big-comic"],
  [/master keaton/i, "big-comic"], [/golgo 13/i, "big-comic"], [/monster\b/i, "big-comic"],
  [/baki/i, "champion"], [/welcome to the ballroom/i, "champion"],
  // shoujo
  [/fruits basket/i, "hana-yume"], [/yona of the dawn|akatsuki no yona/i, "hana-yume"],
  [/kimi ni todoke/i, "bessatsu-margaret"], [/ao haru ride|blue spring ride/i, "bessatsu-margaret"],
  [/hirunaka no ryuusei/i, "bessatsu-margaret"], [/orange\b/i, "dessert"],
  [/wolf girl and black prince/i, "dessert"], [/skip to loafer|skip and loafer/i, "dessert"],
  // light novels
  [/sword art online/i, "dengeki-bunko"], [/a certain magical index|toaru majutsu/i, "dengeki-bunko"],
  [/a certain scientific railgun|toaru kagaku/i, "dengeki-bunko"], [/86\b|eighty six/i, "dengeki-bunko"],
  [/spice and wolf/i, "dengeki-bunko"], [/durarara/i, "dengeki-bunko"], [/baccano/i, "dengeki-bunko"],
  [/unlimited dorsal/i, "dengeki-bunko"],
  [/re: ?zero|rezero/i, "mf-bunko"], [/classroom of the elite|youkoso/i, "mf-bunko"],
  [/redo of healer|kaifuku jutsushi/i, "mf-bunko"], [/bunny girl senpai|seishun buta/i, "mf-bunko"],
  [/high school dxd/i, "fujimi-fantasia"], [/zero no tsukaima|familiar of zero/i, "fujimi-fantasia"],
  [/date a live/i, "fujimi-fantasia"], [/slayers/i, "fujimi-fantasia"],
  [/danmachi|familia myth/i, "ga-bunko"], [/goblin slayer/i, "ga-bunko"],
  [/wistoria/i, "ga-bunko"],
  [/haruhi suzumiya/i, "sneaker"], [/konosuba|kono subarashii/i, "sneaker"],
  [/overlord\b/i, "sneaker"], [/reborn to master/i, "sneaker"],
  [/arifureta/i, "overlap-bunko"], [/realist demon king/i, "overlap-bunko"],
  [/bookworm|honzuki/i, "to-books"], [/bakarina|my next life as a villainess/i, "to-books"],
  [/dragon maid|kobayashi/i, "comic-ryu"],
  // manhwas
  [/tower of god|kamibek/i, "naver-webtoon"], [/god of high school/i, "naver-webtoon"],
  [/lookism/i, "naver-webtoon"], [/sweet home/i, "naver-webtoon"],
  [/omniscient reader|jeonji dokja/i, "naver-webtoon"], [/the boxer/i, "naver-webtoon"],
  [/wind breaker/i, "naver-webtoon"], [/noblesse/i, "naver-webtoon"],
  [/girls of the wild/i, "naver-webtoon"], [/bastard\b/i, "naver-webtoon"],
  [/how to fight|vikiodin/i, "naver-webtoon"], [/my school life pretending/i, "naver-webtoon"],
  [/solo leveling|na honjame/i, "kakao-webtoon"], [/eleceed/i, "kakao-webtoon"],
  [/beginning after the end/i, "kakao-webtoon"], [/adonis\b/i, "kakao-webtoon"],
  [/kill the hero/i, "kakao-webtoon"], [/the constellations are my disciples/i, "kakao-webtoon"],
  [/killing stalking/i, "lezhin"], [/painter of the night/i, "lezhin"],
  [/blood bank/i, "lezhin"], [/what does the fox say/i, "lezhin"],
  [/tower of god/i, "naver-webtoon"],
  // manhuas
  [/battle through the heavens|doupo cangqiong/i, "tencent-comics"],
  [/soul land|douluo dalu/i, "tencent-comics"], [/martial universe|wu dong qian kun/i, "tencent-comics"],
  [/king's avatar|quanzhi fashi/i, "tencent-comics"], [/tales of demons and gods|yao shen ji/i, "tencent-comics"],
  [/heaven official's blessing|tian guan ci fu/i, "bilibili-comics"],
  [/grandmaster of demonic|mo dao zu shi/i, "bilibili-comics"],
  [/the outcast|hitori no shita/i, "tencent-comics"],
];

const FALLBACK: Record<string, string[]> = {
  "manga:JP": ["jump", "sunday", "magazine", "young-jump", "afternoon", "morning", "young-magazine", "champion", "ultra-jump"],
  "anime:JP": ["jump", "sunday", "magazine", "young-jump", "afternoon", "dengeki-bunko", "mf-bunko", "fujimi-fantasia"],
  "lightnovel:JP": ["dengeki-bunko", "mf-bunko", "fujimi-fantasia", "ga-bunko", "sneaker", "overlap-bunko", "to-books"],
  "manhwa:KR": ["naver-webtoon", "kakao-webtoon", "bomtoon"],
  "manhua:CN": ["tencent-comics", "bilibili-comics", "kuaikan"],
};

async function main() {
  const rows = await db.work.findMany({ where: { id: { not: { startsWith: "g" } } } });
  console.log(`Obras reais: ${rows.length}`);
  let known = 0, fallback = 0, none = 0;
  for (const row of rows) {
    let key: string | null = null;
    for (const [re, k] of KNOWN) {
      if (re.test(row.title) || (row.titleEn && re.test(row.titleEn))) {
        key = k;
        known++;
        break;
      }
    }
    if (!key) {
      if (row.isAdult) {
        // obras adultas reais raramente têm revista no catálogo
        none++;
        continue;
      }
      const pool = FALLBACK[`${row.type}:${row.country}`] ?? FALLBACK[`${row.type}:JP`];
      if (pool) {
        key = pool[hashInt(row.id) % pool.length];
        fallback++;
      } else none++;
    }
    await db.work.update({ where: { id: row.id }, data: { magazine: key } });
  }
  console.log(`Revistas atribuídas — conhecidas: ${known} · por perfil: ${fallback} · sem revista: ${none}`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
