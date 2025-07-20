import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Delete existing data
  await prisma.batch.deleteMany()
  await prisma.material.deleteMany()
  await prisma.document.deleteMany()
  await prisma.materialType.deleteMany()
  await prisma.brand.deleteMany()
  await prisma.vendor.deleteMany()
  await prisma.user.deleteMany({ where: { username: 'admin' } })

  // Create permissions
  const permissions = [
    { name: 'ViewOnly', description: 'View all modules' },
    { name: 'EditMaterials', description: 'Add/edit inventory items and batches' },
    { name: 'RecordUsage', description: 'Record materials used during procedures' },
    { name: 'EditDocuments', description: 'Upload, edit, delete document images and metadata' },
    { name: 'ManageSettings', description: 'Access to manage master data and settings' },
    { name: 'ManageUsers', description: 'Admin only: manage users, assign roles and permissions' }
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {},
      create: permission
    });
  }

  // Create admin user with hashed password
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'Admin',
      permissions: {
        connect: await prisma.permission.findMany({
          select: { id: true }
        })
      }
    }
  });

  // Create MaterialTypes
  const stentType = await prisma.materialType.create({ data: { name: 'Stent' } })
  const balloonType = await prisma.materialType.create({ data: { name: 'Balloon' } })
  const guidewireType = await prisma.materialType.create({ data: { name: 'Guidewire' } })
  const microcatheterType = await prisma.materialType.create({ data: { name: 'Microcatheter' } })

  // Create Brands
  const medtronic = await prisma.brand.create({ data: { name: 'Medtronic' } })
  const boston = await prisma.brand.create({ data: { name: 'Boston Scientific' } })
  const terumo = await prisma.brand.create({ data: { name: 'Terumo' } })
  const merit = await prisma.brand.create({ data: { name: 'Merit Medical' } })

  // Create Vendors
  const vendorA = await prisma.vendor.create({ data: { name: 'Vendor A' } })
  const vendorB = await prisma.vendor.create({ data: { name: 'Vendor B' } })
  const vendorC = await prisma.vendor.create({ data: { name: 'Vendor C' } })
  const vendorD = await prisma.vendor.create({ data: { name: 'Vendor D' } })
  const vendorE = await prisma.vendor.create({ data: { name: 'Vendor E' } })
  const vendorF = await prisma.vendor.create({ data: { name: 'Vendor F' } })
  const vendorG = await prisma.vendor.create({ data: { name: 'Vendor G' } })

  // Create documents
  const doc1 = await prisma.document.create({
    data: {
      type: 'Invoice',
      documentNumber: 'INV-001',
      date: new Date('2024-05-01'),
      vendor: 'Vendor A',
      filePath: '/docs/invoice1.pdf',
    }
  })
  const doc2 = await prisma.document.create({
    data: {
      type: 'Delivery Challan',
      documentNumber: 'DC-001',
      date: new Date('2024-05-10'),
      vendor: 'Vendor B',
      filePath: '/docs/dc1.pdf',
    }
  })
  const doc3 = await prisma.document.create({
    data: {
      type: 'Purchase Order',
      documentNumber: 'PO-001',
      date: new Date('2024-04-20'),
      vendor: 'Vendor C',
      filePath: '/docs/po1.pdf',
    }
  })

  // Create materials with batches and link batches to documents (one-to-many)
  await prisma.material.create({
    data: {
      name: 'Stent',
      size: '6mm',
      brand: { connect: { id: medtronic.id } },
      materialType: { connect: { id: stentType.id } },
      batches: {
        create: [
          {
            purchaseType: 'Purchased',
            quantity: 10,
            initialQuantity: 10,
            vendorId: vendorA.id,
            lotNumber: 'L123',
            expirationDate: new Date('2025-12-31'),
            storageLocation: 'Shelf 1',
            stockAddedDate: new Date('2024-06-01'),
            addedById: adminUser.id,
            documentId: doc1.id
          },
          {
            purchaseType: 'Advance',
            quantity: 3,
            initialQuantity: 3,
            vendorId: vendorB.id,
            lotNumber: 'L124',
            expirationDate: new Date('2024-10-15'),
            storageLocation: 'Shelf 2',
            stockAddedDate: new Date('2024-05-10'),
            addedById: adminUser.id,
            documentId: doc2.id
          }
        ]
      }
    }
  })

  await prisma.material.create({
    data: {
      name: 'Balloon Catheter',
      size: '4mm',
      brand: { connect: { id: boston.id } },
      materialType: { connect: { id: balloonType.id } },
      batches: {
        create: [
          {
            purchaseType: 'Purchased',
            quantity: 5,
            initialQuantity: 5,
            vendorId: vendorA.id,
            lotNumber: 'L200',
            expirationDate: new Date('2024-11-15'),
            storageLocation: 'Shelf 3',
            stockAddedDate: new Date('2024-06-05'),
            addedById: adminUser.id,
            documentId: doc1.id
          },
          {
            purchaseType: 'Advance',
            quantity: 2,
            initialQuantity: 2,
            vendorId: vendorC.id,
            lotNumber: 'L201',
            expirationDate: new Date('2024-09-20'),
            storageLocation: 'Shelf 4',
            stockAddedDate: new Date('2024-05-20'),
            addedById: adminUser.id,
            documentId: doc2.id
          }
        ]
      }
    }
  })

  await prisma.material.create({
    data: {
      name: 'Guidewire',
      size: '0.035"',
      brand: { connect: { id: terumo.id } },
      materialType: { connect: { id: guidewireType.id } },
      batches: {
        create: [
          {
            purchaseType: 'Purchased',
            quantity: 8,
            initialQuantity: 8,
            vendorId: vendorD.id,
            lotNumber: 'L300',
            expirationDate: new Date('2025-01-15'),
            storageLocation: 'Shelf 5',
            stockAddedDate: new Date('2024-06-10'),
            addedById: adminUser.id,
            documentId: doc3.id
          },
          {
            purchaseType: 'Advance',
            quantity: 4,
            initialQuantity: 4,
            vendorId: vendorE.id,
            lotNumber: 'L301',
            expirationDate: new Date('2024-12-01'),
            storageLocation: 'Shelf 6',
            stockAddedDate: new Date('2024-05-25'),
            addedById: adminUser.id,
            documentId: doc1.id
          }
        ]
      }
    }
  })

  await prisma.material.create({
    data: {
      name: 'Microcatheter',
      size: '2.7F',
      brand: { connect: { id: merit.id } },
      materialType: { connect: { id: microcatheterType.id } },
      batches: {
        create: [
          {
            purchaseType: 'Purchased',
            quantity: 6,
            initialQuantity: 6,
            vendorId: vendorF.id,
            lotNumber: 'L400',
            expirationDate: new Date('2025-03-10'),
            storageLocation: 'Shelf 7',
            stockAddedDate: new Date('2024-06-15'),
            addedById: adminUser.id,
            documentId: doc2.id
          },
          {
            purchaseType: 'Advance',
            quantity: 1,
            initialQuantity: 1,
            vendorId: vendorG.id,
            lotNumber: 'L401',
            expirationDate: new Date('2024-08-30'),
            storageLocation: 'Shelf 8',
            stockAddedDate: new Date('2024-05-30'),
            addedById: adminUser.id,
            documentId: doc3.id
          }
        ]
      }
    }
  })

  console.log('Database seeded successfully');
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 