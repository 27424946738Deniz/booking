const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger'); // Varsayılan logger'ı kullan

const inputFile = path.join(__dirname, '../../hotel_details.txt');
const outputFile = path.join(__dirname, '../../unique_hotel_details.txt');
const separator = '==================================================';

/**
 * hotel_details.txt dosyasındaki tekrarlayan otel kayıtlarını temizler.
 */
async function deduplicateHotelDetails() {
  logger.info(`Başlangıç dosyası: ${inputFile}`);
  logger.info(`Çıktı dosyası: ${outputFile}`);

  try {
    // Giriş dosyasını oku
    const hotelDetailsContent = await fs.readFile(inputFile, 'utf8');
    logger.info('Giriş dosyası başarıyla okundu.');

    const lines = hotelDetailsContent.split('\n');
    const uniqueHotels = new Map(); // Otel adı -> Otel bloğu (string array)
    let currentBlockLines = [];
    let currentHotelName = null;

    logger.info('Tekrarlayan kayıtlar temizleniyor...');

    for (const line of lines) {
      // Boş satırları ve ayırıcıları koruyarak bloğa ekle
      currentBlockLines.push(line);

      if (line.startsWith('NAME:')) {
        // Otel adını temizle (baştaki/sondaki boşlukları kaldır)
        currentHotelName = line.substring(5).trim();
      }

      // Ayırıcı satıra ulaşıldığında veya dosya sonuna yaklaşıldığında bloğu işle
      // (Dosya sonunda ayırıcı olmayabilir)
      if (line.startsWith(separator)) {
        if (currentHotelName && currentBlockLines.length > 1) { // Boş blokları atla
          // Otel adını anahtar olarak kullanarak bloğu Map'e ekle/güncelle
          // Bu, aynı isimdeki sonraki kayıtların öncekilerin üzerine yazmasını sağlar
          uniqueHotels.set(currentHotelName, [...currentBlockLines]); // Kopyasını sakla
          // logger.debug(`Otel eklendi/güncellendi: ${currentHotelName}`);
        }
        // Sonraki blok için sıfırla
        currentBlockLines = [];
        currentHotelName = null;
      }
    }

    // Dosya sonunda ayırıcı yoksa ve son blokta veri varsa onu da işle
    if (currentBlockLines.length > 1 && currentHotelName) {
       uniqueHotels.set(currentHotelName, [...currentBlockLines]);
       // logger.debug(`Son otel bloğu eklendi/güncellendi: ${currentHotelName}`);
    }

    logger.info(`Toplam ${uniqueHotels.size} benzersiz otel bulundu.`);

    // Map'teki benzersiz blokları al ve birleştir
    // Her blok zaten satırları içeriyor, bu yüzden önce satırları birleştirip sonra blokları birleştiriyoruz.
    const uniqueContent = Array.from(uniqueHotels.values())
                               .map(block => block.join('\n')) // Her bloğu string'e çevir
                               .join('\n'); // Blokları birleştir (zaten newline ile bitiyorlar genelde)

    // Yeni dosyayı yaz
    await fs.writeFile(outputFile, uniqueContent.trim() + '\n', 'utf8'); // Sonuna bir newline ekle
    logger.info(`Benzersiz otel detayları başarıyla "${outputFile}" dosyasına yazıldı.`);

  } catch (error) {
    logger.error(`Hata oluştu: ${error.message}`);
    console.error(error); // Konsola da yazdır
  }
}

// Script'i çalıştır
deduplicateHotelDetails();