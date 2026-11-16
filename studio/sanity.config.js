import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {schemaTypes} from './schemaTypes'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID || 'REPLACE_WITH_SANITY_PROJECT_ID'
const dataset = process.env.SANITY_STUDIO_DATASET || 'production'

export default defineConfig({
  name: 'girasole',
  title: 'Girasole',
  projectId,
  dataset,
  basePath: '/',
  plugins: [structureTool()],
  schema: {types: schemaTypes},
  document: {singletons: ['siteSettings']},
})
