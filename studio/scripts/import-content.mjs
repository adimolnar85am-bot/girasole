import fs from 'node:fs'
import path from 'node:path'
import {createClient} from '@sanity/client'

const projectId = process.env.SANITY_PROJECT_ID
const dataset = process.env.SANITY_DATASET || 'production'
const token = process.env.SANITY_API_TOKEN

if (!projectId || !token) {
  throw new Error('Set SANITY_PROJECT_ID and SANITY_API_TOKEN in your local environment.')
}

const root = path.resolve(process.cwd(), '..')
const sourcePath = path.join(root, 'data', 'site-content.json')
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: '2025-08-01',
  useCdn: false,
})

const uploaded = new Map()

async function imageReference(relativePath) {
  if (!relativePath) return null
  const clean = relativePath.replace(/^\//, '')
  if (uploaded.has(clean)) return uploaded.get(clean)
  const absolutePath = path.join(root, clean)
  if (!fs.existsSync(absolutePath)) {
    console.warn(`Imagine lipsa, omit: ${clean}`)
    return null
  }
  const stream = fs.createReadStream(absolutePath)
  const asset = await client.assets.upload('image', stream, {
    filename: path.basename(clean),
  })
  const ref = {_type: 'image', asset: {_type: 'reference', _ref: asset._id}}
  uploaded.set(clean, ref)
  return ref
}

async function imageArray(items, getSrc, getAlt = () => '') {
  const result = []
  for (const [index, item] of (items || []).entries()) {
    const ref = await imageReference(getSrc(item))
    if (ref) result.push({...ref, _key: `image-${index + 1}`, alt: getAlt(item) || ''})
  }
  return result
}

const heroSlides = await imageArray(source.hero?.slides, item => item)
const aboutImagesSource = source.about?.images?.length
  ? source.about.images
  : source.about?.image ? [{src: source.about.image, alt: source.about.imageAlt}] : []
const aboutImages = await imageArray(aboutImagesSource, item => item.src, item => item.alt)
const gallery = await imageArray(source.gallery, item => item.src, item => item.alt)

const settings = {
  _id: 'siteSettings',
  _type: 'siteSettings',
  metaTitle: source.meta?.title || '',
  metaDescription: source.meta?.description || '',
  heroLine: source.hero?.line || '',
  heroCtaPrimary: source.hero?.ctaPrimary || '',
  menuEyebrow: source.menu?.eyebrow || '',
  menuTitle: source.menu?.title || '',
  menuText: source.menu?.text || '',
  menuFootnote: source.menu?.footnote || '',
  heroSlides,
  aboutEyebrow: source.about?.eyebrow || '',
  aboutTitle: source.about?.title || '',
  aboutText: source.about?.text || '',
  aboutImages,
  gallery,
  contactEyebrow: source.contact?.eyebrow || '',
  contactTitle: source.contact?.title || '',
  businessName: source.contact?.businessName || '',
  street: source.contact?.street || '',
  city: source.contact?.city || '',
  hours: source.contact?.hours || '',
  instagramHandle: source.contact?.instagramHandle || '',
  instagramUrl: source.contact?.instagramUrl || '',
  hoursNote: source.contact?.hoursNote || '',
  mapQuery: source.contact?.mapQuery || '',
  footerText: source.footer?.text || '',
  footerInstagramUrl: source.footer?.instagramUrl || '',
  footerInstagramLabel: source.footer?.instagramLabel || '',
}

const categories = (source.menu?.sections || []).map((section, index) => ({
  _id: `menuCategory.${section.id || index + 1}`,
  _type: 'menuCategory',
  title: section.title || `Categorie ${index + 1}`,
  order: index + 1,
  items: (section.items || []).map((item, itemIndex) => ({
    _key: `item-${itemIndex + 1}`,
    _type: 'menuItem',
    name: item.name || '',
    price: item.price || '',
    desc: item.desc || '',
  })),
}))

if (categories.reduce((sum, category) => sum + category.items.length, 0) !== 62) {
  throw new Error('Import oprit: meniul sursa nu contine exact 62 de produse.')
}

await client.createOrReplace(settings)
for (const category of categories) await client.createOrReplace(category)

console.log(`Import finalizat: 1 setari site, ${categories.length} categorii, 62 produse, ${uploaded.size} imagini.`)
