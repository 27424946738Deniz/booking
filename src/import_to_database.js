/**
 * CSV dosyasındaki otel verilerini veritabanına aktaran script
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parser');
const { createReadStream } = require('fs');

const prisma = new PrismaClient();

/**
 * CSV dosyasını okuyup JSON'a dönüştürür
 * @param {string} filePath - CSV dosyasının yolu
 * @returns {Promise<Array>} - CSV içeriği
 */
async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

/**
 * Özet CSV'sinden otel verilerini içe aktar
 * @param {string} summaryPath - Özet CSV dosya yolu
 */
async function importHotelData(summaryPath) {
  try {
    console.log(`Özet dosyası okunuyor: ${summaryPath}`);
    const hotels = await readCSV(summaryPath);
    
    console.log(`${hotels.length} otel verisi bulundu.`);
    
    // Her otel için
    for (const hotel of hotels) {
      // Hotel kayıt kontrolü
      const existingHotel = await prisma.hotel.findUnique({
        where: { url: hotel.Url }
      });
      
      if (existingHotel) {
        console.log(`Otel güncelleniyor: ${hotel.HotelName}`);
        
        // Mevcut oteli güncelle
        await prisma.hotel.update({
          where: { id: existingHotel.id },
          data: {
            name: hotel.HotelName,
            location: hotel.Location,
            rating: parseFloat(hotel.Rating) || null,
            minPrice: parseFloat(hotel.MinPrice) || null,
            totalAvailableRooms: parseInt(hotel.TotalRoomsLeft) || 0
          }
        });
      } else {
        console.log(`Yeni otel ekleniyor: ${hotel.HotelName}`);
        
        // Yeni otel oluştur
        await prisma.hotel.create({
          data: {
            name: hotel.HotelName,
            url: hotel.Url,
            location: hotel.Location,
            rating: parseFloat(hotel.Rating) || null,
            minPrice: parseFloat(hotel.MinPrice) || null,
            totalAvailableRooms: parseInt(hotel.TotalRoomsLeft) || 0
          }
        });
      }
    }
    
    console.log('Otel verileri başarıyla içe aktarıldı!');
  } catch (error) {
    console.error('Otel verisi içe aktarılırken hata:', error);
  }
}

/**
 * Belirtilen otele ait oda verilerini içe aktar
 * @param {string} roomsPath - Oda CSV dosya yolu
 * @param {string} hotelUrl - Otel URL'si
 */
async function importRoomData(roomsPath, hotelUrl) {
  try {
    console.log(`Oda dosyası okunuyor: ${roomsPath}`);
    const rooms = await readCSV(roomsPath);
    
    // İlgili oteli bul
    const hotel = await prisma.hotel.findUnique({
      where: { url: hotelUrl }
    });
    
    if (!hotel) {
      console.error(`Otel bulunamadı: ${hotelUrl}`);
      return;
    }
    
    console.log(`${rooms.length} oda verisi bulundu, ${hotel.name} oteline ekleniyor.`);
    
    // Otele ait mevcut odaları temizle
    await prisma.room.deleteMany({
      where: { hotelId: hotel.id }
    });
    
    // Her oda için
    for (const room of rooms) {
      await prisma.room.create({
        data: {
          hotelId: hotel.id,
          roomName: room.RoomName,
          roomsLeft: parseInt(room.RoomsLeft) || 0,
          price: parseFloat(room.Price) || null,
          mealPlan: room.MealPlan,
          cancelPolicy: room.CancelPolicy
        }
      });
    }
    
    console.log(`${rooms.length} oda verisi başarıyla içe aktarıldı!`);
  } catch (error) {
    console.error('Oda verisi içe aktarılırken hata:', error);
  }
}

/**
 * İçe aktarma işlemini başlat
 */
async function main() {
  try {
    const roomDataDir = path.join(__dirname, '../room_data');
    
    // Dizin kontrolü
    const exists = await fs.access(roomDataDir).then(() => true).catch(() => false);
    if (!exists) {
      console.error(`Dizin bulunamadı: ${roomDataDir}`);
      return;
    }
    
    // Dosyaları listele
    const files = await fs.readdir(roomDataDir);
    
    // Özet dosyasını bul (son tarihli)
    const summaryFiles = files.filter(f => f.startsWith('summary_')).sort().reverse();
    
    if (summaryFiles.length === 0) {
      console.error('Özet dosyası bulunamadı.');
      return;
    }
    
    const latestSummary = path.join(roomDataDir, summaryFiles[0]);
    console.log(`Son özet dosyası: ${latestSummary}`);
    
    // Özeti içe aktar
    await importHotelData(latestSummary);
    
    // Oda dosyalarını bul
    const roomFiles = files.filter(f => f.endsWith('_rooms.csv'));
    
    if (roomFiles.length === 0) {
      console.log('Oda dosyası bulunamadı.');
      return;
    }
    
    console.log(`${roomFiles.length} oda dosyası bulundu.`);
    
    // Özet dosyasını oku ve URL'leri al
    const summaryData = await readCSV(latestSummary);
    
    // Her otel için odaları içe aktar
    for (const hotel of summaryData) {
      const hotelName = hotel.HotelName.replace(/[\\/:*?"<>|]/g, '_');
      const roomFileName = `${hotelName}_rooms.csv`;
      
      if (roomFiles.includes(roomFileName)) {
        const roomFilePath = path.join(roomDataDir, roomFileName);
        await importRoomData(roomFilePath, hotel.Url);
      }
    }
    
    console.log('Tüm veriler başarıyla içe aktarıldı!');
  } catch (error) {
    console.error('İçe aktarma sırasında hata:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Scripti çalıştır
main(); 