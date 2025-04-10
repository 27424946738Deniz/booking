const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('./logger'); // Varsayılan logger'ı kullan

async function deduplicateRoomsTable() {
  const log = logger || { info: console.log, error: console.error, warn: console.warn };
  log.info('Room tablosundaki tekrarlayan kayıtlar temizleniyor...');

  try {
    // 1. Tekrarlayan (hotelId, roomName) kombinasyonlarını bul
    const duplicates = await prisma.room.groupBy({
      by: ['hotelId', 'roomName'],
      _count: {
        id: true,
      },
      having: {
        id: {
          _count: {
            gt: 1, // Sayısı 1'den fazla olanları bul
          },
        },
      },
    });

    if (duplicates.length === 0) {
      log.info('Tekrarlayan kayıt bulunamadı.');
      return;
    }

    log.info(`${duplicates.length} adet tekrarlayan (hotelId, roomName) kombinasyonu bulundu.`);
    let totalDeletedCount = 0;

    // 2. Her tekrarlayan grup için işlem yap
    for (const group of duplicates) {
      const { hotelId, roomName } = group;
      log.info(`İşleniyor: hotelId=${hotelId}, roomName="${roomName}" (${group._count.id} adet)`);

      // 3. Bu gruba ait tüm Room kayıtlarını ID'lerine göre sıralı olarak al
      const roomsInGroup = await prisma.room.findMany({
        where: {
          hotelId: hotelId,
          roomName: roomName,
        },
        orderBy: {
          id: 'asc', // ID'ye göre artan sırada sırala
        },
        select: {
          id: true, // Sadece ID'leri al
        },
      });

      // 4. Tutulacak ID'yi belirle (ilk kayıt, yani en düşük ID)
      const idToKeep = roomsInGroup[0].id;
      log.info(`Tutulacak ID: ${idToKeep}`);

      // 5. Silinecek ID'leri belirle (ilk kayıt hariç diğerleri)
      const idsToDelete = roomsInGroup.slice(1).map(room => room.id);

      if (idsToDelete.length > 0) {
        log.warn(`Silinecek ID'ler: ${idsToDelete.join(', ')}`);
        // 6. Tekrarlayan kayıtları sil
        const deleteResult = await prisma.room.deleteMany({
          where: {
            id: {
              in: idsToDelete,
            },
          },
        });
        log.info(`${deleteResult.count} kayıt silindi.`);
        totalDeletedCount += deleteResult.count;
      } else {
        log.info('Bu grup için silinecek ek kayıt bulunamadı (beklenmedik durum).');
      }
    }

    log.info(`Toplam ${totalDeletedCount} tekrarlayan Room kaydı silindi.`);

  } catch (error) {
    log.error(`Tekrarlayan kayıtlar temizlenirken hata oluştu: ${error.message}`, { stack: error.stack });
  } finally {
    await prisma.$disconnect();
    log.info('Veritabanı bağlantısı kapatıldı.');
  }
}

// Script'i çalıştır
deduplicateRoomsTable();