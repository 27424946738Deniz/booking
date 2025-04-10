const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger'); // Varsayılan logger'ı kullan (varsa)

const inputFile = path.join(__dirname, '../../unique_hotel_details.txt');
const outputFile = path.join(__dirname, '../../extracted_hotel_links.txt');

/**
 * unique_hotel_details.txt dosyasından URL'leri çıkarır ve yeni bir dosyaya yazar.
 */
async function extractHotelLinks() {
  // Logger yoksa basit console log kullan
  const log = logger || {
      info: console.log,
      error: console.error,
      warn: console.warn
  };

  log.info(`Giriş dosyası: ${inputFile}`);
  log.info(`Çıktı dosyası: ${outputFile}`);

  try {
    // Giriş dosyasını oku
    const content = await fs.readFile(inputFile, 'utf8');
    log.info('Giriş dosyası başarıyla okundu.');

    const lines = content.split('\n');
    const extractedLinks = [];

    log.info('URL\'ler ayıklanıyor...');

    for (const line of lines) {
      if (line.startsWith('URL:')) {
        // "URL: " kısmını kaldır ve baştaki/sondaki boşlukları temizle
        const cleanedLink = line.substring(4).trim();
        if (cleanedLink) { // Boş linkleri ekleme
          extractedLinks.push(cleanedLink);
        }
      }
    }

    log.info(`Toplam ${extractedLinks.length} URL ayıklandı.`);

    if (extractedLinks.length === 0) {
        log.warn('Hiç URL bulunamadı. Çıktı dosyası oluşturulmayacak.');
        return;
    }

    // Ayıklanan linkleri yeni dosyaya yaz (her link kendi satırında)
    await fs.writeFile(outputFile, extractedLinks.join('\n'), 'utf8');
    log.info(`Ayıklanan URL'ler başarıyla "${outputFile}" dosyasına yazıldı.`);

  } catch (error) {
    log.error(`Hata oluştu: ${error.message}`);
    console.error(error); // Konsola da yazdır
  }
}

// Script'i çalıştır
extractHotelLinks();