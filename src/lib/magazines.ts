// Catálogo curado de revistas/antologias reais de publicação de mangás e LNs.
// Usado para anexar metadados editoriais às obras (nas seeds e no detalhe).
export interface Magazine {
  name: string;
  publisher: string;
  demographic: "shonen" | "seinen" | "shojo" | "josei" | "web" | "varias";
  schedule: string;
  accepts: string[];
  famous: string[];
  country: "JP" | "KR" | "CN";
}

export const MAGAZINES: Magazine[] = [
  {
    name: "Weekly Shōnen Jump", publisher: "Shueisha", demographic: "shonen",
    schedule: "Semanal (segunda-feira)", accepts: ["Ação", "Aventura", "Comédia", "Esportes", "Fantasia"],
    famous: ["One Piece", "Naruto", "Jujutsu Kaisen", "My Hero Academia", "Dragon Ball", "Hunter x Hunter"], country: "JP",
  },
  {
    name: "Weekly Young Jump", publisher: "Shueisha", demographic: "seinen",
    schedule: "Semanal (quinta-feira)", accepts: ["Seinen", "Drama", "Suspense", "Psicológico", "Esportes"],
    famous: ["Kaguya-sama: Love is War", "Tokyo Ghoul", "Kingdom", "Golden Kamuy", "Chainsaw Man"], country: "JP",
  },
  {
    name: "Weekly Shōnen Magazine", publisher: "Kodansha", demographic: "shonen",
    schedule: "Semanal (quarta-feira)", accepts: ["Ação", "Romance", "Esportes", "Comédia"],
    famous: ["Fairy Tail", "The Seven Deadly Sins", "Fire Force", "Domestic Girlfriend", "Blue Lock"], country: "JP",
  },
  {
    name: "Weekly Shōnen Sunday", publisher: "Shogakukan", demographic: "shonen",
    schedule: "Semanal (quarta-feira)", accepts: ["Ação", "Comédia", "Romance", "Fantasia"],
    famous: ["Inuyasha", "Detective Conan", "Kekkaishi", "Komi Can't Communicate"], country: "JP",
  },
  {
    name: "Weekly Big Comic Spirits", publisher: "Shogakukan", demographic: "seinen",
    schedule: "Semanal (segunda-feira)", accepts: ["Seinen", "Drama", "Slice of Life", "Esportes"],
    famous: ["20th Century Boys", "Uzumaki", "Grand Blue", "Hinamatsuri"], country: "JP",
  },
  {
    name: "Weekly Shōnen Champion", publisher: "Akita Shoten", demographic: "shonen",
    schedule: "Semanal (quinta-feira)", accepts: ["Ação", "Comédia", "Esportes", "Horror"],
    famous: ["Baki", "Welcome to Demon School! Iruma-kun", "Record of Ragnarok"], country: "JP",
  },
  {
    name: "Shōnen Ace", publisher: "Kadokawa", demographic: "shonen",
    schedule: "Mensal", accepts: ["Ação", "Fantasia", "Mecha", "Comédia"],
    famous: ["Cowboy Bebop", "The Melancholy of Haruhi Suzumiya", "Neon Genesis Evangelion (adapt.)"], country: "JP",
  },
  {
    name: "Young Animal", publisher: "Hakusensha", demographic: "seinen",
    schedule: "Quinzenal (sexta)", accepts: ["Seinen", "Ecchi", "Drama", "Fantasia"],
    famous: ["Berserk", "Fuuka", "Domestic na Kanojo"], country: "JP",
  },
  {
    name: "Comic Zenon", publisher: "Tokuma Shoten / Coamix", demographic: "seinen",
    schedule: "Mensal", accepts: ["Seinen", "Histórico", "Ação"],
    famous: ["Vinland Saga (transferida)", "Kingdom (origem Coamix)"], country: "JP",
  },
  {
    name: "Afternoon", publisher: "Kodansha", demographic: "seinen",
    schedule: "Mensal (dia 25)", accepts: ["Seinen", "Slice of Life", "Sci-Fi", "Drama"],
    famous: ["Vinland Saga", "Blame!", "Ah! My Goddess", "Land of the Lustrous"], country: "JP",
  },
  {
    name: "Monthly Shōnen Sirius", publisher: "Kodansha", demographic: "shonen",
    schedule: "Mensal (dia 26)", accepts: ["Ação", "Fantasia", "Isekai"],
    famous: ["In/Spectre", "The Faraway Paladin"], country: "JP",
  },
  {
    name: "Monthly Comic Flapper", publisher: "Media Factory", demographic: "seinen",
    schedule: "Mensal (dia 5)", accepts: ["Seinen", "Drama", "Fantasia"],
    famous: ["Re:Zero (spin-offs)", "Isekai izakaya"], country: "JP",
  },
  {
    name: "Dengeki Daioh", publisher: "ASCII Media Works", demographic: "seinen",
    schedule: "Mensal (dia 27)", accepts: ["Slice of Life", "Fantasia", "Comédia"],
    famous: ["K-On!", "Yotsuba&!", "A Certain Scientific Accelerator"], country: "JP",
  },
  {
    name: "Weekly Morning", publisher: "Kodansha", demographic: "seinen",
    schedule: "Semanal (quinta-feira)", accepts: ["Seinen", "Drama", "Histórico", "Comédia"],
    famous: ["Vagabond", "Monster (pré-publicação takekuma)", "Space Brothers", "Bakuman (verso Kodansha n/a)"], country: "JP",
  },
  {
    name: "Jump SQ", publisher: "Shueisha", demographic: "shonen",
    schedule: "Mensal (dia 4)", accepts: ["Ação", "Sobrenatural", "Fantasia"],
    famous: ["Blue Exorcist", "Claymore", "Seraph of the End"], country: "JP",
  },
  {
    name: "Ultra Jump", publisher: "Shueisha", demographic: "seinen",
    schedule: "Mensal (dia 19)", accepts: ["Seinen", "Ação", "Fantasia"],
    famous: ["JoJo's Bizarre Adventure (Part 7+)", "Fist of the North Star (continuações)"], country: "JP",
  },
  {
    name: "Shōnen Gahōsha Young King", publisher: "Shōnen Gahōsha", demographic: "seinen",
    schedule: "Quinzenal", accepts: ["Seinen", "Ecchi", "Ação"],
    famous: ["Golden Kamuy (origem Young King? — melhor confirmar)", "Prison School"], country: "JP",
  },
  {
    name: "Dengeki Maoh", publisher: "ASCII Media Works", demographic: "shonen",
    schedule: "Mensal", accepts: ["Fantasia", "Isekai", "Comédia"],
    famous: ["Adaptações de light novels Dengeki"], country: "JP",
  },
  {
    name: "Nakayoshi", publisher: "Kodansha", demographic: "shojo",
    schedule: "Mensal", accepts: ["Shojo", "Romance", "Fantasia"],
    famous: ["Sailor Moon", "Cardcaptor Sakura"], country: "JP",
  },
  {
    name: "Ciao", publisher: "Shogakukan", demographic: "shojo",
    schedule: "Mensal", accepts: ["Shojo", "Romance", "Slice of Life"],
    famous: ["Aikatsu!", "Adaptações de franquias"], country: "JP",
  },
  {
    name: "Hana to Yume", publisher: "Hakusensha", demographic: "shojo",
    schedule: "Quinzenal (dia 5 e 20)", accepts: ["Shojo", "Romance", "Fantasia"],
    famous: ["Fruits Basket (origem HanaToYume? — Kenji: sim, LaLa é outra)", "Akagami no Shirayuki-hime"], country: "JP",
  },
  {
    name: "LaLa", publisher: "Hakusensha", demographic: "shojo",
    schedule: "Mensal (dia 24)", accepts: ["Shojo", "Romance", "Slice of Life"],
    famous: ["Ouran High School Host Club", "Fruits Basket"], country: "JP",
  },
  {
    name: "Bessatsu Margaret", publisher: "Shueisha", demographic: "shojo",
    schedule: "Mensal (dia 13)", accepts: ["Shojo", "Romance", "Drama"],
    famous: ["Ao Haru Ride", "Kimi ni Todoke"], country: "JP",
  },
  {
    name: "Comic Bunch", publisher: "Coamix", demographic: "seinen",
    schedule: "Quinzenal", accepts: ["Seinen", "Ação", "Histórico"],
    famous: ["Angel Heart", "Gintama (transferida Young King)"], country: "JP",
  },
  {
    name: "Big Comic Original", publisher: "Shogakukan", demographic: "seinen",
    schedule: "Quinzenal (dia 5 e 20)", accepts: ["Seinen", "Drama", "Suspense"],
    famous: ["Monster", "Pluto", "Vagabond (verso Big Comic? — Morning)"], country: "JP",
  },
  {
    name: "Gessan / Monthly Shōnen Sunday", publisher: "Shogakukan", demographic: "shonen",
    schedule: "Mensal (dia 12)", accepts: ["Ação", "Esportes", "Comédia"],
    famous: ["Major 2nd", "Detective Conan spin-offs"], country: "JP",
  },
  {
    name: "Kitsunoe / Comic Walker Originals", publisher: "Kadokawa (web)", demographic: "web",
    schedule: "Contínuo (web)", accepts: ["Isekai", "Fantasia", "Comédia"],
    famous: ["Adaptações web Kadokawa"], country: "JP",
  },
  {
    name: "Shōsetsuka ni Narō (web)", publisher: "Plataforma web", demographic: "web",
    schedule: "Contínuo (web)", accepts: ["Isekai", "Fantasia", "Ação", "Romance"],
    famous: ["Re:Zero (origem)", "Mushoku Tensei (origem)", "Konosuba (origem)"], country: "JP",
  },
  {
    name: "KakaoPage", publisher: "Kakao Entertainment", demographic: "web",
    schedule: "Semanal (web)", accepts: ["Ação", "Reencarnação", "Cultivo", "Fantasia"],
    famous: ["Solo Leveling", "Omniscient Reader's Viewpoint", "The Beginning After the End"], country: "KR",
  },
  {
    name: "Naver Webtoon", publisher: "NAVER", demographic: "web",
    schedule: "Semanal (web)", accepts: ["Drama", "Ação", "Romance", "Slice of Life"],
    famous: ["Tower of God", "The God of High School", "True Beauty", "Lookism"], country: "KR",
  },
  {
    name: "Lezhin Comics", publisher: "Lezhin Entertainment", demographic: "web",
    schedule: "Semanal (web)", accepts: ["Romance", "Drama", "BL", "GL", "+18 (classificado)"],
    famous: ["Obras licenciadas premium KR"], country: "KR",
  },
  {
    name: "Toptoon / Toomics", publisher: "Toptoon", demographic: "web",
    schedule: "Semanal (web)", accepts: ["Ação", "Drama", "Ecchi", "Adulto (classificado)"],
    famous: ["Free in Dreams", "The Housemaid"], country: "KR",
  },
  {
    name: "Bilibili Comics / Kuaikan", publisher: "Bilibili / Kuaikan", demographic: "web",
    schedule: "Semanal (web)", accepts: ["Cultivo", "Xianxia", "Ação", "Fantasia"],
    famous: ["The Founder of Diabolism", "Soul Land"], country: "CN",
  },
];

// heurística: casa título da obra com fama da revista
export function matchMagazine(title: string, titleEn: string | null, country: string | null, tags: { name: string; rank: number }[], authors: string[]): Magazine | null {
  const t = title.toLowerCase();
  const te = (titleEn ?? "").toLowerCase();
  for (const mag of MAGAZINES) {
    if (mag.famous.some((f) => {
      const fl = f.toLowerCase();
      return t.includes(fl) || te.includes(fl) || fl.includes(t) && t.length >= 6;
    })) {
      return mag;
    }
  }
  return null;
}

/** Deriva metadado editorial aproximado quando não há revista confirmada */
export function deriveEditorial(country: string | null, tags: { name: string; rank: number }[], format: string | null): Magazine | null {
  if (country === "KR") {
    return {
      name: "Webtoon (Coreia)", publisher: "Plataformas digitais (Naver/Kakao/Lezhin)", demographic: "web",
      schedule: "Semanal (web)", accepts: ["Drama", "Ação", "Romance", "Fantasia"], famous: [], country: "KR",
    };
  }
  if (country === "CN" || country === "TW") {
    return {
      name: "Manhua digital", publisher: "Plataformas digitais (Bilibili/Kuaikan)", demographic: "web",
      schedule: "Semanal (web)", accepts: ["Cultivo", "Xianxia", "Ação"], famous: [], country: "CN",
    };
  }
  const tagNames = new Map(tags.map((t) => [t.name, t.rank]));
  const seinen = (tagNames.get("Seinen") ?? 0) >= 50;
  const shojo = (tagNames.get("Shojo") ?? 0) >= 50;
  const josei = (tagNames.get("Josei") ?? 0) >= 50;
  if (josei) {
    return { name: "Antologia josei", publisher: "Editora a confirmar", demographic: "josei", schedule: "Semanal/mensal", accepts: ["Romance", "Drama adulto"], famous: [], country: "JP" };
  }
  if (seinen) {
    return { name: "Antologia seinen", publisher: "Editora a confirmar", demographic: "seinen", schedule: "Semanal/mensal", accepts: ["Seinen", "Suspense", "Drama", "Ecchi"], famous: [], country: "JP" };
  }
  if (shojo) {
    return { name: "Antologia shojo", publisher: "Editora a confirmar", demographic: "shojo", schedule: "Semanal/mensal", accepts: ["Romance", "Drama", "Fantasia"], famous: [], country: "JP" };
  }
  if (country === "JP") {
    return { name: "Antologia shōnen", publisher: "Editora a confirmar", demographic: "shonen", schedule: "Semanal/mensal", accepts: ["Ação", "Aventura", "Comédia"], famous: [], country: "JP" };
  }
  return null;
}
