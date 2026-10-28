import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const works = await db.work.count()
  const safe = await db.work.count({ where: { spicy: 0 } })
  const users = await db.user.count()
  const sessions = await db.session.count()
  const shelves = await db.shelfEntry.count()
  const lists = await db.userList.count()
  const lib = await db.libraryItem.count()
  console.log(JSON.stringify({ works, safe, suggestive: await db.work.count({ where: { spicy: 1 } }), adult: await db.work.count({ where: { spicy: 2 } }), users, sessions, shelves, lists, lib }))
  const idx: any = await db.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='Work'")
  console.log('Work indexes:', idx.map((i: any) => i.name).join(', '))
  const byType: any = await db.$queryRawUnsafe("SELECT type, COUNT(*) as n FROM Work GROUP BY type ORDER BY n DESC")
  console.log('By type:', byType.map((r: any) => `${r.type}=${r.n}`).join(' '))
  await db.$disconnect()
}
main().catch(e => { console.error(e.message || e); process.exit(1) })
