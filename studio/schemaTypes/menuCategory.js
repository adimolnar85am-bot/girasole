import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'menuCategory',
  title: 'Categorii meniu',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Nume categorie', type: 'string', validation: rule => rule.required()}),
    defineField({name: 'order', title: 'Ordine', type: 'number', validation: rule => rule.required().integer()}),
    defineField({
      name: 'items', title: 'Produse', type: 'array',
      of: [{
        type: 'object',
        name: 'menuItem',
        fields: [
          defineField({name: 'name', title: 'Produs', type: 'string', validation: rule => rule.required()}),
          defineField({name: 'price', title: 'Pret', type: 'string', validation: rule => rule.required()}),
          defineField({name: 'desc', title: 'Descriere / gramaj', type: 'text', rows: 3}),
        ],
        preview: {select: {title: 'name', subtitle: 'price'}},
      }],
    }),
  ],
  orderings: [{title: 'Ordine meniu', name: 'orderAsc', by: [{field: 'order', direction: 'asc'}]}],
  preview: {select: {title: 'title', subtitle: 'order'}},
})
