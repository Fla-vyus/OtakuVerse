import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const total = await p.work.count()
  const emptyCover = await p.work.count({ where: { cover: '' } })
  const nullBanner = await p.work.count({ where: { banner: null } })
  const emptyBanner = await p.work.count({ where: { banner: '' } })
  const noDesc = await p.work.count({ where: { synopsis: null } })
  const noSynPT = await p.work.count({ where: { synopsisPT: null } })
  const noAuthors = await p.work.count({ where: { authors: null } })
  const noLinks = await p.work.count({ where: { extLinks: null } })
  const noSiteUrl = await p.work.count({ where: { siteUrl: null } })
  console.log(JSON.stringify({ total, emptyCover, nullBanner, emptyBanner, noDesc, noSynPT, noAuthors, noLinks, noSiteUrl }))

  // IDs numéricos = obras reais AniList originais (200)
  const numericIds = await p.work.count({ where: { source: { in: ['MANGA', 'WEB_NOVEL', 'LIGHT_NOVEL', 'ORIGINAL', 'GAME', '4-KOMA MANGA', 'VIDEO_GAME', 'VISUAL_NOVEL', 'OTHER'] } } })
  console.log({ numericIds_byFakeSource: numericIds })
  const real = await p.work.findMany({ where: { source: 'ORIGINAL' }, select: { id: true, title: true, cover: true, banner: true, synopsis: true, source: true }, take: 3 })
  console.log('ORIGINAL SAMPLE:', JSON.stringify(real, null, 2).slice(0, 1000))

  // Amostra procedural: como estão as capas?
  const proc = await p.work.findMany({ where: { synopsis: null }, select: { id: true, title: true, cover: true, banner: true, authors: true, extLinks: true, type: true }, take: 4 })
  console.log('PROC SAMPLE:', JSON.stringify(proc, null, 2).slice(0, 2000))

  // Distribuição de prefixes de cover
  const covers = await p.work.findMany({ select: { cover: true }, take: 3000 })
  const prefixes: Record<string, number> = {}
  for (const c of covers) {
    const pref = (c.cover || '(vazio)').slice(0, 30)
    prefixes[pref] = (prefixes[pref] || 0) + 1
  }
  console.log('COVER PREFIXES (amostra 3k):', JSON.stringify(prefixes, null, 2))
}
main().finally(() => p.$disconnect())
