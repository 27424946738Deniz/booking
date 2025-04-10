const fs = require('fs').promises;
const path = require('path');
const { URL, URLSearchParams } = require('url');
const logger = require('./logger'); // Assuming a logger exists in utils

/**
 * Verilen tarihin YYYY-MM-DD formatında olup olmadığını kontrol eder.
 * @param {string} dateString - Kontrol edilecek tarih string'i.
 * @returns {boolean} Formatın geçerli olup olmadığı.
 */
function isValidDateFormat(dateString) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateString);
}

/**
 * Otel linklerindeki tarih parametrelerini günceller.
 * @param {string} inputFile - Okunacak link dosyasının yolu (örn: hotel_links.txt).
 * @param {string} outputFile - Güncellenmiş linklerin yazılacağı dosya yolu (örn: hotel_links_dated.txt).
 * @param {string} checkinDate - Yeni check-in tarihi (YYYY-MM-DD formatında).
 * @param {string} checkoutDate - Yeni check-out tarihi (YYYY-MM-DD formatında).
 */
async function updateLinkDates(inputFile, outputFile, checkinDate, checkoutDate) {
  logger.info(`Link tarihleri güncelleniyor...`);
  logger.info(`Girdi Dosyası: ${inputFile}`);
  logger.info(`Çıktı Dosyası: ${outputFile}`);
  logger.info(`Check-in: ${checkinDate}`);
  logger.info(`Check-out: ${checkoutDate}`);

  if (!isValidDateFormat(checkinDate) || !isValidDateFormat(checkoutDate)) {
    logger.error('Hatalı tarih formatı. Lütfen YYYY-MM-DD formatını kullanın.');
    process.exit(1);
  }

  try {
    // Girdi dosyasını oku
    const content = await fs.readFile(inputFile, 'utf8');
    const links = content.split('\n').filter(link => link.trim() !== '');
    logger.info(`${links.length} adet temel link okundu.`);

    const updatedLinks = [];
    let updateCount = 0;

    for (const link of links) {
      try {
        const url = new URL(link);
        const params = new URLSearchParams(url.search);

        // Tarih parametrelerini güncelle
        params.set('checkin', checkinDate);
        params.set('checkout', checkoutDate);

        // Diğer potansiyel tarihle ilgili parametreleri de güncelleyebiliriz (varsa)
        // params.set('checkin_year', checkinDate.substring(0, 4));
        // params.set('checkin_month', checkinDate.substring(5, 7));
        // params.set('checkin_monthday', checkinDate.substring(8, 10));
        // params.set('checkout_year', checkoutDate.substring(0, 4));
        // params.set('checkout_month', checkoutDate.substring(5, 7));
        // params.set('checkout_monthday', checkoutDate.substring(8, 10));

        url.search = params.toString();
        updatedLinks.push(url.toString());
        updateCount++;
      } catch (error) {
        logger.warn(`URL işlenirken hata (atlanıyor): ${link} - Hata: ${error.message}`);
      }
    }

    // Güncellenmiş linkleri çıktı dosyasına yaz
    await fs.writeFile(outputFile, updatedLinks.join('\n'), 'utf8');
    logger.info(`${updateCount} link başarıyla güncellendi ve ${outputFile} dosyasına yazıldı.`);

  } catch (error) {
    logger.error(`Link tarihleri güncellenirken hata oluştu: ${error.message}`);
    process.exit(1);
  }
}

// Komut satırı argümanlarını işle
if (process.argv.length === 6) {
  const inputFile = path.resolve(process.argv[2]);
  const outputFile = path.resolve(process.argv[3]);
  const checkinDate = process.argv[4];
  const checkoutDate = process.argv[5];
  updateLinkDates(inputFile, outputFile, checkinDate, checkoutDate);
} else {
  console.error('Kullanım: node src/utils/update_link_dates.js <girdi_dosyasi> <çıktı_dosyasi> <checkin_tarihi> <checkout_tarihi>');
  console.error('Örnek: node src/utils/update_link_dates.js hotel_links.txt hotel_links_dated.txt 2025-05-10 2025-05-11');
  process.exit(1);
}

module.exports = { updateLinkDates }; // İleride başka script'lerden çağrılabilir