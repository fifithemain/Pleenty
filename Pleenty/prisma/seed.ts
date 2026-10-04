import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const products = [
  ['Fresh Banana Bunch', 'fresh-banana-bunch', 'per bunch', 24.99, 'Fruit & Veg', '🍌'],
  ['Farm Fresh Tomatoes', 'farm-fresh-tomatoes', '1 kg', 29.99, 'Fruit & Veg', '🍅'],
  ['Avocados', 'avocados', 'pack of 3', 32.5, 'Fruit & Veg', '🥑'],
  ['Baby Spinach', 'baby-spinach', '200 g bag', 18.99, 'Fruit & Veg', '🥬'],
  ['Free Range Eggs', 'free-range-eggs', '6 pack', 26.99, 'Dairy & Eggs', '🥚'],
  ['Fresh Full Cream Milk', 'fresh-full-cream-milk', '2 litre', 34.99, 'Dairy & Eggs', '🥛'],
  ['Sourdough Loaf', 'sourdough-loaf', '1 loaf', 39.99, 'Bakery', '🍞'],
  ['Sunday 7-Colours Box', 'sunday-7-colours-box', 'family combo', 199, 'Produce Boxes', '🧺'],
  ['Weekly Family Starter Pack', 'weekly-family-starter-pack', 'value combo', 149, 'Produce Boxes', '🥕'],
  ['Long Grain Rice', 'long-grain-rice', '2 kg bag', 42.99, 'Pantry', '🍚'],
  ['Creamy Peanut Butter', 'creamy-peanut-butter', '400 g jar', 36.99, 'Pantry', '🥜'],
  ['Fresh Orange Bag', 'fresh-orange-bag', '2 kg bag', 39.99, 'Fruit & Veg', '🍊'],
] as const;

async function main() {
  for (const [name, slug, _unit, price, categoryName, emoji] of products) {
    const categorySlug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const category = await prisma.category.upsert({
      where: { slug: categorySlug },
      update: {},
      create: { name: categoryName, slug: categorySlug },
    });

    await prisma.product.upsert({
      where: { slug },
      update: { price, stockQty: 100, inStock: true, imageUrl: emoji, categoryId: category.id },
      create: {
        name,
        slug,
        price,
        imageUrl: emoji,
        stockQty: 100,
        inStock: true,
        categoryId: category.id,
      },
    });
  }
}

main().finally(() => prisma.$disconnect());
