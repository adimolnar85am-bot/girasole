import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {schemaTypes} from './schemaTypes'

export default defineConfig({
  name: 'girasole',
  title: 'Girasole',
  projectId: 'zw7ud6de',
  dataset: 'production',
  basePath: '/',
  plugins: [
    structureTool({
      structure: (S) => S.list()
        .title('Girasole')
        .items([
          S.listItem()
            .title('Continut site')
            .id('siteSettings')
            .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
          S.divider(),
          S.documentTypeListItem('menuCategory').title('Categorii meniu'),
        ]),
    }),
  ],
  schema: {types: schemaTypes},
})
