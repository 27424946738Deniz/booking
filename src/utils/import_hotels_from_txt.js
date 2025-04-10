const fs = require('fs').promises;
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('./logger'); // Varsayılan logger'ı kullan

const inputFile = path.join(__dirname, '../../unique_hotel_details.txt');
const separator = '==================================================';

/**
 * Verilen metinden belirli bir anahtar kelimeye göre değeri çıkarır.
 * @param {string[]} blockLines - Otel bloğunun satırları.
 * @param {string} key - Aranacak anahtar kelime (örn: "NAME:").
 * @returns {string|null} Bulunan değer veya null.
 */
function extractValue(blockLines, key) {
  const line = blockLines.find(l => l.startsWith(key));
  return line ? line.substring(key.length).trim() : null;
}

/**
 * unique_hotel_details.txt dosyasındaki otel verilerini Prisma veritabanına aktarır.
 */
async function importHotelsFromTxt() {
  const log = logger || { info: console.log, error: console.error, warn: console.warn };
  log.info(`Otel verileri içe aktarılıyor: ${inputFile}`);

  let hotelsProcessed = 0;
  let hotelsCreated = 0;
  let hotelsUpdated = 0;
  let hotelsSkipped = 0;

  try {
    const content = await fs.readFile(inputFile, 'utf8');
    log.info('Dosya okundu.');

    // İçeriği bloklara ayır. Ayırıcı hem başında hem sonunda olabilir, dikkatli olalım.
    const blocks = content.split(separator)
                          .map(block => block.trim()) // Her bloğun başındaki/sonundaki boşlukları temizle
                          .filter(block => block.length > 0); // Boş blokları atla

    log.info(`${blocks.length} otel bloğu bulundu.`);

    for (const block of blocks) {
      hotelsProcessed++;
      const blockLines = block.split('\n').map(l => l.trim()).filter(l => l); // Bloğu satırlara ayır, boş satırları atla

      const name = extractValue(blockLines, 'NAME:');
      const url = extractValue(blockLines, 'URL:');
      const location = extractValue(blockLines, 'LOCATION:');
      const ratingStr = extractValue(blockLines, 'RATING:');
      let rating = null;

      if (ratingStr) {
        try {
          // "8,5 / 10" gibi formatları veya sadece sayıyı işle
          const ratingMatch = ratingStr.match(/([\d,.]+)/);
          if (ratingMatch) {
            rating = parseFloat(ratingMatch[1].replace(',', '.'));
            if (isNaN(rating)) rating = null; // Geçersiz sayı ise null yap
          }
        } catch (e) {
          log.warn(`Geçersiz rating formatı: "${ratingStr}" - Otel: ${name}`);
          rating = null;
        }
      }

      // URL ve Name zorunlu alanlar
      if (!url || !name) {
        log.warn(`URL veya İsim eksik, blok atlanıyor: \n${block}`);
        hotelsSkipped++;
        continue;
      }

      try {
        const result = await prisma.hotel.upsert({
          where: { url: url },
          create: {
            name: name,
            url: url,
            location: location,
            rating: rating,
            // scrapeDate: new Date() // İstersen eklenme tarihini de ayarlayabilirsin
          },
          update: {
            name: name, // İsim değişmiş olabilir
            location: location,
            rating: rating,
            // scrapeDate: new Date() // Güncellenme tarihini de ayarlayabilirsin
          },
        });

        // Prisma upsert doğrudan create/update bilgisi vermez,
        // ama işlem başarılıysa sayacı artırabiliriz.
        // Daha kesin bilgi için önce findUnique ile kontrol edip sonra create/update yapılabilir,
        // ama upsert daha pratiktir. Şimdilik basit tutalım.
        // log.info(`Otel işlendi: ${name} (URL: ${url})`);

      } catch (dbError) {
        log.error(`Veritabanı hatası (${name} - ${url}): ${dbError.message}`);
        hotelsSkipped++;
      }
    } // block döngüsü sonu

    // Gerçek eklenen/güncellenen sayısını almak için tekrar sorgu yapabiliriz,
    // şimdilik işlenen ve atlanan sayısını loglayalım.
    log.info('İçe aktarma tamamlandı.');
    log.info(`Toplam İşlenen Blok: ${hotelsProcessed}`);
    log.info(`Atlanan (URL/İsim eksik veya DB hatası): ${hotelsSkipped}`);
    // Gerçek eklenen/güncellenen sayısını loglamak için:
    const finalHotelCount = await prisma.hotel.count();
    log.info(`Veritabanındaki güncel otel sayısı: ${finalHotelCount}`);


  } catch (error) {
    log.error(`Dosya okunurken veya işlenirken hata oluştu: ${error.message}`, { stack: error.stack });
  } finally {
    await prisma.$disconnect();
    log.info('Veritabanı bağlantısı kapatıldı.');
  }
}

// Script'i çalıştır
importHotelsFromTxt();