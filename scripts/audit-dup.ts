import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const w = await p.work.findUnique({ where: { id: 'g012369' }, select: { title: true, authors: true, cover: true, banner: true, synopsis: true, synopsisPT: true } })
  console.log('g012369:', JSON.stringify(w, null, 2))
  // quantas obras têm autores duplicados?
  const all = await p.work.findMany({ select: { id: true, authors: true } })
  let dupAuthors = 0
  let sample: string[] = []
  for (const r of all) {
    try {
      const arr = JSON.parse(r.authors || '[]')
      const names = arr.map((a: any) => a.name)
      if (new Set(names).size !== names.length) {
        dupAuthors++
        if (sample.length < 5) sample.push(`${r.id}: ${names.join(', ')}`)
      }
    } catch {}
  }
  console.log({ dupAuthors, sample })
}
main().finally(() => p.$disconnect())
